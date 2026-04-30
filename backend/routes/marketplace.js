import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { recordTransaction } from '../lib/transactions.js';
import { upload as r2Upload, getFile } from '../lib/r2.js';
import multer from 'multer';
import { marketplaceCheckoutLimiter, marketplaceRedeemLimiter, marketplaceSubmitLimiter } from '../middleware/rateLimiter.js';

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
    lines.push('', '- **Purchase required.** Ask your human to buy from https://bloby.bot/marketplace and give you the redeem code, or use the bot checkout flow if you are claimed.');
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
    lines.push('', '- **Purchase required.** Ask your human to buy from https://bloby.bot/marketplace and give you the redeem code, or use the bot checkout flow if you are claimed.');
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
    lines.push('', '- **Purchase required.**');
  }
  return lines.join('\n');
}

function generateServiceSection(service) {
  const price = service.price > 0 ? `$${Number(service.price).toFixed(2)}/use` : 'Free';
  const lines = [`### ${service.name} — ${price}`, '', service.description || ''];

  lines.push('', `- **Version: ${service.version || '1.0.0'}**`);
  if (service.price > 0) {
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

// ─── POST /api/marketplace/checkout ─────────────────────────────────────────
// Dashboard user checks out. Payment is handled externally (Stripe / mocked).
// Creates a purchase record with a redeem code.
router.post('/marketplace/checkout', jwtAuth, marketplaceCheckoutLimiter, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const validationError = await validateCartItems(items);
    if (validationError) return res.status(400).json({ error: validationError });

    const resolvedSkills = await resolveSkills(items);
    const total = await calculateTotal(items);

    const creditItems = items.filter((i) => i.type === 'credit');
    const creditAmount = creditItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);

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

    if (creditAmount > 0) {
      await db.collection('accounts').updateOne(
        { _id: new ObjectId(req.account.id) },
        { $inc: { balance: creditAmount } },
      );
    }

    // Build response with item details for the frontend
    const itemDetails = [];
    for (const item of items) {
      if (item.type === 'credit') {
        itemDetails.push({ id: item.id, type: 'credit', name: `$${parseFloat(item.amount).toFixed(2)} Credits`, price: parseFloat(item.amount) });
      } else {
        const product = item.type === 'bundle' ? await findBundle(item.id) : await findDownloadable(item.id);
        if (product) itemDetails.push({ id: product.id, type: item.type, name: product.name, price: product.price });
      }
    }

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
        return res.status(402).json({ error: 'Insufficient credit balance' });
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

    // Record transactions for each product
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
