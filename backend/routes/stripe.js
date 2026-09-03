import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { launchInstance } from '../lib/aws.js';
import { provisionManagedInstance } from '../lib/provision.js';
import { cfConfigured } from '../lib/cloudflare.js';
import { validateUsername } from '../lib/validate.js';
import {
  findInstance, setInstance, markFailed, cancelSubscription, pauseInstance, resumeInstance,
  terminateManaged, STOPPED_STATUSES,
} from '../lib/lifecycle.js';

// After a subscription ends the box is STOPPED (not destroyed) for this long, so an
// accidental cancel or a lapsed card doesn't wipe the customer's workspace. The sweeper
// terminates it when the grace period is over.
const SUSPEND_GRACE_MS = parseInt(process.env.SUSPEND_GRACE_DAYS || '14', 10) * 24 * 60 * 60 * 1000;

// Instances in these statuses do NOT block their handle from being (re)used at checkout.
const INACTIVE_STATUSES = new Set(['terminated', 'failed', ...STOPPED_STATUSES]);

/**
 * Reserve a paid handle atomically. `handle_reservations` has a unique index, so two buyers
 * racing the same name can't both win: the second insert throws 11000. Returns true if this
 * call took the reservation, false if someone else already holds it.
 */
async function lockHandle(handle, accountId, source) {
  try {
    await getDb().collection('handle_reservations').insertOne({
      handle, accountId: new ObjectId(accountId), source, createdAt: new Date(),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

/** Subscription id from an Invoice across API versions (moved under `parent` in 2025-03-31). */
function invoiceSubscriptionId(invoice) {
  const s = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  return typeof s === 'string' ? s : s?.id || null;
}

// Lazy-init: env vars aren't available at import time (dotenv runs later in server.js)
let _stripe;
export function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export function getStripeFrontendUrl() {
  return process.env.STRIPE_REDIRECT_URL || `https://www.${process.env.RELAY_DOMAIN || 'morphyagent.com'}`;
}

const router = Router();

// When set (BILLING_DISABLED=1|true|yes), the managed checkout + handle reservation
// skip Stripe and provision/reserve directly — lets us exercise the whole
// purchase→provision→DNS→use loop with no payment. Reversible: unset to restore Stripe.
function billingDisabled() {
  const v = (process.env.BILLING_DISABLED || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function getConfig() {
  return {
    CALLBACK_BASE: process.env.CALLBACK_BASE_URL || `https://api.${process.env.RELAY_DOMAIN}`,
    // Stripe redirects must go to the canonical domain, not the Railway URL
    FRONTEND_URL: process.env.STRIPE_REDIRECT_URL || `https://www.${process.env.RELAY_DOMAIN || 'morphyagent.com'}`,
    PRICE_IDS: {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID,
    },
  };
}

// ─── Stripe instance for Crypto Onramp ─────────────────────────────────────
// Onramp lives in a separate Stripe account (Stripe doesn't allow Onramp +
// regular payments in the same account). The frontend's onramp publishable
// key MUST come from the same account as STRIPE_ONRAMP_SECRET_KEY here —
// account mismatch causes silent 400s on Stripe's session lookup.
function maskKey(k) {
  if (!k || k.length < 12) return '<invalid>';
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

let _stripeOnramp;
function getStripeOnramp() {
  if (!_stripeOnramp) {
    const onrampKey = process.env.STRIPE_ONRAMP_SECRET_KEY;
    const fallbackKey = process.env.STRIPE_SECRET_KEY;

    if (!onrampKey && process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_ONRAMP_SECRET_KEY is required in production. Onramp lives in a separate Stripe account from STRIPE_SECRET_KEY — do not share keys.');
    }

    const key = onrampKey || fallbackKey;
    if (!key) {
      throw new Error('Neither STRIPE_ONRAMP_SECRET_KEY nor STRIPE_SECRET_KEY is set');
    }

    if (!onrampKey) {
      console.warn('[onramp] WARNING: STRIPE_ONRAMP_SECRET_KEY not set — falling back to STRIPE_SECRET_KEY. This will fail on Stripe session lookup if the frontend publishable key is from a different account.');
    }

    console.log(`[onramp] init secret key src=${onrampKey ? 'STRIPE_ONRAMP_SECRET_KEY' : 'STRIPE_SECRET_KEY (fallback)'} prefix=${maskKey(key)}`);
    _stripeOnramp = new Stripe(key);
  }
  return _stripeOnramp;
}

// Cached account info for the onramp Stripe account — lets the frontend
// verify its publishable key targets the same account.
let _onrampAccountInfo;
async function getOnrampAccountInfo() {
  if (_onrampAccountInfo) return _onrampAccountInfo;
  const stripe = getStripeOnramp();
  const account = await stripe.accounts.retrieve();
  _onrampAccountInfo = {
    accountId: account.id,
    country: account.country,
    livemode: !!(process.env.STRIPE_ONRAMP_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_'),
    keyPrefix: maskKey(process.env.STRIPE_ONRAMP_SECRET_KEY || process.env.STRIPE_SECRET_KEY),
  };
  return _onrampAccountInfo;
}

// Custom resource for the Crypto Onramp API (not yet in the SDK)
const OnrampSessionResource = Stripe.StripeResource.extend({
  create: Stripe.StripeResource.method({
    method: 'POST',
    path: 'crypto/onramp_sessions',
  }),
});

// ─── GET /api/stripe/onramp/account ────────────────────────────────────────
// Lets the frontend verify that its publishable key matches the backend's
// onramp Stripe account. Logs a warning client-side if there's a mismatch.
router.get('/stripe/onramp/account', jwtAuth, async (req, res) => {
  try {
    const info = await getOnrampAccountInfo();
    res.json(info);
  } catch (error) {
    console.error('[onramp/account]', error.message);
    res.status(500).json({ error: 'Failed to fetch onramp account info' });
  }
});

// Networks Stripe Crypto Onramp currently supports for USDC funding.
// Tempo is intentionally rejected here until Stripe ships support for it.
const ONRAMP_SUPPORTED_NETWORKS = new Set(['base', 'ethereum', 'polygon', 'solana']);

// Stripe Onramp keys destination wallets by network, not VM family.
// `wallet_addresses[ethereum]` only prefills for the Ethereum L1 destination —
// Base, Polygon etc. need their own keys even though the address format is
// identical (same EVM address works on all three).
const NETWORK_TO_WALLET_KEY = {
  base: 'base_network',
  ethereum: 'ethereum',
  polygon: 'polygon',
  solana: 'solana',
};

// ─── Create Crypto Onramp Session (Fund Bot wallet) ────────────────────────
router.post('/stripe/onramp-session', jwtAuth, async (req, res) => {
  try {
    const { blobyId, amount, network = 'base' } = req.body;
    if (!blobyId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Missing blobyId or valid amount' });
    }

    if (network === 'tempo') {
      return res.status(400).json({ error: 'Tempo onramp is not yet supported by Stripe. Use Base for now.' });
    }
    if (!ONRAMP_SUPPORTED_NETWORKS.has(network)) {
      return res.status(400).json({ error: `Unsupported network: ${network}` });
    }

    const accountId = new ObjectId(req.account.id);
    const morphy = await getUsers().findOne({
      _id: new ObjectId(blobyId),
      accountId,
    });

    if (!morphy) {
      return res.status(404).json({ error: 'Morphy not found' });
    }
    if (!morphy.walletAddress) {
      return res.status(400).json({ error: 'Morphy has no wallet address' });
    }

    const stripe = getStripeOnramp();
    // Params live at the top level — the legacy `transaction_details` wrapper
    // is silently dropped by the current API. The Stripe Node SDK (20.x) no
    // longer ships onramp resources, so we hand-roll the request.
    // The legacy field `destination_exchange_amount` was renamed to
    // `destination_amount` (Stripe API version 2026-02-25.clover and later).
    const walletKey = NETWORK_TO_WALLET_KEY[network] || 'ethereum';
    const session = await new OnrampSessionResource(stripe).create({
      destination_currency: 'usdc',
      destination_network: network,
      destination_amount: String(amount),
      wallet_addresses: { [walletKey]: morphy.walletAddress },
      lock_wallet_address: true,
      customer_ip_address: req.ip,
    });

    console.log(`[onramp] session created id=${session.id} network=${network} amount=${amount} morphy=${morphy.username} dest_currency=${session.transaction_details?.destination_currency} dest_network=${session.transaction_details?.destination_network}`);
    res.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      redirectUrl: session.redirect_url || null,
    });
  } catch (error) {
    console.error('[stripe/onramp-session] error:', error.message, error.raw || '');
    res.status(500).json({ error: 'Failed to create onramp session' });
  }
});

// ─── Create Checkout Session ────────────────────────────────────────────────
// A managed instance is ALWAYS backed by one of the buyer's reserved handles
// (it becomes mybot.morphyagent.com). We validate ownership + that the handle is
// unused BEFORE charging, then either provision directly (billing disabled) or
// hand off to Stripe.
router.post('/stripe/checkout', jwtAuth, async (req, res) => {
  try {
    const { plan, region, username } = req.body;
    if (!plan || !region) {
      return res.status(400).json({ error: 'Missing plan or region' });
    }
    if (!['starter', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!['na', 'eu', 'br'].includes(region)) {
      return res.status(400).json({ error: 'Invalid region' });
    }

    // ── Reserved-handle gate ──────────────────────────────────────────────
    if (!username) {
      return res.status(400).json({ error: 'A reserved handle is required to start an instance' });
    }
    const uv = validateUsername(username);
    if (!uv.valid) return res.status(400).json({ error: uv.error });

    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
    );
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Must be one of the caller's reserved handles…
    const owns = (account.reservedHandles || []).some((h) => h.handle === uv.username);
    if (!owns) {
      return res.status(403).json({ error: 'You must reserve this handle before starting an instance' });
    }
    // …and not already in use (registered relay user or an active instance). A paused /
    // suspended / failed / terminated instance does not block the handle: re-subscribing to a
    // suspended one RESUMES it (see the webhook) instead of provisioning a second box.
    const activeInstance = (account.instances || []).some(
      (i) => i.username === uv.username && !INACTIVE_STATUSES.has(i.status),
    );
    const resumable = (account.instances || []).find(
      (i) => i.username === uv.username && STOPPED_STATUSES.has(i.status),
    );
    const registered = resumable ? null : await getUsers().findOne({ username: uv.username, tier: 'premium' });
    if (registered || activeInstance) {
      return res.status(409).json({ error: 'This handle already has a running instance' });
    }
    const chosenHandle = uv.username;

    // ── Stripe disconnected (testing): provision directly, no payment ──────
    if (billingDisabled()) {
      if (resumable) {
        resumeInstance(resumable).catch((e) => console.error('[stripe/checkout] resume failed:', e.message));
        return res.json({ bypass: true, instanceId: resumable.id, resumed: true });
      }
      const { instanceId } = await provisionManagedInstance({
        accountId: req.account.id, username: chosenHandle, plan, region, tier: 'premium',
      });
      console.log(`[stripe/checkout] BILLING_DISABLED → direct provision ${instanceId} (${chosenHandle})`);
      return res.json({ bypass: true, instanceId });
    }

    const { PRICE_IDS, FRONTEND_URL } = getConfig();
    const stripe = getStripe();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return res.status(500).json({ error: 'Price not configured for this plan' });
    }

    // Find or create Stripe customer
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { plan, region, accountId: req.account.id, ...(chosenHandle ? { username: chosenHandle } : {}) },
      },
      success_url: `${FRONTEND_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/checkout] error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ─── Create Portal Session ──────────────────────────────────────────────────
router.post('/stripe/portal', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
      { projection: { stripeCustomerId: 1 } },
    );

    if (!account?.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const stripe = getStripe();
    const { FRONTEND_URL } = getConfig();

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/portal] error:', error.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ─── Get instance by Checkout Session ID ────────────────────────────────────
router.get('/stripe/session/:sessionId', jwtAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
      expand: ['subscription'],
    });

    if (!session.subscription) {
      return res.status(404).json({ error: 'No subscription found for session' });
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id), 'instances.stripeSubscriptionId': subscriptionId },
      { projection: { 'instances.$': 1 } },
    );

    const instance = account?.instances?.[0];
    if (!instance) {
      return res.status(404).json({ error: 'Instance not yet created' });
    }

    res.json({ instance });
  } catch (error) {
    console.error('[stripe/session] error:', error.message);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

// ─── Handle Checkout (one-time payment) ─────────────────────────────────────
router.post('/stripe/handle-checkout', jwtAuth, async (req, res) => {
  try {
    const { handle } = req.body;
    const uv = validateUsername(handle);
    if (!uv.valid) {
      return res.status(400).json({ error: uv.error });
    }

    const db = getDb();

    // Check not already registered as premium user
    const existingUser = await getUsers().findOne({ username: uv.username, tier: 'premium' });
    if (existingUser) {
      return res.status(409).json({ error: 'Handle already registered' });
    }

    // Check not already reserved in any account's reservedHandles
    const existingReservation = await db.collection('accounts').findOne(
      { 'reservedHandles.handle': uv.username },
    );
    if (existingReservation) {
      return res.status(409).json({ error: 'Handle already reserved' });
    }

    // ── Stripe disconnected (testing): reserve the handle free, no payment ──
    if (billingDisabled()) {
      if (!(await lockHandle(uv.username, req.account.id, 'billing-disabled'))) {
        return res.status(409).json({ error: 'Handle already reserved' });
      }
      const hash = crypto.randomBytes(4).toString('base64url').slice(0, 5);
      await db.collection('accounts').updateOne(
        { _id: new ObjectId(req.account.id) },
        { $push: { reservedHandles: { handle: uv.username, hash, purchasedAt: new Date() } } },
      );
      console.log(`[stripe/handle-checkout] BILLING_DISABLED → reserved "${uv.username}" free`);
      return res.json({ bypass: true, reserved: true, handle: uv.username });
    }

    const stripe = getStripe();
    const { FRONTEND_URL } = getConfig();

    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
    );
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Find or create Stripe customer
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_HANDLE_PRICE_ID, quantity: 1 }],
      metadata: { handle: uv.username, accountId: req.account.id },
      success_url: `${FRONTEND_URL}?handle_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/handle-checkout] error:', error.message);
    res.status(500).json({ error: 'Failed to create handle checkout session' });
  }
});

// ─── Get Reserved Handles ───────────────────────────────────────────────────
// Each handle is annotated with `used` so the instance-purchase flow can offer
// only the handles that aren't already backing a bot. A handle is "used" once it
// has a live relay user (claimed self-hosted OR a managed instance pre-registered
// it) or sits on a non-terminated instance.
router.get('/stripe/handles', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
      { projection: { reservedHandles: 1, instances: 1 } },
    );
    const handles = account?.reservedHandles || [];
    const instances = account?.instances || [];
    const names = handles.map((h) => h.handle);
    const registered = names.length
      ? await getUsers()
          .find({ username: { $in: names }, tier: 'premium' }, { projection: { username: 1, kind: 1 } })
          .toArray()
      : [];
    const regSet = new Set(registered.map((u) => u.username));
    const managedSet = new Set(registered.filter((u) => u.kind === 'managed').map((u) => u.username));
    const annotated = handles.map((h) => {
      const onInstance = instances.find(
        (i) => i.username === h.handle && i.status !== 'terminated',
      );
      return {
        ...h,
        used: regSet.has(h.handle) || !!onInstance,
        // A handle backing a managed instance is auto-claimed — the dashboard hides the
        // activation-code UI for these (managed bots never use the morphy-init claim flow).
        managed: managedSet.has(h.handle) || !!onInstance,
        usedByInstanceId: onInstance?.id || null,
      };
    });
    res.json({ reservedHandles: annotated });
  } catch (error) {
    console.error('[stripe/handles] error:', error.message);
    res.status(500).json({ error: 'Failed to get reserved handles' });
  }
});

/** Instance backed by a Stripe subscription → { account, instance } or null. */
async function findInstanceBySubscription(subscriptionId) {
  const account = await getDb().collection('accounts').findOne(
    { 'instances.stripeSubscriptionId': subscriptionId },
    { projection: { _id: 1, 'instances.$': 1 } },
  );
  const instance = account?.instances?.[0];
  return instance ? { account, instance } : null;
}

// ─── Webhook handler (exported separately for raw body mounting) ────────────
export async function stripeWebhookHandler(req, res) {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`[stripe/webhook] ${event.type} ${event.id}`);

  // ── Idempotency: Stripe redelivers on any non-2xx / timeout. Process each event once. ──
  try {
    await getDb().collection('stripe_events').insertOne({ _id: event.id, type: event.type, receivedAt: new Date() });
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[stripe/webhook] duplicate delivery ${event.id} — skipped`);
      return res.json({ received: true, duplicate: true });
    }
    console.error('[stripe/webhook] event log failed (continuing):', err.message);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // ── One-time payments: dispatch on metadata.purpose ──
        if (session.mode === 'payment') {
          const { purpose, handle, accountId } = session.metadata || {};

          if (purpose === 'marketplace') {
            try {
              // Dynamic import avoids a circular-import edge case at module init.
              const { fulfillMarketplacePurchase } = await import('./marketplace.js');
              const result = await fulfillMarketplacePurchase(session.id);
              console.log(`[stripe/webhook] marketplace fulfilled session=${session.id} status=${result.status}`);
            } catch (err) {
              console.error('[stripe/webhook] marketplace fulfillment failed:', err.message);
            }
            break;
          }

          if (handle && accountId) {
            // Take the unique reservation lock BEFORE granting. Two buyers can both pass the
            // pre-checkout availability check; only one insert here succeeds. The loser is
            // refunded automatically instead of owning a handle they can never use.
            const won = await lockHandle(handle, accountId, `stripe:${session.id}`);
            if (!won) {
              console.warn(`[stripe/webhook] handle "${handle}" already reserved — refunding session ${session.id}`);
              try {
                const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
                if (pi) await getStripe().refunds.create({ payment_intent: pi, reason: 'duplicate' });
              } catch (err) {
                console.error(`[stripe/webhook] refund for duplicate handle "${handle}" FAILED (refund manually):`, err.message);
              }
              break;
            }
            const hash = crypto.randomBytes(4).toString('base64url').slice(0, 5);
            const db = getDb();
            await db.collection('accounts').updateOne(
              { _id: new ObjectId(accountId) },
              { $push: { reservedHandles: { handle, hash, purchasedAt: new Date() } } },
            );
            console.log(`[stripe/webhook] handle "${handle}" reserved for account ${accountId}`);
          }
          break;
        }

        if (session.mode !== 'subscription') break;

        const subscriptionId = session.subscription;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const { plan, region, accountId, username } = subscription.metadata;

        if (!plan || !region || !accountId) {
          console.error('[stripe/webhook] missing metadata on subscription:', subscriptionId);
          await cancelSubscription(subscriptionId, 'checkout metadata missing');
          break;
        }

        // ── MANAGED (direct) mode ──
        // When a handle was chosen at checkout, provision the box directly: it
        // gets a public IP + a per-bot CF DNS record (no tunnel). Falls back to
        // the legacy tunnel launch when no handle / CF isn't configured.
        if (username && cfConfigured()) {
          // Re-subscribing to a paused/suspended box (trial ended, card lapsed, cancelled and
          // came back within the grace period) RESUMES it — same workspace, same URL.
          const acct = await getDb().collection('accounts').findOne(
            { _id: new ObjectId(accountId) }, { projection: { instances: 1 } },
          );
          const resumable = (acct?.instances || []).find(
            (i) => i.username === username && STOPPED_STATUSES.has(i.status),
          );
          if (resumable) {
            await setInstance(resumable.id, { stripeSubscriptionId: subscriptionId, plan, cancelAt: null });
            console.log(`[stripe/webhook] resuming ${resumable.id} (${username}) on subscription ${subscriptionId}`);
            resumeInstance({ ...resumable, stripeSubscriptionId: subscriptionId })
              .catch((e) => console.error(`[stripe/webhook] resume ${resumable.id} failed:`, e.message));
            break;
          }

          try {
            const { instanceId } = await provisionManagedInstance({
              accountId, username, plan, region, tier: 'premium', stripeSubscriptionId: subscriptionId,
            });
            console.log(`[stripe/webhook] managed instance ${instanceId} (${username}) for account ${accountId}`);
          } catch (err) {
            // Nothing was created (handle taken, bad input): the customer must not keep paying.
            console.error(`[stripe/webhook] managed provision failed for ${username}:`, err.message);
            await cancelSubscription(subscriptionId, `provisioning failed: ${err.message}`);
            await getDb().collection('accounts').updateOne(
              { _id: new ObjectId(accountId) },
              { $set: { lastProvisionError: { username, error: err.message, at: new Date() } } },
            );
          }
          break;
        }

        const db = getDb();
        const id = new ObjectId().toString();
        const { CALLBACK_BASE } = getConfig();
        const callbackUrl = `${CALLBACK_BASE}/api/instances/callback`;

        const instance = {
          id,
          plan,
          region,
          ec2InstanceId: null,
          tunnelUrl: null,
          status: 'launching',
          stripeSubscriptionId: subscriptionId,
          cancelAt: null,
          createdAt: new Date(),
        };

        await db.collection('accounts').updateOne(
          { _id: new ObjectId(accountId) },
          { $push: { instances: instance } },
        );

        console.log(`[stripe/webhook] created instance ${id} for account ${accountId}`);

        // Launch EC2 asynchronously
        launchInstance({ instanceId: id, plan, region, callbackUrl })
          .then(async ({ ec2InstanceId }) => {
            await db.collection('accounts').updateOne(
              { 'instances.id': id },
              { $set: {
                'instances.$.ec2InstanceId': ec2InstanceId,
                'instances.$.status': 'booting',
              }},
            );
            console.log(`[stripe/webhook] ${id} → EC2 ${ec2InstanceId} launched`);
          })
          .catch(async (err) => {
            console.error(`[stripe/webhook] ${id} launch failed:`, err.message);
            await markFailed(id, `Launch failed: ${err.message}`, { instance });
          });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        if (!subscription.metadata?.accountId) break;
        const prev = event.data.previous_attributes || {};
        const found = await findInstanceBySubscription(subscription.id);
        if (!found) break;
        const { instance } = found;

        // Stripe-run pause (e.g. a card-less trial that ended with end_behavior 'pause').
        if (subscription.status === 'paused') {
          await pauseInstance(instance, { status: 'paused', reason: 'subscription paused' });
          break;
        }
        if (prev.status === 'paused' && subscription.status === 'active') {
          resumeInstance(instance).catch((e) => console.error('[stripe/webhook] resume failed:', e.message));
          break;
        }

        // Only react when cancel_at_period_end actually changed. Stripe emits this event on every
        // renewal invoice, payment-method change, trial transition and metadata edit — none of
        // those may touch a box that is restarting / provisioning / failed.
        if (!('cancel_at_period_end' in prev)) break;

        if (subscription.cancel_at_period_end) {
          // `current_period_end` moved to subscription ITEMS in API 2025-03-31; `cancel_at` is set
          // by Stripe whenever cancel_at_period_end is true and is the authoritative date.
          const endSec = subscription.cancel_at || subscription.items?.data?.[0]?.current_period_end;
          const cancelAt = endSec ? new Date(endSec * 1000) : null;
          const set = { cancelAt };
          if (instance.status === 'ready') set.status = 'canceling';
          await setInstance(instance.id, set);
          console.log(`[stripe/webhook] subscription ${subscription.id} marked canceling (ends ${cancelAt ? cancelAt.toISOString() : 'unknown'})`);
        } else {
          // User un-canceled: only canceling → ready; every other status is left alone.
          await getDb().collection('accounts').updateOne(
            { instances: { $elemMatch: { id: instance.id, status: 'canceling' } } },
            { $set: { 'instances.$.status': 'ready' } },
          );
          await setInstance(instance.id, { cancelAt: null });
          console.log(`[stripe/webhook] subscription ${subscription.id} reactivated`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const found = await findInstanceBySubscription(subscription.id);
        const instance = found?.instance;
        if (!instance) {
          console.log(`[stripe/webhook] subscription ${subscription.id} deleted — no instance`);
          break;
        }

        // Don't destroy the customer's workspace the second the subscription ends: STOP the box
        // and keep it (EBS only) for a grace period. Re-subscribing to the same handle resumes it;
        // the sweeper terminates it (and frees the handle) once `terminateAt` passes.
        if (instance.ec2InstanceId && !INACTIVE_STATUSES.has(instance.status)) {
          const terminateAt = new Date(Date.now() + SUSPEND_GRACE_MS);
          const paused = await pauseInstance(instance, { status: 'suspended', reason: 'subscription ended', terminateAt });
          if (paused) {
            await setInstance(instance.id, { cancelAt: null });
            console.log(`[stripe/webhook] subscription ${subscription.id} deleted → ${instance.id} suspended until ${terminateAt.toISOString()}`);
            break;
          }
        }
        // Nothing running to keep (never launched / already stopped-and-failed): terminate now.
        await terminateManaged(instance);
        console.log(`[stripe/webhook] subscription ${subscription.id} deleted → ${instance.id} terminated`);
        break;
      }

      // ── Dunning ──────────────────────────────────────────────────────────
      // A card that keeps failing must not keep a box running for weeks. After Stripe's second
      // failed attempt the box is paused (stopped, DNS removed); the next successful invoice
      // resumes it. Stripe's own retries + emails continue in parallel.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId || (invoice.attempt_count || 0) < 2) break;
        const found = await findInstanceBySubscription(subId);
        if (!found) break;
        await pauseInstance(found.instance, { status: 'paused', reason: `payment failed (${invoice.attempt_count} attempts)` });
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) break;
        const found = await findInstanceBySubscription(subId);
        const inst = found?.instance;
        if (inst?.status === 'paused' && /payment failed/.test(inst.pauseReason || '')) {
          resumeInstance(inst).catch((e) => console.error('[stripe/webhook] resume after payment failed:', e.message));
        }
        break;
      }
    }
  } catch (error) {
    console.error('[stripe/webhook] handler error:', error.message);
  }

  // Always return 200 to acknowledge receipt
  res.json({ received: true });
}

export default router;
