import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { marketplaceCheckoutLimiter, marketplaceRedeemLimiter } from '../middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// ─── Product catalog ────────────────────────────────────────────────────────
const productsPath = path.join(__dirname, '..', 'data', 'products.json');
const catalog = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

// Lookup across skills and blueprints (both are downloadable products)
function findDownloadable(id) {
  return catalog.skills.find((s) => s.id === id)
    || (catalog.blueprints || []).find((b) => b.id === id);
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
 * Bundles are expanded to their individual skills.
 * Dependencies are included automatically.
 */
/**
 * Resolve cart items to a deduplicated list of skill IDs.
 * Bundles expand to their listed skills. Individual skills resolve to themselves only.
 * Dependencies are NOT auto-included — bundles are the packaging mechanism.
 * The skill's SKILL.md documents what dependencies are needed.
 */
function resolveSkills(items) {
  const skillIds = new Set();

  for (const item of items) {
    if (item.type === 'bundle') {
      const bundle = catalog.bundles.find((b) => b.id === item.id);
      if (bundle) bundle.skills.forEach((id) => skillIds.add(id));
    } else if (item.type === 'skill') {
      const skill = catalog.skills.find((s) => s.id === item.id);
      if (skill) skillIds.add(skill.id);
    } else if (item.type === 'blueprint') {
      const bp = (catalog.blueprints || []).find((b) => b.id === item.id);
      if (bp) skillIds.add(bp.id);
    }
  }

  return [...skillIds];
}

// ─── POST /api/marketplace/checkout ─────────────────────────────────────────
// Dashboard user checks out. Payment is handled externally (Stripe / mocked).
// Creates a purchase record with a redeem code.
router.post('/marketplace/checkout', jwtAuth, marketplaceCheckoutLimiter, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate all items exist
    for (const item of items) {
      if (item.type === 'bundle') {
        if (!catalog.bundles.find((b) => b.id === item.id)) {
          return res.status(400).json({ error: `Unknown bundle: ${item.id}` });
        }
      } else if (item.type === 'skill') {
        if (!catalog.skills.find((s) => s.id === item.id)) {
          return res.status(400).json({ error: `Unknown skill: ${item.id}` });
        }
      } else if (item.type === 'blueprint') {
        if (!(catalog.blueprints || []).find((b) => b.id === item.id)) {
          return res.status(400).json({ error: `Unknown blueprint: ${item.id}` });
        }
      } else if (item.type === 'credit') {
        const amount = parseFloat(item.amount);
        if (!amount || amount < 1) {
          return res.status(400).json({ error: 'Credit amount must be at least $1' });
        }
      } else {
        return res.status(400).json({ error: `Invalid item type: ${item.type}` });
      }
    }

    const resolvedSkills = resolveSkills(items);

    // Calculate total from cart line items
    let total = 0;
    for (const item of items) {
      if (item.type === 'bundle') {
        const bundle = catalog.bundles.find((b) => b.id === item.id);
        total += bundle.price;
      } else if (item.type === 'blueprint') {
        const bp = (catalog.blueprints || []).find((b) => b.id === item.id);
        total += bp.price;
      } else if (item.type === 'credit') {
        total += parseFloat(item.amount);
      } else {
        const skill = catalog.skills.find((s) => s.id === item.id);
        total += skill.price;
      }
    }

    // Separate credit items from product items
    const creditItems = items.filter((i) => i.type === 'credit');
    const productItems = items.filter((i) => i.type !== 'credit');
    const creditAmount = creditItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);

    const code = generateRedeemCode();
    const now = new Date();
    const db = getDb();

    // Create purchase record (for product items, or credit-only)
    await db.collection('purchases').insertOne({
      code,
      accountId: req.account.id,
      cartItems: items,
      resolvedSkills,
      total,
      createdAt: now,
      redemptions: [],
    });

    // Add credits to account balance
    if (creditAmount > 0) {
      await db.collection('accounts').updateOne(
        { _id: new ObjectId(req.account.id) },
        { $inc: { balance: creditAmount } },
      );
    }

    // Build response with item details for the frontend
    const itemDetails = items.map((item) => {
      if (item.type === 'bundle') {
        const bundle = catalog.bundles.find((b) => b.id === item.id);
        return { id: bundle.id, type: 'bundle', name: bundle.name, price: bundle.price };
      }
      if (item.type === 'blueprint') {
        const bp = (catalog.blueprints || []).find((b) => b.id === item.id);
        return { id: bp.id, type: 'blueprint', name: bp.name, price: bp.price };
      }
      if (item.type === 'credit') {
        return { id: item.id, type: 'credit', name: `$${parseFloat(item.amount).toFixed(2)} Credits`, price: parseFloat(item.amount) };
      }
      const skill = catalog.skills.find((s) => s.id === item.id);
      return { id: skill.id, type: 'skill', name: skill.name, price: skill.price };
    });

    res.json({ code, items: itemDetails, resolvedSkills, total });
  } catch (error) {
    console.error('[marketplace/checkout]', error.message);
    res.status(500).json({ error: 'Checkout failed' });
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

    // Only product items — bots don't buy credits
    for (const item of items) {
      if (item.type === 'bundle') {
        if (!catalog.bundles.find((b) => b.id === item.id)) {
          return res.status(400).json({ error: `Unknown bundle: ${item.id}` });
        }
      } else if (item.type === 'skill') {
        if (!catalog.skills.find((s) => s.id === item.id)) {
          return res.status(400).json({ error: `Unknown skill: ${item.id}` });
        }
      } else if (item.type === 'blueprint') {
        if (!(catalog.blueprints || []).find((b) => b.id === item.id)) {
          return res.status(400).json({ error: `Unknown blueprint: ${item.id}` });
        }
      } else {
        return res.status(400).json({ error: `Invalid item type: ${item.type}` });
      }
    }

    const resolvedSkills = resolveSkills(items);

    // Calculate total
    let total = 0;
    for (const item of items) {
      if (item.type === 'bundle') {
        total += catalog.bundles.find((b) => b.id === item.id).price;
      } else if (item.type === 'blueprint') {
        total += (catalog.blueprints || []).find((b) => b.id === item.id).price;
      } else {
        total += catalog.skills.find((s) => s.id === item.id).price;
      }
    }

    const db = getDb();
    const accountId = new ObjectId(req.user.accountId);

    // Atomic balance deduction — prevents overdraft and race conditions
    if (total > 0) {
      const result = await db.collection('accounts').updateOne(
        { _id: accountId, balance: { $gte: total } },
        { $inc: { balance: -total } },
      );
      if (result.modifiedCount === 0) {
        return res.status(402).json({ error: 'Insufficient credit balance' });
      }
    }

    // Create purchase record
    const code = generateRedeemCode();
    const now = new Date();
    const purchase = {
      code,
      accountId: req.user.accountId.toString(),
      botUsername: req.user.username,
      cartItems: items,
      resolvedSkills,
      total,
      createdAt: now,
      redemptions: [{ at: now, bot: req.user.username }],
    };
    await db.collection('purchases').insertOne(purchase);

    // Record transactions for each product
    for (const skillId of resolvedSkills) {
      const product = findDownloadable(skillId);
      if (product) {
        const isBlueprint = (catalog.blueprints || []).some((b) => b.id === skillId);
        recordTransaction({
          productId: product.id,
          productType: isBlueprint ? 'blueprint' : 'skill',
          productName: product.name,
          botUsername: req.user.username,
          accountId: req.user.accountId.toString(),
          unitPrice: product.price,
        }).catch((err) => console.error('[marketplace/checkout/bot] tx error:', err.message));
      }
    }

    // Generate download token and return URLs directly
    const downloadToken = jwt.sign(
      { pc: code, sk: resolvedSkills },
      process.env.JWT_SECRET,
      { expiresIn: DOWNLOAD_TOKEN_TTL },
    );

    const baseUrl = process.env.RELAY_DOMAIN
      ? `https://${process.env.RELAY_DOMAIN}`
      : `http://localhost:${process.env.PORT || 4000}`;

    const skills = resolvedSkills.map((skillId) => {
      const product = findDownloadable(skillId);
      return {
        name: product.id,
        version: product.version,
        url: `${baseUrl}/api/marketplace/download/${downloadToken}/${product.id}`,
        sha256: product.sha256,
      };
    });

    // Fetch remaining balance after deduction
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

  const skills = purchase.resolvedSkills.map((skillId) => {
    const skill = catalog.skills.find((s) => s.id === skillId);
    return {
      name: skill.id,
      version: skill.version,
      url: `${baseUrl}/api/marketplace/download/${downloadToken}/${skill.id}`,
      sha256: skill.sha256,
    };
  });

  res.json({ skills });
}

// ─── GET /api/marketplace/download/free/:skillId ────────────────────────────
// Direct download for free skills/blueprints. Optional bot auth to record the transaction.
// IMPORTANT: Must be registered BEFORE the :token/:skillId route,
// otherwise Express matches "free" as a token parameter.
router.get('/marketplace/download/free/:skillId', optionalAuth, (req, res) => {
  const { skillId } = req.params;

  const product = findDownloadable(skillId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.price > 0) {
    return res.status(402).json({ error: 'This product requires purchase' });
  }

  const filePath = path.join(__dirname, '..', 'static', 'skills', product.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Product file not available' });
  }

  // Record transaction if bot identified itself
  if (req.user) {
    const isBlueprint = (catalog.blueprints || []).some((b) => b.id === skillId);
    recordTransaction({
      productId: product.id,
      productType: isBlueprint ? 'blueprint' : 'skill',
      productName: product.name,
      botUsername: req.user.username,
      accountId: req.user.accountId || null,
      unitPrice: 0,
    }).catch((err) => console.error('[marketplace/download/free] tx error:', err.message));
  }

  res.download(filePath, product.file);
});

// ─── GET /api/marketplace/download/:token/:skillId ──────────────────────────
// Serves .tar.gz. Token must be valid and include this skill.
router.get('/marketplace/download/:token/:skillId', optionalAuth, (req, res) => {
  try {
    const { token, skillId } = req.params;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.sk.includes(skillId)) {
      return res.status(403).json({ error: 'Skill not included in this purchase' });
    }

    const product = findDownloadable(skillId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const filePath = path.join(__dirname, '..', 'static', 'skills', product.file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Product file not available' });
    }

    // Record transaction if bot identified itself
    if (req.user) {
      const isBlueprint = (catalog.blueprints || []).some((b) => b.id === skillId);
      recordTransaction({
        productId: product.id,
        productType: isBlueprint ? 'blueprint' : 'skill',
        productName: product.name,
        botUsername: req.user.username,
        accountId: req.user.accountId || null,
        unitPrice: product.price,
      }).catch((err) => console.error('[marketplace/download] tx error:', err.message));
    }

    res.download(filePath, product.file);
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
router.get('/marketplace/products', (req, res) => {
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

  const enriched = {
    ...catalog,
    skills: catalog.skills.map(enrichProduct),
    blueprints: (catalog.blueprints || []).map(enrichProduct),
  };

  res.json(enriched);
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

    // Map purchases to the same shape as transactions, with expanded items
    const purchaseTx = purchases.map((p) => {
      const creditItems = p.cartItems.filter((i) => i.type === 'credit');
      const productCartItems = p.cartItems.filter((i) => i.type !== 'credit');
      const creditTotal = creditItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const isCreditOnly = productCartItems.length === 0 && creditItems.length > 0;

      // Build summary name from cart items
      const cartNames = productCartItems.map((item) => {
        if (item.type === 'bundle') {
          const bundle = catalog.bundles.find((b) => b.id === item.id);
          return bundle ? bundle.name : item.id;
        }
        if (item.type === 'blueprint') {
          const bp = (catalog.blueprints || []).find((b) => b.id === item.id);
          return bp ? bp.name : item.id;
        }
        const skill = catalog.skills.find((s) => s.id === item.id);
        return skill ? skill.name : item.id;
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

      // Build detailed items list from resolved skills
      const items = p.resolvedSkills.map((skillId) => {
        const product = findDownloadable(skillId);
        return {
          id: skillId,
          type: product ? ((catalog.blueprints || []).some((b) => b.id === skillId) ? 'blueprint' : 'skill') : 'skill',
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

// ─── GET /api/marketplace.md ────────────────────────────────────────────────
// Agent-readable markdown catalog with download and redeem instructions.
router.get('/marketplace.md', (_req, res) => {
  const mdPath = path.join(__dirname, '..', 'static', 'marketplace.md');
  res.type('text/markdown').sendFile(mdPath);
});

export default router;
