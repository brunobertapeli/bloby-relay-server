import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { optionalAuth } from '../middleware/auth.js';
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
      } else {
        const skill = catalog.skills.find((s) => s.id === item.id);
        total += skill.price;
      }
    }

    const code = generateRedeemCode();
    const now = new Date();

    const db = getDb();
    await db.collection('purchases').insertOne({
      code,
      accountId: req.account.id,
      cartItems: items,
      resolvedSkills,
      total,
      createdAt: now,
      redemptions: [],
    });

    // Build response with item details for the frontend
    const itemDetails = items.map((item) => {
      if (item.type === 'bundle') {
        const bundle = catalog.bundles.find((b) => b.id === item.id);
        return { id: bundle.id, type: 'bundle', name: bundle.name, price: bundle.price };
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
      // Build summary name from cart items
      const cartNames = p.cartItems.map((item) => {
        if (item.type === 'bundle') {
          const bundle = catalog.bundles.find((b) => b.id === item.id);
          return bundle ? bundle.name : item.id;
        }
        const skill = catalog.skills.find((s) => s.id === item.id);
        return skill ? skill.name : item.id;
      });

      // Build detailed items list from resolved skills
      const items = p.resolvedSkills.map((skillId) => {
        const skill = catalog.skills.find((s) => s.id === skillId);
        return {
          id: skillId,
          type: 'skill',
          name: skill ? skill.name : skillId,
          price: skill ? skill.price : 0,
        };
      });

      return {
        productId: p.code,
        productType: p.cartItems.length === 1 ? p.cartItems[0].type : 'bundle',
        productName: cartNames.join(' + '),
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
