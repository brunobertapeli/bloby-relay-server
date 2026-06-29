// Shared payment middleware: balance-first → MPP fallback, with creator
// commission splits. Used by both /api/services/:id/use and
// /api/marketplace/buy/:productId.
//
// Conventions:
//   - The route MUST attach the loaded product as `req.product` before this
//     chain runs (a Mongo `products` doc with `id`, `price`, `type`,
//     optional `morphy`).
//   - The route MUST set `req.user` (bot identity) before this chain runs.
//   - On success: req.paidVia = 'free' | 'balance' | 'mpp' | 'mpp-base'.
//   - For MPP-paid (Tempo): req.mppxWithReceipt is set so the route handler
//     can attach the Payment-Receipt header to its response.
//   - For BASE x402: x402-express handles X-PAYMENT-RESPONSE itself by
//     buffering the outgoing response, so the route handler does nothing.
//
// Commission rule:
//   - product.type === 'service' → no split, no payout (treasury keeps 100%).
//   - product.bloby missing       → no split, no payout (treasury keeps 100%).
//   - seller has no walletAddress → no split; balance path logs an
//     `unfulfilled` payout so it can be flushed later.
//   - seller wallet === treasury  → skipped (would be a no-op).
//   - else                        → 80% creator, 20% treasury.

import { ObjectId } from 'mongodb';
import { paymentMiddleware as baseX402Middleware } from 'x402-express';
import { facilitator as cdpFacilitator } from '@coinbase/x402';
import { getDb, getUsers } from '../db.js';
import { getMppx } from './mpp.js';
import {
  creatorCut,
  payoutCreatorFromBalance,
  payoutCreatorOnBase,
  logSplitsPayout,
  logUnfulfilledPayout,
} from './treasury-pay.js';

function isCommissionable(product) {
  return product && product.type !== 'service' && !!product.bloby;
}

async function findSellerWallet(morphy) {
  const seller = await getUsers().findOne(
    { username: morphy },
    { projection: { walletAddress: 1 } },
  );
  return seller?.walletAddress || null;
}

// ─── tryAccountBalance ──────────────────────────────────────────────────────
// Atomic deduction from `accounts.balance`. On success, schedules the creator
// commission payout async (treasury → seller wallet, 80% of price) when the
// product is commissionable.
export async function tryAccountBalance(req, res, next) {
  const product = req.product;
  if (!product) {
    return res.status(500).json({ error: 'No product loaded on req' });
  }

  if (product.price === 0) {
    req.paidVia = 'free';
    return next();
  }
  if (!req.user?.accountId) return next(); // unclaimed → fall through to MPP

  const accountId = new ObjectId(req.user.accountId);
  const result = await getDb().collection('accounts').updateOne(
    { _id: accountId, balance: { $gte: product.price } },
    { $inc: { balance: -product.price } },
  );
  if (result.modifiedCount !== 1) return next();

  req.paidVia = 'balance';

  if (isCommissionable(product)) {
    schedulePayout(product, req.user.username, req.user.accountId?.toString() || null).catch((err) =>
      console.error('[payment-chain/payout] schedule error:', err.message),
    );
  }
  next();
}

async function schedulePayout(product, botUsername, buyerAccountId) {
  const sellerWallet = await findSellerWallet(product.bloby);

  if (!sellerWallet) {
    await logUnfulfilledPayout({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      amountUsd: product.price,
      botUsername,
      buyerAccountId,
    });
    return;
  }

  const treasury = process.env.TREASURY_WALLET_ADDRESS?.toLowerCase();
  if (treasury && sellerWallet.toLowerCase() === treasury) return;

  setImmediate(() => {
    payoutCreatorFromBalance({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      recipient: sellerWallet,
      amountUsd: product.price,
      botUsername,
      buyerAccountId,
    }).catch((err) => console.error('[payment-chain/payout] tx error:', err.message));
  });
}

// ─── mppxIfNotPaid ──────────────────────────────────────────────────────────
// If neither free nor balance paid, run mppx.charge programmatically. On 402
// returns the challenge inline. On 200 stashes mppxWithReceipt for the route
// handler to attach the Payment-Receipt header.
export async function mppxIfNotPaid(req, res, next) {
  if (req.paidVia) return next();

  const product = req.product;
  let mppx;
  try {
    mppx = getMppx();
  } catch (err) {
    console.error('[payment-chain/mpp]', err.message);
    return res.status(500).json({ error: 'Payment system unavailable' });
  }

  const opts = { amount: String(product.price) };
  let creatorWallet = null;

  if (isCommissionable(product)) {
    const sellerWallet = await findSellerWallet(product.bloby);
    const treasury = process.env.TREASURY_WALLET_ADDRESS?.toLowerCase();
    if (sellerWallet && sellerWallet.toLowerCase() !== treasury) {
      const { amount: creatorAmount } = creatorCut(product.price);
      opts.splits = [{ amount: creatorAmount, recipient: sellerWallet }];
      creatorWallet = sellerWallet;
    }
  }

  const url = `${req.protocol}://${req.hostname}${req.originalUrl}`;
  const request = new Request(url, { method: req.method, headers: req.headers });

  const result = await mppx.charge(opts)(request);

  if (result.status === 402) {
    const c = result.challenge;
    res.status(c.status);
    for (const [k, v] of c.headers) res.setHeader(k, v);
    return res.send(await c.text());
  }

  req.paidVia = 'mpp';
  req.mppxWithReceipt = result.withReceipt;

  if (creatorWallet) {
    logSplitsPayout({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      recipient: creatorWallet,
      amountUsd: product.price,
      botUsername: req.user.username,
      buyerAccountId: req.user.accountId?.toString() || null,
    }).catch((err) => console.error('[payment-chain/splits-log]', err.message));
  }

  next();
}

// ─── attachReceiptHeader ────────────────────────────────────────────────────
// Helper for route handlers to attach Payment-Receipt to the outbound response
// when MPP was the payment path.
export function attachReceiptHeader(req, res) {
  if (!req.mppxWithReceipt) return;
  const wrapped = req.mppxWithReceipt(new Response('{}'));
  const receipt = wrapped.headers.get('Payment-Receipt');
  if (receipt) res.setHeader('Payment-Receipt', receipt);
}

// ─── scheduleBasePayout ─────────────────────────────────────────────────────
// Base counterpart of `schedulePayout`. After x402 settles 100% of the price
// to TREASURY_BASE_ADDRESS, fan out the creator's 80% on Base mainnet
// (treasury → seller wallet). If the seller has no wallet, log unfulfilled.
async function scheduleBasePayout(product, botUsername, buyerAccountId) {
  const sellerWallet = await findSellerWallet(product.bloby);

  if (!sellerWallet) {
    await logUnfulfilledPayout({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      amountUsd: product.price,
      botUsername,
      buyerAccountId,
      chain: 'base',
      sourceType: 'base-x402',
    });
    return;
  }

  const treasury = process.env.TREASURY_BASE_ADDRESS?.toLowerCase();
  if (treasury && sellerWallet.toLowerCase() === treasury) return;

  setImmediate(() => {
    payoutCreatorOnBase({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      recipient: sellerWallet,
      amountUsd: product.price,
      botUsername,
      buyerAccountId,
    }).catch((err) => console.error('[payment-chain/base-payout] tx error:', err.message));
  });
}

// ─── baseX402IfNotPaid ──────────────────────────────────────────────────────
// BASE-network counterpart of `mppxIfNotPaid`. If neither free nor balance
// paid, run x402-express's paymentMiddleware against USDC on Base mainnet
// (or base-sepolia when X402_NETWORK=base-sepolia for testing).
//
// Why a fresh middleware per request: x402-express resolves price + payTo at
// init time and matches by route pattern. Service prices are dynamic
// (per-product), so we instantiate a one-shot middleware that matches exactly
// the current req.method + req.path.
//
// 80/20 split: x402-express has no native `splits` parameter, so the full
// price settles to treasury first; the 80% creator share is then fanned out
// asynchronously by `scheduleBasePayout` (treasury → seller wallet on Base).
// Services (product.type === 'service') and products without a registered
// seller skip the payout — treasury keeps 100% as before.
let _baseFacilitator;
function getBaseFacilitator() {
  if (_baseFacilitator) return _baseFacilitator;
  const useTestnet = process.env.X402_NETWORK === 'base-sepolia';
  // Coinbase CDP facilitator on mainnet reads CDP_API_KEY_ID + CDP_API_KEY_SECRET
  // automatically; the public x402.org facilitator handles base-sepolia for free.
  _baseFacilitator = useTestnet ? { url: 'https://x402.org/facilitator' } : cdpFacilitator;
  return _baseFacilitator;
}

export async function baseX402IfNotPaid(req, res, next) {
  if (req.paidVia) return next();

  const product = req.product;
  const payTo = process.env.TREASURY_BASE_ADDRESS;
  if (!payTo) {
    console.error('[base-x402] TREASURY_BASE_ADDRESS not set');
    return res.status(500).json({ error: 'Payment system unavailable' });
  }

  const network = process.env.X402_NETWORK === 'base-sepolia' ? 'base-sepolia' : 'base';
  const routeKey = `${req.method.toUpperCase()} ${req.path}`;

  let middleware;
  try {
    middleware = baseX402Middleware(
      payTo,
      {
        [routeKey]: {
          price: `$${product.price}`,
          network,
          config: {
            description: product.description || product.name || product.id,
            mimeType: 'application/json',
          },
        },
      },
      getBaseFacilitator(),
    );
  } catch (err) {
    console.error('[base-x402] init error:', err.message);
    return res.status(500).json({ error: 'Payment system unavailable' });
  }

  // x402-express calls `next()` after verifying the X-PAYMENT header; that's
  // when we mark the request as paid so downstream handlers know.
  const wrappedNext = (err) => {
    if (err) return next(err);
    req.paidVia = 'mpp-base';

    if (isCommissionable(product)) {
      scheduleBasePayout(
        product,
        req.user?.username || null,
        req.user?.accountId?.toString() || null,
      ).catch((err) => console.error('[base-x402/payout] schedule error:', err.message));
    }

    next();
  };

  return middleware(req, res, wrappedNext);
}
