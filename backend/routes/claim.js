import { Router } from 'express';
import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { createPublicClient, http, formatUnits } from 'viem';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate } from '../middleware/auth.js';
import { claimVerifyLimiter, claimGenerateLimiter } from '../middleware/rateLimiter.js';
import { buildRelayUrl } from '../lib/validate.js';

const tempo = {
  id: 4217,
  name: 'Tempo',
  nativeCurrency: { name: 'TEMPO', symbol: 'TEMPO', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.tempo.xyz'] } },
};

const tempoClient = createPublicClient({
  chain: tempo,
  transport: http('https://rpc.tempo.xyz'),
});

const USDC_ADDRESS = '0x20c000000000000000000000b9537d11c60e8b50';
const USDC_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}];

async function getUsdcBalance(walletAddress) {
  try {
    const balance = await tempoClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    return formatUnits(balance, 6);
  } catch (err) {
    console.error('[balance] Failed for', walletAddress, err.message);
    return '0';
  }
}

const router = Router();

const CLAIM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLAIM_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateClaimCode() {
  const bytes = crypto.randomBytes(16);
  const code = Array.from(bytes)
    .map((b) => CLAIM_CHARS[b % CLAIM_CHARS.length])
    .join('');
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

/**
 * POST /api/claim/generate
 *
 * Dashboard user generates a claim code to link a self-hosted Fluxy.
 * Invalidates any existing pending claims for this account.
 *
 * JWT auth required.
 * Returns: { code, expiresAt }
 */
router.post('/claim/generate', jwtAuth, claimGenerateLimiter, async (req, res) => {
  try {
    const db = getDb();
    const accountId = new ObjectId(req.account.id);

    // Invalidate any existing pending claims for this account
    await db.collection('claims').updateMany(
      { accountId, claimedAt: null },
      { $set: { expiresAt: new Date() } },
    );

    const code = generateClaimCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS);

    await db.collection('claims').insertOne({
      code,
      accountId,
      createdAt: now,
      expiresAt,
      claimedBy: null,
      claimedAt: null,
    });

    res.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('[claim/generate]', error.message);
    res.status(500).json({ error: 'Failed to generate claim code' });
  }
});

/**
 * POST /api/claim/verify
 *
 * Bot verifies a claim code to link itself to a dashboard account.
 * The bot authenticates with its relay bearer token.
 *
 * Bearer token auth required.
 * Body:    { code: string }
 * Returns: { success, message }
 */
router.post('/claim/verify', authenticate, claimVerifyLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Claim code is required' });
    }

    const db = getDb();
    const now = new Date();

    // Find valid, unexpired, unclaimed code
    const claim = await db.collection('claims').findOne({
      code: code.trim().toUpperCase(),
      expiresAt: { $gt: now },
      claimedAt: null,
    });

    if (!claim) {
      return res.status(404).json({ error: 'Invalid or expired claim code' });
    }

    // Link this bot to the dashboard account
    await getUsers().updateOne(
      { _id: req.user._id },
      { $set: { accountId: claim.accountId, updatedAt: now } },
    );

    // Mark claim as used
    await db.collection('claims').updateOne(
      { _id: claim._id },
      { $set: { claimedBy: { username: req.user.username, tier: req.user.tier }, claimedAt: now } },
    );

    res.json({ success: true, message: 'Linked to dashboard account' });
  } catch (error) {
    console.error('[claim/verify]', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/claim/status/:code
 *
 * Dashboard polls this to check if a claim code has been used.
 * Only returns claims belonging to the authenticated account.
 *
 * JWT auth required.
 * Returns: { claimed, expired?, fluxy?, claimedAt?, expiresAt? }
 */
router.get('/claim/status/:code', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const accountId = new ObjectId(req.account.id);

    const claim = await db.collection('claims').findOne({
      code: req.params.code.trim().toUpperCase(),
      accountId,
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim code not found' });
    }

    if (claim.claimedAt) {
      return res.json({
        claimed: true,
        fluxy: claim.claimedBy,
        claimedAt: claim.claimedAt.toISOString(),
      });
    }

    const expired = new Date() > claim.expiresAt;
    res.json({
      claimed: false,
      expired,
      expiresAt: claim.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[claim/status]', error.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

/**
 * GET /api/claim/fluxies
 *
 * Get all fluxies linked to this dashboard account.
 *
 * JWT auth required.
 * Returns: { fluxies: [{ id, name, url, tier, isOnline, lastSeen }] }
 */
router.get('/claim/fluxies', jwtAuth, async (req, res) => {
  try {
    const accountId = new ObjectId(req.account.id);

    const fluxies = await getUsers()
      .find({ accountId })
      .project({ username: 1, tier: 1, isOnline: 1, lastHeartbeat: 1, walletAddress: 1 })
      .toArray();

    const results = await Promise.all(
      fluxies.map(async (f) => {
        const balance = f.walletAddress ? await getUsdcBalance(f.walletAddress) : '0';
        return {
          id: f._id.toString(),
          name: f.username,
          url: buildRelayUrl(f.username, f.tier),
          tier: f.tier,
          isOnline: f.isOnline,
          lastSeen: f.lastHeartbeat?.toISOString() || null,
          walletAddress: f.walletAddress || null,
          balance,
        };
      }),
    );

    res.json({ fluxies: results });
  } catch (error) {
    console.error('[claim/fluxies]', error.message);
    res.status(500).json({ error: 'Failed to fetch fluxies' });
  }
});

export default router;
