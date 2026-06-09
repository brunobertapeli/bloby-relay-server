// One-off migration: ensure every blueprint product carries the new
// `official` and `content` fields the marketplace UI now reads.
//
//   cd backend && node scripts/migrate-blueprint-content-official.js          # dry-run (no writes)
//   cd backend && node scripts/migrate-blueprint-content-official.js --apply  # actually write
//
// What it does, per blueprint (type: "blueprint"):
//   • sets official=true  — but ONLY if the field is missing
//   • sets content=[all 6 types] — but ONLY if missing or empty
//
// Idempotent and edit-safe: once a blueprint has an `official` value or a
// non-empty `content` array (e.g. you hand-edited it), this script leaves that
// field alone. Re-running never clobbers manual corrections.

import dotenv from 'dotenv';
import { connect, close, getDb } from '../db.js';

dotenv.config();

// Keep in sync with routes/marketplace.js CONTENT_TYPES and the frontend.
const CONTENT_TYPES = ['skill', 'widget', 'code-snippet', 'micro-app', 'memory', 'cron-pulse'];
const APPLY = process.argv.includes('--apply');

async function main() {
  await connect();
  const col = getDb().collection('products');
  const blueprints = await col.find({ type: 'blueprint' }).toArray();
  console.log(`Found ${blueprints.length} blueprint(s).\n`);

  let officialUpdates = 0;
  let contentUpdates = 0;
  let untouched = 0;

  for (const bp of blueprints) {
    const set = {};
    if (bp.official === undefined) {
      set.official = true;
      officialUpdates++;
    }
    if (!Array.isArray(bp.content) || bp.content.length === 0) {
      set.content = [...CONTENT_TYPES];
      contentUpdates++;
    }

    if (Object.keys(set).length === 0) {
      untouched++;
      console.log(`  =  ${bp.id} — already has official + content, skipping`);
      continue;
    }

    console.log(`  ${APPLY ? '✓' : '·'} ${bp.id} — set ${JSON.stringify(set)}`);
    if (APPLY) await col.updateOne({ _id: bp._id }, { $set: set });
  }

  console.log(
    `\n${APPLY ? 'Applied' : 'Would apply'}: official→${officialUpdates}, content→${contentUpdates}, untouched→${untouched}`,
  );
  if (!APPLY) console.log('Dry run only — re-run with --apply to write.');

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
