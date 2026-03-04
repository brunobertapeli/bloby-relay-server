import { Router } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, getUsers } from '../db.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { launchInstance, terminateInstance } from '../lib/aws.js';
import { validateUsername } from '../lib/validate.js';

// Lazy-init: env vars aren't available at import time (dotenv runs later in server.js)
let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

const router = Router();

function getConfig() {
  return {
    CALLBACK_BASE: process.env.CALLBACK_BASE_URL || `https://api.${process.env.RELAY_DOMAIN}`,
    // Stripe redirects must go to the canonical domain, not the Railway URL
    FRONTEND_URL: process.env.STRIPE_REDIRECT_URL || `https://www.${process.env.RELAY_DOMAIN || 'fluxy.bot'}`,
    PRICE_IDS: {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID,
    },
  };
}

// ─── Create Checkout Session ────────────────────────────────────────────────
router.post('/stripe/checkout', jwtAuth, async (req, res) => {
  try {
    const { plan, region } = req.body;
    if (!plan || !region) {
      return res.status(400).json({ error: 'Missing plan or region' });
    }
    if (!['starter', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!['na', 'eu', 'br'].includes(region)) {
      return res.status(400).json({ error: 'Invalid region' });
    }

    const { PRICE_IDS, FRONTEND_URL } = getConfig();
    const stripe = getStripe();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return res.status(500).json({ error: 'Price not configured for this plan' });
    }

    const db = getDb();
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
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { plan, region, accountId: req.account.id },
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
router.get('/stripe/handles', jwtAuth, async (req, res) => {
  try {
    const db = getDb();
    const account = await db.collection('accounts').findOne(
      { _id: new ObjectId(req.account.id) },
      { projection: { reservedHandles: 1 } },
    );
    res.json({ reservedHandles: account?.reservedHandles || [] });
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

        // ── Handle purchase (one-time payment) ──
        if (session.mode === 'payment') {
          const { handle, accountId } = session.metadata || {};
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
        const { plan, region, accountId } = subscription.metadata;

        if (!plan || !region || !accountId) {
          console.error('[stripe/webhook] missing metadata on subscription:', subscriptionId);
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
