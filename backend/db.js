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
    db = client.db('fluxy');

    await createIndexes();

    console.log('[db] Connected to MongoDB (fluxy)');
    return db;
  } catch (error) {
    console.error('[db] Failed to connect:', error.message);
    process.exit(1);
  }
}

async function createIndexes() {
  const users = db.collection('users');

  await Promise.all([
    users.createIndex({ username: 1 }, { unique: true }),
    users.createIndex({ tokenHash: 1 }, { unique: true }),
    users.createIndex({ lastHeartbeat: 1 }),
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
