// One-off seed for the `easyahackathon` service.
//
//   cd backend && node scripts/seed-easyahackathon.js
//
// Upserts a `products` row so /api/services/easyahackathon/use (Tempo) and
// /api/services/easyahackathon/use-base (Coinbase BASE) are callable.
// Costs $0.05 per call — paid from the user's account balance if the bot is
// claimed and has funds, otherwise via x402 from the bot's wallet on the
// network that matches the endpoint.

import dotenv from 'dotenv';
import { connect, close, getDb } from '../db.js';

dotenv.config();

const PRODUCT = {
  id: 'easyahackathon',
  name: 'EasyA Hackathon Demo',
  type: 'service',
  price: 0.05,
  version: '1.0.0',
  status: 'approved',
  description: 'EasyA Hackathon demo. Returns the phrase CONSENSUS HACKATHON FTW. Costs $0.05 per call — paid from account balance, otherwise via x402 (Tempo or BASE) from the agent wallet.',
  agentDocs: [
    '**Usage (Tempo USDC):**',
    '',
    '```bash',
    'curl -s -X POST https://api.morphyagent.com/api/services/easyahackathon/use \\',
    '  -H "X-Bloby-Token: $RELAY_TOKEN"',
    '```',
    '',
    '**Usage (Coinbase BASE USDC):**',
    '',
    '```bash',
    'curl -s -X POST https://api.morphyagent.com/api/services/easyahackathon/use-base \\',
    '  -H "X-Bloby-Token: $RELAY_TOKEN"',
    '```',
    '',
    'Returns the markdown phrase `CONSENSUS HACKATHON FTW` plus the payment path. The endpoint you choose determines the x402 settlement network when balance is insufficient — Tempo for `/use`, Base mainnet for `/use-base`.',
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
    console.log(`Updated easyahackathon service (_id: ${existing._id})`);
  } else {
    const result = await products.insertOne({ ...PRODUCT, createdAt: now });
    console.log(`Created easyahackathon service (_id: ${result.insertedId})`);
  }

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
