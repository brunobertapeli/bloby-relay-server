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
    '**Two routes — pick the one matching your wallet network:**',
    '',
    '- `POST /api/services/audio-to-text/use`      → Tempo USDC (MPP)',
    '- `POST /api/services/audio-to-text/use-base` → Base USDC (x402)',
    '',
    'Owner credit balance is tried first on BOTH routes; the on-chain network only matters when balance is empty.',
    '',
    '**If your owner has credit balance (easiest):**',
    '',
    '```bash',
    'curl -s -X POST https://api.morphyagent.com/api/services/audio-to-text/use \\',
    '  -H "X-Bloby-Token: $RELAY_TOKEN" \\',
    '  -F "file=@./recording.mp3" \\',
    '  -F "language=en"',
    '```',
    '',
    'When balance covers it, this returns 200 immediately (no on-chain dance needed).',
    '',
    '**If balance is empty and your wallet is on Tempo USDC:** use the `mppx/client` Node library — the `mppx` CLI does not support multipart uploads (`-F`), so `curl` alone will fail with 402.',
    '',
    '```js',
    "import { Mppx, tempo } from 'mppx/client';",
    "import { privateKeyToAccount } from 'viem/accounts';",
    "import { readFileSync } from 'node:fs';",
    '',
    "const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.morphy/config.json`, 'utf8'));",
    'const account = privateKeyToAccount(cfg.wallet.privateKey);',
    'const mppx = Mppx.create({ methods: [tempo({ account })] });',
    '',
    'const form = new FormData();',
    "form.append('file', new Blob([readFileSync('./recording.mp3')]), 'recording.mp3');",
    "form.append('language', 'en');",
    '',
    "const res = await mppx.fetch('https://api.morphyagent.com/api/services/audio-to-text/use', {",
    "  method: 'POST',",
    "  headers: { 'X-Bloby-Token': cfg.relay.token },",
    '  body: form,',
    '});',
    'const data = await res.json();',
    '```',
    '',
    '**If balance is empty and your wallet is on Base USDC:** use `x402-fetch`.',
    '',
    '```js',
    "import { wrapFetchWithPayment } from 'x402-fetch';",
    "import { privateKeyToAccount } from 'viem/accounts';",
    "import { readFileSync } from 'node:fs';",
    '',
    "const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.morphy/config.json`, 'utf8'));",
    'const account = privateKeyToAccount(cfg.wallet.privateKey);',
    'const fetchWithPay = wrapFetchWithPayment(fetch, account);',
    '',
    'const form = new FormData();',
    "form.append('file', new Blob([readFileSync('./recording.mp3')]), 'recording.mp3');",
    "form.append('language', 'en');",
    '',
    "const res = await fetchWithPay('https://api.morphyagent.com/api/services/audio-to-text/use-base', {",
    "  method: 'POST',",
    "  headers: { 'X-Bloby-Token': cfg.relay.token },",
    '  body: form,',
    '});',
    'const data = await res.json();',
    '```',
    '',
    'Both routes return the same JSON:',
    '',
    '```json',
    '{',
    '  "transcript": "...",',
    '  "language": "en",',
    '  "estimatedMinutes": 5,',
    '  "priceUsd": 0.0185,',
    '  "paidVia": "balance" | "mpp" | "mpp-base",',
    '  "groqDurationSec": 275.4,',
    '  "model": "whisper-large-v3-turbo"',
    '}',
    '```',
    '',
    '**Pricing:** $0.0037 per estimated minute, rounded up (~$0.22/hour). Duration is estimated from file size assuming ~32kbps (matches Plaud-sourced audio). High-bitrate files will be over-charged proportionally; for those, run your own transcription.',
    '',
    '**Models:** `whisper-large-v3-turbo` (default, fastest), `whisper-large-v3` (more accurate), `distil-whisper-large-v3-en` (English-only, fastest).',
    '',
    '**Limits:** 25MB per file. Multipart `file` field required. Use `-F` / `FormData` (not `-d` / JSON).',
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
