import { MongoClient } from 'mongodb';

let db = null;
let client = null;

export async function connect() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[db] MONGODB_URI is required — exiting');
    process.exit(1);
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    await client.connect();
    db = client.db('bloby');

    await createIndexes();

    console.log('[db] Connected to MongoDB (morphy)');
    return db;
  } catch (error) {
    console.error('[db] Failed to connect:', error.message);
    process.exit(1);
  }
}

async function createIndexes() {
  const users = db.collection('users');

  // Drop old username-only unique index if it exists (replaced by compound)
  try { await users.dropIndex('username_1'); } catch { /* already gone */ }

  await Promise.all([
    users.createIndex({ username: 1, tier: 1 }, { unique: true }),
    users.createIndex({ tokenHash: 1 }, { unique: true }),
    users.createIndex({ lastHeartbeat: 1 }),
    users.createIndex({ lastZoneAt: 1 }),
  ]);

  const claims = db.collection('claims');
  await Promise.all([
    claims.createIndex({ code: 1 }),
    claims.createIndex({ accountId: 1 }),
    claims.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600 }),
  ]);

  const pairingCodes = db.collection('pairing_codes');
  await Promise.all([
    pairingCodes.createIndex({ code: 1 }),
    pairingCodes.createIndex({ userId: 1 }),
    pairingCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // TTL: auto-delete expired codes
  ]);

  const transactions = db.collection('transactions');
  await Promise.all([
    transactions.createIndex({ botUsername: 1, productId: 1 }, { unique: true }),
    transactions.createIndex({ accountId: 1 }),
  ]);

  const payouts = db.collection('payouts');
  await Promise.all([
    payouts.createIndex({ productId: 1, createdAt: -1 }),
    payouts.createIndex({ recipient: 1, status: 1 }),
    payouts.createIndex({ status: 1, createdAt: 1 }),
    payouts.createIndex({ productBloby: 1, status: 1 }),
  ]);

  // ─── Morphy Messenger ──────────────────────────────────────────────────────
  // Connections are stored with a canonical (userA, userB) sorted pair, so
  // the unique index naturally covers both directions of a 1-on-1.
  const messengerConnections = db.collection('messenger_connections');
  await Promise.all([
    messengerConnections.createIndex({ userA: 1, userB: 1 }, { unique: true }),
    messengerConnections.createIndex({ userA: 1, status: 1 }),
    messengerConnections.createIndex({ userB: 1, status: 1 }),
  ]);

  // Messages are opaque encrypted blobs. They are deleted on /ack but get a
  // 30-day TTL safety net so abandoned recipients don't cause unbounded growth.
  const messengerMessages = db.collection('messenger_messages');
  await Promise.all([
    messengerMessages.createIndex({ to: 1, createdAt: 1 }),
    messengerMessages.createIndex({ connectionId: 1 }),
    messengerMessages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }),
  ]);

  // ─── Alexa channel ────────────────────────────────────────────────────────
  // Pairing codes minted by /api/alexa/pair, redeemed by LinkIntent inside /handle.
  // TTL auto-deletes after expiresAt so unused codes don't pile up.
  const alexaPairingCodes = db.collection('alexa_pairing_codes');
  await Promise.all([
    alexaPairingCodes.createIndex({ code: 1 }, { unique: true }),
    alexaPairingCodes.createIndex({ username: 1 }),
    alexaPairingCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  // Persistent links: { alexaUserId → username }. One alexa user maps to one morphy.
  const alexaLinks = db.collection('alexa_links');
  await Promise.all([
    alexaLinks.createIndex({ alexaUserId: 1 }, { unique: true }),
    alexaLinks.createIndex({ username: 1 }),
  ]);
}

export function getDb() {
  return db;
}

export function getUsers() {
  return db.collection('users');
}

export async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
