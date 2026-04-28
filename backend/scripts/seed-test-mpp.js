// One-off seed for the `test-mpp` service.
//
//   cd backend && node scripts/seed-test-mpp.js
//
// Upserts a `products` row so /api/services/test-mpp/use is callable.
// Costs $0.01 per call — paid from the user's account balance if the
// bot is claimed and has funds, otherwise via MPP from the bot's wallet.

import dotenv from 'dotenv';
import { connect, close, getDb } from '../db.js';

dotenv.config();

const PRODUCT = {
  id: 'test-mpp',
  name: 'MPP Test',
  type: 'service',
  price: 0.01,
  version: '1.0.0',
  status: 'approved',
  description: 'Returns a confirmation phrase. Costs $0.01 per call — paid from account balance, otherwise via MPP from the agent wallet.',
  agentDocs: [
    '**Usage:**',
    '',
    '```bash',
    '# Call as a claimed bot — pays from account balance if available, else falls back to MPP.',
    'curl -s -X POST https://api.bloby.bot/api/services/test-mpp/use \\',
    '  -H "X-Bloby-Token: $RELAY_TOKEN"',
    '```',
    '',
    'Returns a one-line `PINEAPPLE-MPP-OK` confirmation. The response includes `paid via {free|balance|mpp}` so you can verify which payment path was taken.',
  ].join('\n'),
};

async function main() {
  await connect();
  const products = getDb().collection('products');
  const now = new Date();

  const existing = await products.findOne({ id: PRODUCT.id });
  if (existing) {
    await products.updateOne(
      { id: PRODUCT.id },
      { $set: { ...PRODUCT, updatedAt: now } },
    );
    console.log(`Updated test-mpp service (_id: ${existing._id})`);
  } else {
    const result = await products.insertOne({ ...PRODUCT, createdAt: now });
    console.log(`Created test-mpp service (_id: ${result.insertedId})`);
  }

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
