import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate, authenticateBlobyHeader, optionalAuth } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { upload as r2Upload, getFile } from '../lib/r2.js';
import {
  tryAccountBalance,
  mppxIfNotPaid,
  baseX402IfNotPaid,
  attachReceiptHeader,
} from '../lib/payment-chain.js';
import {
  payoutCreatorFromBalance,
  logUnfulfilledPayout,
} from '../lib/treasury-pay.js';
import multer from 'multer';
import { marketplaceCheckoutLimiter, marketplaceRedeemLimiter, marketplaceSubmitLimiter } from '../middleware/rateLimiter.js';
import { getStripe, getStripeFrontendUrl } from './stripe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, '..', 'static');
const router = Router();

// ─── Product catalog (live from MongoDB) ─────────────────────────────────────

const approved = { $or: [{ status: 'approved' }, { status: { $exists: false } }] };

async function getLiveCatalog() {
  const col = getDb().collection('products');
  const all = await col.find(approved).toArray();
  return {
    skills: all.filter((p) => p.type === 'skill' || p.type === 'setup'),
    blueprints: all.filter((p) => p.type === 'blueprint'),
    bundles: all.filter((p) => p.type === 'bundle'),
    services: all.filter((p) => p.type === 'service'),
  };
}

// ─── Dynamic marketplace.md generator ───────────────────────────────────────

const templatePath = path.join(staticDir, 'marketplace.md');

function priceLabel(p) {
  if (p.price === 0) return 'Free';
  return `$${Number(p.price).toFixed(2)}`;
}

function generateSkillSection(skill) {
  const price = priceLabel(skill);
  const lines = [`### ${skill.name} — ${price}`, '', skill.description || ''];

  lines.push('', `- **Version: ${skill.version || '1.0.0'}**`);
  if (skill.depends && skill.depends.length > 0) {
    lines.push(`- **Requires:** \`${skill.depends.join('`, `')}\``);
  } else {
    lines.push('- Dependencies: none');
  }
  if (skill.size) lines.push(`- Size: ${skill.size}`);

  if (skill.price === 0) {
    lines.push('', '**Download (free — no purchase required):**', '',
      '```bash',
      `curl -sL https://bloby.bot/api/marketplace/download/free/${skill.id} \\`,
      '  -H "Authorization: Bearer $RELAY_TOKEN" \\',
      `  -o /tmp/${skill.id}.tar.gz`);
    if (skill.sha256) {
      lines.push(`echo "${skill.sha256}  /tmp/${skill.id}.tar.gz" | shasum -a 256 -c`);
    }
    lines.push(`tar xzf /tmp/${skill.id}.tar.gz -C skills/`,
      `rm /tmp/${skill.id}.tar.gz`,
      '```');
  } else {
    lines.push('', '**Purchase options.** Both return JSON `{ skills: [{ url, sha256, ... }] }` — follow each `url` to download the .tar.gz, then extract to `skills/`.', '');
    lines.push('a. *If your human gave you a redeem code* — they paid via Stripe on the website:', '',
      '```bash',
      'curl -s -X POST https://bloby.bot/api/marketplace/redeem \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"code":"<REDEEM_CODE>"}\'',
      '```', '');
    lines.push('b. *Buy autonomously (Tempo USDC)* — the relay tries your owner\'s credits first, then falls back to your wallet via MPP on Tempo:', '',
      '```bash',
      'MPPX_PRIVATE_KEY=$(jq -r .wallet.privateKey ~/.bloby/config.json) \\',
      `  npx -y mppx https://bloby.bot/api/marketplace/buy/${skill.id} \\`,
      '  -X POST -H "X-Bloby-Token: $RELAY_TOKEN"',
      '```', '');
    lines.push('c. *Buy autonomously (Coinbase BASE USDC)* — same flow, but the x402 challenge settles on Base mainnet. Use any x402-compatible client (e.g. `x402-fetch`):', '',
      '```',
      `POST https://bloby.bot/api/marketplace/buy-base/${skill.id}`,
      'Header: X-Bloby-Token: $RELAY_TOKEN',
      '```');
  }

  return lines.join('\n');
}

function generateBlueprintSection(bp) {
  const price = priceLabel(bp);
  const lines = [`### ${bp.name} — ${price}`, '', bp.description || ''];

  lines.push('', `- **Version: ${bp.version || '1.0.0'}**`);
  if (bp.depends && bp.depends.length > 0) {
    lines.push(`- **Requires:** \`${bp.depends.join('`, `')}\``);
  } else {
    lines.push('- Dependencies: none');
  }
  if (bp.size) lines.push(`- Size: ${bp.size}`);

  if (bp.price === 0) {
    lines.push('', '**Download (free — no purchase required):**', '',
      '```bash',
      `curl -sL https://bloby.bot/api/marketplace/download/free/${bp.id} \\`,
      '  -H "Authorization: Bearer $RELAY_TOKEN" \\',
      `  -o /tmp/${bp.id}.tar.gz`);
    if (bp.sha256) {
      lines.push(`echo "${bp.sha256}  /tmp/${bp.id}.tar.gz" | shasum -a 256 -c`);
    }
    lines.push(`tar xzf /tmp/${bp.id}.tar.gz -C skills/`,
      `rm /tmp/${bp.id}.tar.gz`,
      '```');
    lines.push('', `**After executing:** Read \`skills/${bp.id}/SKILL.md\`, follow the steps, confirm with your human, then archive: \`mv skills/${bp.id}/ skills/_archive/${bp.id}/\``);
  } else {
    lines.push('', '**Purchase options.** Both return JSON `{ skills: [{ url, sha256, ... }] }` — follow each `url` to download the .tar.gz, then extract to `skills/`.', '');
    lines.push('a. *If your human gave you a redeem code* — they paid via Stripe on the website:', '',
      '```bash',
      'curl -s -X POST https://bloby.bot/api/marketplace/redeem \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"code":"<REDEEM_CODE>"}\'',
      '```', '');
    lines.push('b. *Buy autonomously (Tempo USDC)* — the relay tries your owner\'s credits first, then falls back to your wallet via MPP on Tempo:', '',
      '```bash',
      'MPPX_PRIVATE_KEY=$(jq -r .wallet.privateKey ~/.bloby/config.json) \\',
      `  npx -y mppx https://bloby.bot/api/marketplace/buy/${bp.id} \\`,
      '  -X POST -H "X-Bloby-Token: $RELAY_TOKEN"',
      '```', '');
    lines.push('c. *Buy autonomously (Coinbase BASE USDC)* — same flow, but the x402 challenge settles on Base mainnet. Use any x402-compatible client (e.g. `x402-fetch`):', '',
      '```',
      `POST https://bloby.bot/api/marketplace/buy-base/${bp.id}`,
      'Header: X-Bloby-Token: $RELAY_TOKEN',
      '```', '');
    lines.push(`**After downloading:** Read \`skills/${bp.id}/SKILL.md\`, follow the steps, confirm with your human, then archive: \`mv skills/${bp.id}/ skills/_archive/${bp.id}/\``);
  }

  return lines.join('\n');
}

function generateBundleSection(bundle) {
  const price = priceLabel(bundle);
  const lines = [`### ${bundle.name} — ${price}`, '', bundle.description || ''];
  if (bundle.skills && bundle.skills.length > 0) {
    const names = bundle.skills.map((s) => typeof s === 'string' ? s : s.name || s.id);
    lines.push('', `Includes: ${names.join(' + ')}.`);
  }
  if (bundle.price > 0) {
    lines.push('', '**Purchase options.** Both return JSON `{ skills: [...] }` with download URLs for every skill in the bundle.', '');
    lines.push('a. *If your human gave you a redeem code:*', '',
      '```bash',
      'curl -s -X POST https://bloby.bot/api/marketplace/redeem \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"code":"<REDEEM_CODE>"}\'',
      '```', '');
    lines.push('b. *Buy autonomously (Tempo USDC)* — credits first, MPP fallback on Tempo:', '',
      '```bash',
      'MPPX_PRIVATE_KEY=$(jq -r .wallet.privateKey ~/.bloby/config.json) \\',
      `  npx -y mppx https://bloby.bot/api/marketplace/buy/${bundle.id} \\`,
      '  -X POST -H "X-Bloby-Token: $RELAY_TOKEN"',
      '```', '');
    lines.push('c. *Buy autonomously (Coinbase BASE USDC)* — same flow, but the x402 challenge settles on Base mainnet. Use any x402-compatible client (e.g. `x402-fetch`):', '',
      '```',
      `POST https://bloby.bot/api/marketplace/buy-base/${bundle.id}`,
      'Header: X-Bloby-Token: $RELAY_TOKEN',
      '```');
  }
  return lines.join('\n');
}

function generateServiceSection(service) {
  let priceLabel;
  if (service.pricingModel === 'per-minute' && service.unitPriceUsd) {
    const perHour = service.unitPriceUsd * 60;
    priceLabel = `$${Number(service.unitPriceUsd).toFixed(4)}/min ($${perHour.toFixed(2)}/hr)`;
  } else if (service.price > 0) {
    priceLabel = `$${Number(service.price).toFixed(2)}/use`;
  } else {
    priceLabel = 'Free';
  }
  const lines = [`### ${service.name} — ${priceLabel}`, '', service.description || ''];

  lines.push('', `- **Version: ${service.version || '1.0.0'}**`);
  if (service.pricingModel === 'per-minute' && service.unitPriceUsd) {
    const perHour = service.unitPriceUsd * 60;
    lines.push(`- **Pricing:** $${Number(service.unitPriceUsd).toFixed(4)} per estimated minute, rounded up (≈ $${perHour.toFixed(2)}/hour). Deducted from owner's credit balance, with MPP/Base fallback.`);
  } else if (service.price > 0) {
    lines.push(`- **Price:** $${Number(service.price).toFixed(2)} per use (deducted from owner's credit balance)`);
  }

  // Rich agent-facing docs stored in MongoDB
  if (service.agentDocs) {
    lines.push('', service.agentDocs);
  } else {
    // Fallback: basic usage
    lines.push('', '**Usage:**', '',
      '```bash',
      `curl -s -X POST https://bloby.bot/api/services/${service.id}/use \\`,
      '  -H "Authorization: Bearer $RELAY_TOKEN"',
      '```');
  }

  return lines.join('\n');
}

async function buildMarketplaceMd() {
  const catalog = await getLiveCatalog();
  const template = fs.readFileSync(templatePath, 'utf-8');

  const skillsMd = catalog.skills.length > 0
    ? `## Available Skills\n\n${catalog.skills.map(generateSkillSection).join('\n\n---\n\n')}`
    : '## Available Skills\n\nNo skills available yet.';

  const bundlesMd = catalog.bundles.length > 0
    ? `## Bundles\n\n${catalog.bundles.map(generateBundleSection).join('\n\n---\n\n')}`
    : '## Bundles\n\nNo bundles available yet.';

  const blueprintsMd = catalog.blueprints.length > 0
    ? `## Blueprints\n\nBlueprints are one-time knowledge packages. You download, execute, confirm with your human, then **archive to \`skills/_archive/\`**. They do not stay in \`skills/\`.\n\n${catalog.blueprints.map(generateBlueprintSection).join('\n\n---\n\n')}`
    : '## Blueprints\n\nNo blueprints available yet.';

  const servicesMd = catalog.services.length > 0
    ? `## Available Services\n\nServices are cloud API endpoints you call on demand. Each call is recorded as a transaction.\n\n${catalog.services.map(generateServiceSection).join('\n\n---\n\n')}`
    : '## Available Services\n\nNo services available yet.';

  return template
    .replace('{{SKILLS}}', skillsMd)
    .replace('{{BUNDLES}}', bundlesMd)
    .replace('{{BLUEPRINTS}}', blueprintsMd)
    .replace('{{SERVICES}}', servicesMd);
}

async function findDownloadable(id) {
  return getDb().collection('products').findOne({ id, ...approved });
}

async function findBundle(id) {
  return getDb().collection('products').findOne({ id, type: 'bundle', ...approved });
}

async function findProduct(id, type) {
  return getDb().collection('products').findOne({ id, type, ...approved });
}

const REDEEM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DOWNLOAD_TOKEN_TTL = 3600; // 1 hour

function generateRedeemCode() {
  const bytes = crypto.randomBytes(16);
  const code = Array.from(bytes)
    .map((b) => REDEEM_CHARS[b % REDEEM_CHARS.length])
    .join('');
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

/**
 * Resolve cart items to a deduplicated list of skill IDs.
 * Bundles expand to their listed skills. Individual skills resolve to themselves only.
 * Dependencies are NOT auto-included — bundles are the packaging mechanism.
 */
async function resolveSkills(items) {
  const skillIds = new Set();

  for (const item of items) {
    if (item.type === 'bundle') {
      const bundle = await findBundle(item.id);
      if (bundle) (bundle.items || bundle.skills || []).forEach((id) => skillIds.add(id));
    } else if (item.type === 'skill' || item.type === 'blueprint') {
      const product = await findDownloadable(item.id);
      if (product) skillIds.add(product.id);
    }
  }

  return [...skillIds];
}

/**
 * Validate that all cart items exist. Returns null on success, or an error string.
 */
async function validateCartItems(items) {
  for (const item of items) {
    if (item.type === 'bundle') {
      if (!(await findBundle(item.id))) return `Unknown bundle: ${item.id}`;
    } else if (item.type === 'skill') {
      if (!(await findProduct(item.id, 'skill')) && !(await findProduct(item.id, 'setup'))) return `Unknown skill: ${item.id}`;
    } else if (item.type === 'blueprint') {
      if (!(await findProduct(item.id, 'blueprint'))) return `Unknown blueprint: ${item.id}`;
    } else if (item.type === 'credit') {
      const amount = parseFloat(item.amount);
      if (!amount || amount < 1) return 'Credit amount must be at least $1';
    } else {
      return `Invalid item type: ${item.type}`;
    }
  }
  return null;
}

/**
 * Calculate total price for cart items from MongoDB.
 */
async function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    if (item.type === 'bundle') {
      const bundle = await findBundle(item.id);
      total += bundle.price;
    } else if (item.type === 'credit') {
      total += parseFloat(item.amount);
    } else {
      const product = await findDownloadable(item.id);
      if (product) total += product.price;
    }
  }
  return total;
}

// ─── Cart fulfillment (shared by free path + post-Stripe webhook) ──────────
// Generates redeem code, creates the purchase doc, increments credit balance,
// schedules creator payouts, and returns frontend-shaped item details.
async function processFulfillment({ accountId, items, stripeSessionId = null }) {
  const resolvedSkills = await resolveSkills(items);
  const total = await calculateTotal(items);
  const creditAmount = items
    .filter((i) => i.type === 'credit')
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  const code = generateRedeemCode();
  const now = new Date();
  const db = getDb();

  await db.collection('purchases').insertOne({
    code,
    accountId,
    cartItems: items,
    resolvedSkills,
    total,
    stripeSessionId,
    createdAt: now,
    redemptions: [],
  });

  if (creditAmount > 0) {
    await db.collection('accounts').updateOne(
      { _id: new ObjectId(accountId) },
      { $inc: { balance: creditAmount } },
    );
  }

  for (const skillId of resolvedSkills) {
    const product = await findDownloadable(skillId);
    if (product && product.bloby && product.type !== 'service' && product.price > 0) {
      schedulePayoutForItem(product, {
        botUsername: null,
        buyerAccountId: accountId,
      }).catch((err) => console.error('[marketplace/checkout] payout error:', err.message));
    }
  }

  const itemDetails = [];
  for (const item of items) {
    if (item.type === 'credit') {
      itemDetails.push({ id: item.id, type: 'credit', name: `$${parseFloat(item.amount).toFixed(2)} Credits`, price: parseFloat(item.amount) });
    } else {
      const product = item.type === 'bundle' ? await findBundle(item.id) : await findDownloadable(item.id);
      if (product) itemDetails.push({ id: product.id, type: item.type, name: product.name, price: product.price });
    }
  }

  return { code, items: itemDetails, resolvedSkills, total };
}

// Build Stripe Checkout line_items dynamically from cart entries.
// Each cart item gets its own row so the Stripe receipt reads naturally.
async function buildStripeLineItems(items) {
  const lines = [];
  for (const item of items) {
    if (item.type === 'credit') {
      const amount = parseFloat(item.amount);
      lines.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `$${amount.toFixed(2)} Bloby Credits`,
            description: 'Account credit balance — usable across all your agents',
          },
        },
        quantity: 1,
      });
      continue;
    }

    const product = item.type === 'bundle'
      ? await findBundle(item.id)
      : await findDownloadable(item.id);
    if (!product || !product.price || product.price <= 0) continue;

    const labelType = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    lines.push({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: product.name,
          description: (product.description || `${labelType} · ${product.id}`).slice(0, 200),
        },
      },
      quantity: 1,
    });
  }
  return lines;
}

// Idempotent fulfillment for a Stripe-paid marketplace purchase. Called by
// the Stripe webhook AND the success-page lookup endpoint — whichever wins
// the race does the work; the other reads the recorded result.
export async function fulfillMarketplacePurchase(sessionId) {
  const db = getDb();

  // Atomic claim: only the first caller transitions pending → fulfilling.
  const claimed = await db.collection('pending_purchases').findOneAndUpdate(
    { stripeSessionId: sessionId, status: 'pending' },
    { $set: { status: 'fulfilling', startedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!claimed) {
    const existing = await db.collection('pending_purchases').findOne({ stripeSessionId: sessionId });
    if (!existing) return { status: 'not_found' };
    if (existing.status === 'fulfilled') {
      return {
        status: 'fulfilled',
        code: existing.redeemCode,
        items: existing.fulfilledItems,
        total: existing.total,
      };
    }
    return { status: 'processing' };
  }

  try {
    const result = await processFulfillment({
      accountId: claimed.accountId,
      items: claimed.items,
      stripeSessionId: sessionId,
    });

    await db.collection('pending_purchases').updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: 'fulfilled',
          redeemCode: result.code,
          fulfilledItems: result.items,
          fulfilledAt: new Date(),
        },
      },
    );

    return { status: 'fulfilled', code: result.code, items: result.items, total: result.total };
  } catch (err) {
    // Roll back so a retry can pick it up.
    await db.collection('pending_purchases').updateOne(
      { _id: claimed._id },
      { $set: { status: 'pending' }, $unset: { startedAt: 1 } },
    );
    throw err;
  }
}

// ─── POST /api/marketplace/checkout ─────────────────────────────────────────
// Dashboard user checks out. If the cart total is $0 (free items only) we
// fulfill inline and return a redeem code immediately. Otherwise we create a
// Stripe Checkout Session and return its hosted URL — the frontend redirects.
// Real fulfillment happens in fulfillMarketplacePurchase, triggered by either
// the Stripe webhook or the success-page lookup (whichever fires first).
router.post('/marketplace/checkout', jwtAuth, marketplaceCheckoutLimiter, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const validationError = await validateCartItems(items);
    if (validationError) return res.status(400).json({ error: validationError });

    const total = await calculateTotal(items);

    if (total === 0) {
      const result = await processFulfillment({ accountId: req.account.id, items });
      return res.json({ freeFulfilled: true, ...result });
    }

    const stripe = getStripe();
    const FRONTEND_URL = getStripeFrontendUrl();
    const db = getDb();

    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });

    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: account.email || req.account.email,
        name: account.name || req.account.name,
        metadata: { accountId: req.account.id },
      });
      customerId = customer.id;
      await db.collection('accounts').updateOne(
        { _id: new ObjectId(req.account.id) },
        { $set: { stripeCustomerId: customerId } },
      );
    }

    const lineItems = await buildStripeLineItems(items);
    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No paid items in cart' });
    }

    const pendingId = new ObjectId();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        purpose: 'marketplace',
        pendingId: pendingId.toString(),
        accountId: req.account.id,
      },
      success_url: `${FRONTEND_URL}/marketplace?marketplace_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/marketplace?marketplace_canceled=1`,
    });

    await db.collection('pending_purchases').insertOne({
      _id: pendingId,
      stripeSessionId: session.id,
      accountId: req.account.id,
      items,
      total,
      status: 'pending',
      createdAt: new Date(),
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[marketplace/checkout]', error.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// ─── GET /api/marketplace/checkout/session/:sessionId ───────────────────────
// Called by the success page after Stripe redirects back. Idempotent: returns
// the existing redeem code if the webhook already fulfilled, or fulfills now.
router.get('/marketplace/checkout/session/:sessionId', jwtAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stripe = getStripe();

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.metadata?.purpose !== 'marketplace') {
      return res.status(400).json({ error: 'Not a marketplace session' });
    }
    if (session.metadata?.accountId !== req.account.id) {
      return res.status(403).json({ error: 'Not your session' });
    }

    if (session.payment_status !== 'paid') {
      return res.json({ status: 'unpaid' });
    }

    const result = await fulfillMarketplacePurchase(sessionId);
    res.json(result);
  } catch (error) {
    console.error('[marketplace/checkout/session]', error.message);
    res.status(500).json({ error: 'Failed to look up session' });
  }
});

// ─── POST /api/marketplace/checkout/bot ─────────────────────────────────────
// Claimed bot purchases items using owner's credit balance.
// Returns download URLs directly (no redeem code needed — the bot is downloading).
router.post('/marketplace/checkout/bot', authenticate, marketplaceCheckoutLimiter, async (req, res) => {
  try {
    if (!req.user.accountId) {
      return res.status(403).json({ error: 'Not claimed — no linked account' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Bots don't buy credits — filter out credit type
    const validationError = await validateCartItems(items.filter((i) => i.type !== 'credit'));
    if (validationError) return res.status(400).json({ error: validationError });

    const resolvedSkills = await resolveSkills(items);
    const total = await calculateTotal(items);

    const db = getDb();
    const accountId = new ObjectId(req.user.accountId);

    // Atomic balance deduction — prevents overdraft and race conditions
    if (total > 0) {
      const result = await db.collection('accounts').updateOne(
        { _id: accountId, balance: { $gte: total } },
        { $inc: { balance: -total } },
      );
      if (result.modifiedCount === 0) {
        return res.status(402).json({
          error: 'Insufficient credit balance',
          hint: 'This endpoint is balance-only (cart-style). For autonomous wallet-based purchases that fall back to MPP when credits are short, use POST /api/marketplace/buy/:productId — one product at a time, with X-Bloby-Token: $RELAY_TOKEN.',
        });
      }
    }

    const code = generateRedeemCode();
    const now = new Date();
    await db.collection('purchases').insertOne({
      code,
      accountId: req.user.accountId.toString(),
      botUsername: req.user.username,
      cartItems: items,
      resolvedSkills,
      total,
      createdAt: now,
      redemptions: [{ at: now, bot: req.user.username }],
    });

    // Record transactions + schedule creator payouts per item.
    // The cart endpoint is balance-only (no MPP fallback) but we still owe
    // creators their 80% share — fire async treasury → seller transfers.
    for (const skillId of resolvedSkills) {
      const product = await findDownloadable(skillId);
      if (product) {
        recordTransaction({
          productId: product.id,
          productType: product.type === 'blueprint' ? 'blueprint' : 'skill',
          productName: product.name,
          botUsername: req.user.username,
          accountId: req.user.accountId.toString(),
          unitPrice: product.price,
        }).catch((err) => console.error('[marketplace/checkout/bot] tx error:', err.message));

        if (product.bloby && product.type !== 'service' && product.price > 0) {
          schedulePayoutForItem(product, {
            botUsername: req.user.username,
            buyerAccountId: req.user.accountId.toString(),
          }).catch((err) => console.error('[marketplace/checkout/bot] payout error:', err.message));
        }
      }
    }

    const downloadToken = jwt.sign(
      { pc: code, sk: resolvedSkills },
      process.env.JWT_SECRET,
      { expiresIn: DOWNLOAD_TOKEN_TTL },
    );

    const baseUrl = process.env.RELAY_DOMAIN
      ? `https://${process.env.RELAY_DOMAIN}`
      : `http://localhost:${process.env.PORT || 4000}`;

    const skills = [];
    for (const skillId of resolvedSkills) {
      const product = await findDownloadable(skillId);
      if (product) {
        skills.push({
          name: product.id,
          version: product.version,
          url: `${baseUrl}/api/marketplace/download/${downloadToken}/${product.id}`,
          sha256: product.sha256,
        });
      }
    }

    const account = await db.collection('accounts').findOne(
      { _id: accountId },
      { projection: { balance: 1 } },
    );

    res.json({ skills, total, balanceRemaining: account?.balance || 0 });
  } catch (error) {
    console.error('[marketplace/checkout/bot]', error.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Helper for cart-style checkouts: fire one creator-commission payout per item.
// Both /checkout (human, Stripe-paid) and /checkout/bot (bot, balance-paid)
// are balance-source from the ledger's perspective — the user's money is
// somewhere upstream (Stripe or account balance), and treasury settles the
// creator's USDC share.
async function schedulePayoutForItem(product, { botUsername = null, buyerAccountId = null } = {}) {
  const seller = await getUsers().findOne(
    { username: product.bloby },
    { projection: { walletAddress: 1 } },
  );
  if (!seller?.walletAddress) {
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
  if (treasury && seller.walletAddress.toLowerCase() === treasury) return;

  setImmediate(() => {
    payoutCreatorFromBalance({
      productId: product.id,
      productName: product.name,
      productBloby: product.bloby,
      recipient: seller.walletAddress,
      amountUsd: product.price,
      botUsername,
      buyerAccountId,
    }).catch((err) => console.error('[marketplace/payout] tx error:', err.message));
  });
}

// ─── POST /api/marketplace/buy/:productId ──────────────────────────────────
// Autonomous single-product purchase by a bot. Pays via:
//   1. owner's account credits if claimed and sufficient (balance path), OR
//   2. bot's USDC wallet via MPP 402 (mpp path)
// Both paths apply the 80/20 commission split when the product has a seller
// with a registered walletAddress (skills/blueprints/bundles only — services
// are not downloadable here).
//
// Returns the same { skills: [...] } shape as /redeem so existing client
// download code works unchanged. Bundles expand to constituent skills.
async function loadProductForBuy(req, res, next) {
  const product = await getDb().collection('products').findOne({ id: req.params.productId, ...approved });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.type === 'service') {
    return res.status(400).json({ error: 'Services are called via POST /api/services/:id/use, not /api/marketplace/buy' });
  }
  if (!['skill', 'setup', 'blueprint', 'bundle'].includes(product.type)) {
    return res.status(400).json({ error: `Cannot buy product type: ${product.type}` });
  }
  req.product = product;
  next();
}

async function issueDownloadUrls(req, res) {
  try {
    const product = req.product;
    const skillIds = product.type === 'bundle'
      ? (product.items || product.skills || [])
      : [product.id];

    if (skillIds.length === 0) {
      return res.status(500).json({ error: 'Bundle has no items' });
    }

    const downloadToken = jwt.sign(
      { pc: `mpp_${Date.now()}`, sk: skillIds },
      process.env.JWT_SECRET,
      { expiresIn: DOWNLOAD_TOKEN_TTL },
    );

    const baseUrl = process.env.RELAY_DOMAIN
      ? `https://${process.env.RELAY_DOMAIN}`
      : `http://localhost:${process.env.PORT || 4000}`;

    const skills = [];
    for (const skillId of skillIds) {
      const downloadable = await findDownloadable(skillId);
      if (!downloadable) continue;
      skills.push({
        name: downloadable.id,
        version: downloadable.version,
        url: `${baseUrl}/api/marketplace/download/${downloadToken}/${downloadable.id}`,
        sha256: downloadable.sha256,
      });
      recordTransaction({
        productId: downloadable.id,
        productType: downloadable.type === 'blueprint' ? 'blueprint' : 'skill',
        productName: downloadable.name,
        botUsername: req.user.username,
        accountId: req.user.accountId || null,
        unitPrice: downloadable.price,
      }).catch((err) => console.error('[marketplace/buy] tx error:', err.message));
    }

    attachReceiptHeader(req, res);

    const response = { skills, paidVia: req.paidVia, productId: product.id };

    // Balance-remaining is only meaningful when the bot is claimed
    if (req.user.accountId && req.paidVia === 'balance') {
      const account = await getDb().collection('accounts').findOne(
        { _id: new ObjectId(req.user.accountId) },
        { projection: { balance: 1 } },
      );
      response.balanceRemaining = account?.balance || 0;
    }

    res.json(response);
  } catch (err) {
    console.error('[marketplace/buy]', err.message);
    res.status(500).json({ error: 'Buy failed' });
  }
}

router.post(
  '/marketplace/buy/:productId',
  authenticateBlobyHeader,
  marketplaceCheckoutLimiter,
  loadProductForBuy,
  tryAccountBalance,
  mppxIfNotPaid,
  issueDownloadUrls,
);

// ─── POST /api/marketplace/buy-base/:productId ─────────────────────────────
// Same as /buy/:productId but the x402 fallback settles USDC on Coinbase
// BASE instead of Tempo. Bots pick the endpoint that matches the network
// their wallet is funded on.
//
// 80/20 split: x402-express has no native `splits` parameter, so x402 settles
// 100% to TREASURY_BASE_ADDRESS first; `scheduleBasePayout` then fans out the
// creator's 80% on Base asynchronously (treasury → seller wallet). The
// balance path still settles via `payoutCreatorFromBalance` on Tempo.
router.post(
  '/marketplace/buy-base/:productId',
  authenticateBlobyHeader,
  marketplaceCheckoutLimiter,
  loadProductForBuy,
  tryAccountBalance,
  baseX402IfNotPaid,
  issueDownloadUrls,
);

// ─── POST /api/marketplace/redeem ───────────────────────────────────────────
// Agent redeems a purchase code. Returns short-lived download URLs + sha256.
// No auth required — the code IS the authorization.
router.post('/marketplace/redeem', marketplaceRedeemLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Redeem code is required' });
    }

    // Normalize: strip non-alphanumeric, uppercase, re-format as XXXX-XXXX-XXXX-XXXX
    const raw = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = raw.length === 16
      ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
      : code.trim().toUpperCase();

    const db = getDb();
    const purchase = await db.collection('purchases').findOne({ code: formatted });

    if (!purchase) {
      return res.status(404).json({ error: 'Invalid redeem code' });
    }

    return handleRedeem(purchase, req, res);
  } catch (error) {
    console.error('[marketplace/redeem]', error.message);
    res.status(500).json({ error: 'Redemption failed' });
  }
});

async function handleRedeem(purchase, req, res) {
  // Generate short-lived download token
  const downloadToken = jwt.sign(
    { pc: purchase.code, sk: purchase.resolvedSkills },
    process.env.JWT_SECRET,
    { expiresIn: DOWNLOAD_TOKEN_TTL },
  );

  // Record redemption
  const db = getDb();
  await db.collection('purchases').updateOne(
    { _id: purchase._id },
    { $push: { redemptions: { at: new Date(), ip: req.ip } } },
  );

  // Build download instructions
  const baseUrl = process.env.RELAY_DOMAIN
    ? `https://${process.env.RELAY_DOMAIN}`
    : `http://localhost:${process.env.PORT || 4000}`;

  const skills = [];
  for (const skillId of purchase.resolvedSkills) {
    const product = await findDownloadable(skillId);
    if (product) {
      skills.push({
        name: product.id,
        version: product.version,
        url: `${baseUrl}/api/marketplace/download/${downloadToken}/${product.id}`,
        sha256: product.sha256,
      });
    }
  }

  res.json({ skills });
}

// ─── GET /api/marketplace/download/free/:skillId ────────────────────────────
// Direct download for free skills/blueprints. Optional bot auth to record the transaction.
// IMPORTANT: Must be registered BEFORE the :token/:skillId route,
// otherwise Express matches "free" as a token parameter.
router.get('/marketplace/download/free/:skillId', optionalAuth, async (req, res) => {
  const { skillId } = req.params;

  const product = await findDownloadable(skillId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.price > 0) {
    return res.status(402).json({ error: 'This product requires purchase' });
  }

  const r2Key = `${product.folder || 'skills'}/${product.file}`;
  let tarball;
  try {
    tarball = await getFile(r2Key);
  } catch {
    return res.status(404).json({ error: 'Product file not available' });
  }

  if (req.user) {
    recordTransaction({
      productId: product.id,
      productType: product.type === 'blueprint' ? 'blueprint' : 'skill',
      productName: product.name,
      botUsername: req.user.username,
      accountId: req.user.accountId || null,
      unitPrice: 0,
    }).catch((err) => console.error('[marketplace/download/free] tx error:', err.message));
  }

  res.set('Content-Type', 'application/gzip');
  res.set('Content-Disposition', `attachment; filename="${product.file}"`);
  if (tarball.contentLength) res.set('Content-Length', String(tarball.contentLength));
  tarball.stream.pipe(res);
});

// ─── GET /api/marketplace/download/:token/:skillId ──────────────────────────
// Serves .tar.gz. Token must be valid and include this skill.
router.get('/marketplace/download/:token/:skillId', optionalAuth, async (req, res) => {
  try {
    const { token, skillId } = req.params;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.sk.includes(skillId)) {
      return res.status(403).json({ error: 'Skill not included in this purchase' });
    }

    const product = await findDownloadable(skillId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const r2Key = `${product.folder || 'skills'}/${product.file}`;
    let tarball;
    try {
      tarball = await getFile(r2Key);
    } catch {
      return res.status(404).json({ error: 'Product file not available' });
    }

    if (req.user) {
      recordTransaction({
        productId: product.id,
        productType: product.type === 'blueprint' ? 'blueprint' : 'skill',
        productName: product.name,
        botUsername: req.user.username,
        accountId: req.user.accountId || null,
        unitPrice: product.price,
      }).catch((err) => console.error('[marketplace/download] tx error:', err.message));
    }

    res.set('Content-Type', 'application/gzip');
    res.set('Content-Disposition', `attachment; filename="${product.file}"`);
    if (tarball.contentLength) res.set('Content-Length', String(tarball.contentLength));
    tarball.stream.pipe(res);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Download link expired or invalid — redeem the code again for a fresh link' });
    }
    console.error('[marketplace/download]', error.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ─── GET /api/marketplace/products ──────────────────────────────────────────
// Public product catalog (JSON). Enriches skills with free flag + direct download URL.
router.get('/marketplace/products', async (req, res) => {
  try {
    const catalog = await getLiveCatalog();

    const baseUrl = process.env.RELAY_DOMAIN
      ? `https://${process.env.RELAY_DOMAIN}`
      : `${req.protocol}://${req.get('host')}`;

    const enrichProduct = (p) => ({
      ...p,
      free: p.price === 0,
      ...(p.price === 0 && {
        download_url: `${baseUrl}/api/marketplace/download/free/${p.id}`,
      }),
    });

    res.json({
      skills: catalog.skills.map(enrichProduct),
      blueprints: catalog.blueprints.map(enrichProduct),
      bundles: catalog.bundles,
      services: catalog.services,
    });
  } catch (error) {
    console.error('[marketplace/products]', error.message);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

// ─── GET /api/marketplace/balance ────────────────────────────────────────────
// Returns the user's credit balance.
router.get('/marketplace/balance', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
      { projection: { balance: 1 } },
    );
    res.json({ balance: account?.balance || 0 });
  } catch (error) {
    console.error('[marketplace/balance]', error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ─── GET /api/marketplace/balance/bot ───────────────────────────────────────
// Bot queries its owner's credit balance. Requires bot auth + claimed status.
router.get('/marketplace/balance/bot', authenticate, async (req, res) => {
  try {
    if (!req.user.accountId) {
      return res.status(403).json({ error: 'Not claimed — no linked account' });
    }

    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.user.accountId) },
      { projection: { balance: 1 } },
    );

    if (!account) {
      return res.status(404).json({ error: 'Linked account not found' });
    }

    res.json({ balance: account.balance || 0 });
  } catch (error) {
    console.error('[marketplace/balance/bot]', error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ─── GET /api/marketplace/transactions ──────────────────────────────────────
// Dashboard: merges human purchases + bot transactions into a unified history.
router.get('/marketplace/transactions', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const id = req.account.id;
    const accountFilter = { $in: [id, new ObjectId(id)] };

    // Bot-side: skill downloads and service usage
    const botTx = await db
      .collection('transactions')
      .find({ accountId: accountFilter })
      .sort({ lastAt: -1 })
      .toArray();

    // Human-side: marketplace purchases
    const purchases = await db
      .collection('purchases')
      .find({ accountId: accountFilter })
      .sort({ createdAt: -1 })
      .toArray();

    // Pre-fetch all products into a lookup map (avoids N+1 queries)
    const allProducts = await db.collection('products').find({}).toArray();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Map purchases to the same shape as transactions, with expanded items
    const purchaseTx = purchases.map((p) => {
      const creditItems = p.cartItems.filter((i) => i.type === 'credit');
      const productCartItems = p.cartItems.filter((i) => i.type !== 'credit');
      const creditTotal = creditItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const isCreditOnly = productCartItems.length === 0 && creditItems.length > 0;

      const cartNames = productCartItems.map((item) => {
        const prod = productMap.get(item.id);
        return prod ? prod.name : item.id;
      });

      if (isCreditOnly) {
        return {
          productId: p.code,
          productType: 'credit',
          productName: `$${creditTotal.toFixed(2)} Credits`,
          botUsername: null,
          accountId: id,
          unitPrice: creditTotal,
          totalSpent: creditTotal,
          usageCount: 1,
          firstAt: p.createdAt,
          lastAt: p.createdAt,
          source: 'purchase',
        };
      }

      const items = (p.resolvedSkills || []).map((skillId) => {
        const product = productMap.get(skillId);
        return {
          id: skillId,
          type: product ? product.type : 'skill',
          name: product ? product.name : skillId,
          price: product ? product.price : 0,
        };
      });

      const productName = cartNames.join(' + ') + (creditTotal > 0 ? ` + $${creditTotal.toFixed(2)} Credits` : '');

      return {
        productId: p.code,
        productType: productCartItems.length === 1 ? productCartItems[0].type : 'bundle',
        productName,
        botUsername: null,
        accountId: id,
        unitPrice: p.total,
        totalSpent: p.total,
        usageCount: 1,
        firstAt: p.createdAt,
        lastAt: p.createdAt,
        redeemCode: p.code,
        redeemed: p.redemptions.length > 0,
        items,
        source: 'purchase',
      };
    });

    // Tag bot transactions
    const tagged = botTx.map((tx) => ({ ...tx, source: 'bot' }));

    // Merge and sort by date descending
    const all = [...purchaseTx, ...tagged].sort(
      (a, b) => new Date(b.lastAt) - new Date(a.lastAt),
    );

    res.json(all);
  } catch (error) {
    console.error('[marketplace/transactions]', error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ─── POST /api/marketplace/submit ──────────────────────────────────────────
// Claimed bots from verified accounts submit skill/blueprint tarballs.
// The tarball is uploaded to R2 and a product entry with status "pending"
// is created in MongoDB.
const MAX_TARBALL_SIZE = 200 * 1024 * 1024; // 200 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TARBALL_SIZE },
});

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

router.post(
  '/marketplace/submit',
  authenticate,
  marketplaceSubmitLimiter,
  upload.single('tarball'),
  async (req, res) => {
    try {
      // ── Auth checks ──────────────────────────────────────────────────
      if (!req.user.accountId) {
        return res.status(403).json({ error: 'Bot must be claimed to submit products' });
      }

      const db = getDb();
      const account = await db.collection('accounts').findOne(
        { _id: new ObjectId(req.user.accountId) },
        { projection: { verified: 1, name: 1 } },
      );

      if (!account) {
        return res.status(403).json({ error: 'Linked account not found' });
      }
      if (!account.verified) {
        return res.status(403).json({ error: 'Account must be verified to submit products' });
      }

      // ── Wallet check (commission payouts target this) ───────────────
      if (!req.user.walletAddress) {
        return res.status(400).json({
          error: 'Register a wallet before submitting products. Run `bloby init` (or top up your wallet from the dashboard) so the relay knows where to send your commission payouts.',
        });
      }

      // ── File check ───────────────────────────────────────────────────
      if (!req.file) {
        return res.status(400).json({ error: 'Missing tarball file. Send as multipart field "tarball".' });
      }
      if (!req.file.originalname.endsWith('.tar.gz')) {
        return res.status(400).json({ error: 'File must be a .tar.gz archive' });
      }

      // ── Type & name ──────────────────────────────────────────────────
      const type = req.body.type;
      if (!type || !['skill', 'blueprint'].includes(type)) {
        return res.status(400).json({ error: 'Field "type" is required and must be "skill" or "blueprint".' });
      }

      const name = req.body.name;
      if (!name || !NAME_RE.test(name)) {
        return res.status(400).json({
          error: 'Field "name" is required and must be lowercase-hyphenated (e.g., "my-cool-skill").',
        });
      }

      const { description, long_description, version } = req.body;
      if (!description) {
        return res.status(400).json({ error: 'Field "description" is required.' });
      }
      if (!long_description) {
        return res.status(400).json({ error: 'Field "long_description" is required.' });
      }
      if (!version) {
        return res.status(400).json({ error: 'Field "version" is required (semver, e.g., "1.0.0").' });
      }

      // ── Determine key (handle collisions with _1, _2, etc.) ────────
      const folder = type === 'blueprint' ? 'blueprints' : 'skills';

      let filename = `${name}.tar.gz`;
      let suffix = 0;
      const col = db.collection('products');
      while (await col.findOne({ file: filename, folder })) {
        suffix++;
        filename = `${name}_${suffix}.tar.gz`;
      }

      // ── Upload tarball to R2 ─────────────────────────────────────────
      const r2Key = `${folder}/${filename}`;
      await r2Upload(r2Key, req.file.buffer);

      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

      // ── Create pending product entry ─────────────────────────────────
      // Display name: derive from name (e.g., "my-cool-skill" → "My Cool Skill")
      const displayName = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const submission = {
        id: suffix > 0 ? `${name}_${suffix}` : name,
        name: displayName,
        version,
        vendor: req.user.username,
        bloby_human: account.name || '',
        bloby: req.user.username,
        description,
        longDescription: long_description,
        type,
        depends: [],
        has_telemetry: false,
        price: 0,
        file: filename,
        folder,
        sha256,
        tags: [],
        categories: [],
        featured: false,
        popular: false,
        status: 'pending',
        submittedBy: {
          botUsername: req.user.username,
          accountId: req.user.accountId.toString(),
          accountName: account.name || '',
        },
        submittedAt: new Date(),
        createdAt: new Date().toISOString().split('T')[0],
      };

      await db.collection('products').insertOne(submission);

      console.log(`[marketplace/submit] ${req.user.username} submitted ${type} "${name}" → ${folder}/${filename}`);

      res.status(201).json({
        message: 'Submission received. It will be reviewed and approved manually.',
        id: submission.id,
        file: filename,
        status: 'pending',
      });
    } catch (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum is ${MAX_TARBALL_SIZE / (1024 * 1024)}MB.` });
      }
      console.error('[marketplace/submit]', error.message);
      res.status(500).json({ error: 'Submission failed' });
    }
  },
);

// ─── GET /api/marketplace.md ────────────────────────────────────────────────
// Agent-readable markdown catalog with download and redeem instructions.
// Product listings are generated dynamically from MongoDB.
router.get('/marketplace.md', async (_req, res) => {
  try {
    const md = await buildMarketplaceMd();
    res.type('text/markdown').send(md);
  } catch (err) {
    console.error('[marketplace.md]', err.message);
    res.status(500).type('text/plain').send('Failed to generate marketplace guide');
  }
});

// ─── GET /api/marketplace/docs/:type ───────────────────────────────────────
// Public — serves the marketplace docs (SKILLS.md / BLUEPRINTS.md).
// Any agent can read these to learn how to build and submit products.
const docsMap = { skills: 'SKILLS.md', blueprints: 'BLUEPRINTS.md' };

router.get('/marketplace/docs/:type', (req, res) => {
  const file = docsMap[req.params.type];
  if (!file) {
    return res.status(404).json({ error: 'Unknown doc type. Use "skills" or "blueprints".' });
  }
  res.type('text/markdown').sendFile(path.join(staticDir, 'marketplace_docs', file));
});

export default router;
