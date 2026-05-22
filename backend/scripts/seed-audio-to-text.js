// One-off seed for the `audio-to-text` service.
//
//   cd backend && node scripts/seed-audio-to-text.js
//
// Upserts a `products` row so /api/services/audio-to-text/use is callable.
// Per-minute pricing: the relay computes a duration estimate from file size
// before the payment chain runs (see applyPerMinutePricing in routes/services.js)
// and charges $0.0037 per estimated minute (rounded up).
//
// `assumedBitrateBps` is the knob: 32000 (32 kbps) matches Plaud's mp3 encoding
// based on observed sample (1.1MB ≈ 4m35s). Adjust if real-world traffic shows
// a different distribution — no code change needed.

import dotenv from 'dotenv';
import { connect, close, getDb } from '../db.js';

dotenv.config();

const PRODUCT = {
  id: 'audio-to-text',
  name: 'Audio to Text',
  type: 'service',
  pricingModel: 'per-minute',
  unitPriceUsd: 0.0037,        // $0.22/hour
  assumedBitrateBps: 32000,    // 32 kbps; matches Plaud mp3
  price: 0,                    // placeholder; mutated per-request by applyPerMinutePricing
  version: '1.0.0',
  status: 'approved',
  description:
    'Transcribe audio via Groq Whisper. Billed $0.0037/min (~$0.22/hr), rounded up. ' +
    'Duration estimated from file size assuming ~32kbps (Plaud mp3 encoding). ' +
    '25MB / ~100min max per call.',
  agentDocs: [
    '**Usage:**',
    '',
    '```bash',
    '# Multipart upload — `file` is the only required field.',
    'curl -s -X POST https://api.bloby.bot/api/services/audio-to-text/use \\',
    '  -H "X-Bloby-Token: $RELAY_TOKEN" \\',
    '  -F "file=@./recording.mp3" \\',
    '  -F "language=en"        # optional 2-letter ISO code',
    '  -F "model=whisper-large-v3-turbo"   # optional; turbo is the default',
    '```',
    '',
    'Returns JSON:',
    '',
    '```json',
    '{',
    '  "transcript": "...",',
    '  "language": "en",',
    '  "estimatedMinutes": 5,',
    '  "priceUsd": 0.0185,',
    '  "paidVia": "balance",',
    '  "groqDurationSec": 275.4,',
    '  "model": "whisper-large-v3-turbo"',
    '}',
    '```',
    '',
    '**Pricing:** $0.0037 per estimated minute, rounded up. Duration is estimated ' +
    'from file size assuming ~32kbps (matches Plaud-sourced audio). High-bitrate ' +
    'files will be over-charged proportionally; for those, run your own transcription.',
    '',
    '**Models:** `whisper-large-v3-turbo` (default, fastest), `whisper-large-v3` ' +
    '(more accurate), `distil-whisper-large-v3-en` (English-only, fastest).',
    '',
    '**Limits:** 25MB per file. Multipart `file` field required. ' +
    'Use `-F` (not `-d`) — this endpoint takes multipart, not JSON.',
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
    console.log(`Updated audio-to-text service (_id: ${existing._id})`);
  } else {
    const result = await products.insertOne({ ...PRODUCT, createdAt: now });
    console.log(`Created audio-to-text service (_id: ${result.insertedId})`);
  }

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
