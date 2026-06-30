import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { launchInstance, terminateInstance } from '../lib/aws.js';
import { provisionManagedInstance } from '../lib/provision.js';
import { deleteDnsRecord, cfConfigured } from '../lib/cloudflare.js';
import { validateUsername } from '../lib/validate.js';

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
    // …and not already in use (registered relay user or an active instance).
    const registered = await getUsers().findOne({ username: uv.username, tier: 'premium' });
    const activeInstance = (account.instances || []).some(
      (i) => i.username === uv.username && i.status !== 'terminated',
    );
    if (registered || activeInstance) {
      return res.status(409).json({ error: 'This handle already has a running instance' });
    }
    const chosenHandle = uv.username;

    // ── Stripe disconnected (testing): provision directly, no payment ──────
    if (billingDisabled()) {
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

  console.log(`[stripe/webhook] ${event.type}`);

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
          break;
        }

        // ── MANAGED (direct) mode ──
        // When a handle was chosen at checkout, provision the box directly: it
        // gets a public IP + a per-bot CF DNS record (no tunnel). Falls back to
        // the legacy tunnel launch when no handle / CF isn't configured.
        if (username && cfConfigured()) {
          try {
            const { instanceId } = await provisionManagedInstance({
              accountId, username, plan, region, tier: 'premium', stripeSubscriptionId: subscriptionId,
            });
            console.log(`[stripe/webhook] managed instance ${instanceId} (${username}) for account ${accountId}`);
          } catch (err) {
            console.error(`[stripe/webhook] managed provision failed for ${username}:`, err.message);
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
            await db.collection('accounts').updateOne(
              { 'instances.id': id },
              { $set: { 'instances.$.status': 'failed' } },
            );
          });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        if (!subscription.metadata?.accountId) break;

        const db = getDb();
        if (subscription.cancel_at_period_end) {
          const cancelAt = new Date(subscription.current_period_end * 1000);
          await db.collection('accounts').updateOne(
            { 'instances.stripeSubscriptionId': subscription.id },
            { $set: {
              'instances.$.status': 'canceling',
              'instances.$.cancelAt': cancelAt,
            }},
          );
          console.log(`[stripe/webhook] subscription ${subscription.id} marked canceling (ends ${cancelAt.toISOString()})`);
        } else {
          // User resubscribed / un-canceled
          await db.collection('accounts').updateOne(
            { 'instances.stripeSubscriptionId': subscription.id },
            { $set: {
              'instances.$.status': 'ready',
              'instances.$.cancelAt': null,
            }},
          );
          console.log(`[stripe/webhook] subscription ${subscription.id} reactivated`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const db = getDb();

        // Find the instance to terminate EC2
        const account = await db.collection('accounts').findOne(
          { 'instances.stripeSubscriptionId': subscription.id },
          { projection: { 'instances.$': 1 } },
        );
        const instance = account?.instances?.[0];

        if (instance?.ec2InstanceId) {
          terminateInstance(instance.ec2InstanceId, instance.region).catch(err => {
            console.error(`[stripe/webhook] terminate EC2 failed:`, err.message);
          });
        }

        // Free the managed CF DNS record (best-effort).
        if (instance?.dnsRecordId) {
          deleteDnsRecord(instance.dnsRecordId).catch(err => {
            console.error(`[stripe/webhook] delete DNS record failed:`, err.message);
          });
        }

        // Free the relay registry entry so the reserved handle can back a new bot.
        if (instance?.username) {
          getUsers().deleteOne({ username: instance.username, tier: instance.tier || 'premium' }).catch(err => {
            console.error(`[stripe/webhook] free handle failed:`, err.message);
          });
        }

        // Mark as terminated
        await db.collection('accounts').updateOne(
          { 'instances.stripeSubscriptionId': subscription.id },
          { $set: {
            'instances.$.status': 'terminated',
            'instances.$.cancelAt': null,
          }},
        );
        console.log(`[stripe/webhook] subscription ${subscription.id} deleted → instance terminated`);
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
