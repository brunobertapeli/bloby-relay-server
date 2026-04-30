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

    console.log('[db] Connected to MongoDB (bloby)');
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
