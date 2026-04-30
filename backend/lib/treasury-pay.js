import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tempo } from 'viem/chains';
import { getDb } from '../db.js';

const TEMPO_USDC = '0x20c000000000000000000000b9537d11c60e8b50';
const RPC = 'https://rpc.tempo.xyz';

// Commission split: treasury keeps 20%, creator gets 80%.
// All math runs in basis points + bigint base units to avoid float drift.
const COMMISSION_BPS = 2000n;             // 20% platform commission
const CREATOR_BPS = 10000n - COMMISSION_BPS;
const BPS_TOTAL = 10000n;
const USDC_DECIMALS = 6;

const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

let _account;
let _publicClient;
let _walletClient;

function getClients() {
  if (_walletClient) return { wallet: _walletClient, public: _publicClient, account: _account };
  const pk = process.env.TREASURY_PRIVATE_KEY;
  if (!pk) throw new Error('[treasury-pay] TREASURY_PRIVATE_KEY not set');
  const normalized = pk.startsWith('0x') ? pk : `0x${pk}`;
  _account = privateKeyToAccount(normalized);
  _publicClient = createPublicClient({ chain: tempo, transport: http(RPC) });
  _walletClient = createWalletClient({ account: _account, chain: tempo, transport: http(RPC) });
  return { wallet: _walletClient, public: _publicClient, account: _account };
}

/**
 * Compute the creator's commission cut at USDC 6-decimal precision.
 * Returns base-units bigint and a formatted decimal string.
 *
 * @example creatorCut(0.01) → { units: 8000n, amount: '0.008' }
 */
export function creatorCut(priceUsd) {
  const totalUnits = parseUnits(String(priceUsd), USDC_DECIMALS);
  const units = (totalUnits * CREATOR_BPS) / BPS_TOTAL;
  return { units, amount: formatUnits(units, USDC_DECIMALS) };
}

/**
 * Pay a creator their commission share for a balance-paid service call.
 *
 * Logs the intent to `payouts` (status: pending), signs a USDC transfer from
 * treasury, updates the doc with txHash + status: sent. The receipt watcher
 * later updates status to settled/reverted with the block number.
 *
 * Caller should fire-and-forget with .catch — never await on the request path.
 */
export async function payoutCreatorFromBalance(opts) {
  const { productId, productName, productBloby, recipient, amountUsd, botUsername } = opts;
  const db = getDb();
  const { units, amount } = creatorCut(amountUsd);
  if (units === 0n) return null;

  const { insertedId } = await db.collection('payouts').insertOne({
    productId,
    productName,
    productBloby,
    recipient: recipient.toLowerCase(),
    amount: Number(amount),
    amountUnits: units.toString(),
    sourceType: 'balance',
    botUsername,
    status: 'pending',
    createdAt: new Date(),
  });

  try {
    const { wallet, public: pub } = getClients();
    const hash = await wallet.writeContract({
      address: TEMPO_USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, units],
    });
    await db.collection('payouts').updateOne(
      { _id: insertedId },
      { $set: { txHash: hash, status: 'sent' } },
    );

    pub.waitForTransactionReceipt({ hash })
      .then(async (receipt) => {
        await db.collection('payouts').updateOne(
          { _id: insertedId },
          {
            $set: {
              status: receipt.status === 'success' ? 'settled' : 'reverted',
              blockNumber: Number(receipt.blockNumber),
              settledAt: new Date(),
            },
          },
        );
      })
      .catch((err) => console.error(`[payouts/${insertedId}] receipt error:`, err.message));

    return insertedId;
  } catch (err) {
    await db.collection('payouts').updateOne(
      { _id: insertedId },
      { $set: { status: 'failed', error: err.message } },
    ).catch(() => {});
    throw err;
  }
}

/**
 * Record a creator payout that happened on-chain inside an MPP `splits[]`
 * charge — the bot's signed credential settled atomically, treasury just
 * received its 20% as the primary recipient. We log for the unified ledger.
 */
export async function logSplitsPayout(opts) {
  const { productId, productName, productBloby, recipient, amountUsd, botUsername, txHash } = opts;
  const { units, amount } = creatorCut(amountUsd);
  if (units === 0n) return null;

  const { insertedId } = await getDb().collection('payouts').insertOne({
    productId,
    productName,
    productBloby,
    recipient: recipient.toLowerCase(),
    amount: Number(amount),
    amountUnits: units.toString(),
    sourceType: 'splits',
    botUsername,
    status: 'sent',
    txHash: txHash ?? null,
    createdAt: new Date(),
  });
  return insertedId;
}

/**
 * Record an unfulfilled commission — service was paid via balance but the
 * seller has no wallet to receive their share. A reconciliation job (TODO)
 * can flush these once the seller registers a wallet.
 */
export async function logUnfulfilledPayout(opts) {
  const { productId, productName, productBloby, amountUsd, botUsername } = opts;
  const { units, amount } = creatorCut(amountUsd);
  if (units === 0n) return null;

  await getDb().collection('payouts').insertOne({
    productId,
    productName,
    productBloby,
    recipient: null,
    amount: Number(amount),
    amountUnits: units.toString(),
    sourceType: 'balance',
    botUsername,
    status: 'unfulfilled',
    reason: 'seller-no-wallet',
    createdAt: new Date(),
  });
}
