// One-off migration: prepend YAML frontmatter to SKILL.md inside every
// skill/blueprint tarball stored in R2 so that the OpenAI/Codex harness
// can route to the skill (it requires `--- name / description ---` at
// the top of SKILL.md). Claude continues to work — the frontmatter is
// just ignored as plain markdown.
//
// Usage:
//   cd backend && node scripts/migrate-skill-frontmatter.js          # dry-run (no writes)
//   cd backend && node scripts/migrate-skill-frontmatter.js --apply  # actually write
//   cd backend && node scripts/migrate-skill-frontmatter.js --only=<id>  # limit to one product id
//
// Idempotent: tarballs whose SKILL.md already starts with `---` are skipped.
// Per product the script:
//   1. downloads <folder>/<file> from R2
//   2. extracts, reads canonical name + description (skill.json, then plugin.json)
//   3. prepends frontmatter to SKILL.md (folded form for multiline descriptions)
//   4. if skill.json's description drifts from plugin.json's, aligns it to plugin.json
//   5. re-tars, recomputes sha256
//   6. (--apply only) re-uploads to the same R2 key, updates products.sha256

import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { connect, close, getDb } from '../db.js';

// Self-contained R2 client. We don't reuse ../lib/r2.js because the local
// .env's R2_ENDPOINT has the bucket appended as a path component
// (https://<id>.r2.cloudflarestorage.com/<bucket>), which works for the
// production deploy but breaks local GetObject calls. Strip it here.
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PREFIX = 'static/';
const R2_ENDPOINT = (() => {
  const u = new URL(process.env.R2_ENDPOINT);
  return `${u.protocol}//${u.host}`;
})();

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function r2Get(key) {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: R2_PREFIX + key }));
  return res.Body;
}

async function r2Put(key, buffer) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: R2_PREFIX + key,
    Body: buffer,
    ContentType: 'application/gzip',
  }));
}

const APPLY = process.argv.includes('--apply');
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  return arg ? arg.slice('--only='.length) : null;
})();

const FRONTMATTER_BREAK_CHARS = /[:#\[\]{}&*!|>'"%@`]/;

function buildFrontmatter(name, description) {
  const safe = String(description || '').trim();
  const needsFolded = safe.includes('\n');
  const needsQuote = !needsFolded && (
    FRONTMATTER_BREAK_CHARS.test(safe) ||
    /^\s|\s$/.test(safe) ||
    /^[-?]/.test(safe)
  );

  let descLine;
  if (needsFolded) {
    const indented = safe.split('\n').map((l) => `  ${l}`).join('\n');
    descLine = `description: >\n${indented}`;
  } else if (needsQuote) {
    descLine = `description: "${safe.replace(/"/g, '\\"')}"`;
  } else {
    descLine = `description: ${safe}`;
  }

  return `---\nname: ${name}\n${descLine}\n---\n\n`;
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function tar(args, cwd) {
  const result = spawnSync('tar', args, { cwd, encoding: 'buffer' });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    throw new Error(`tar ${args.join(' ')} failed: ${stderr}`);
  }
  return result;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${p}: ${e.message}`);
  }
}

async function processProduct(product) {
  const r2Key = `${product.folder}/${product.file}`;
  const log = (msg) => console.log(`  [${product.id}] ${msg}`);

  // ── Download ─────────────────────────────────────────────────────────
  let tarball;
  try {
    const stream = await r2Get(r2Key);
    tarball = await streamToBuffer(stream);
  } catch (e) {
    log(`SKIP — R2 fetch failed (${e.message})`);
    return { id: product.id, status: 'fetch-failed' };
  }

  // ── Extract ──────────────────────────────────────────────────────────
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `bloby-mig-${product.id}-`));
  const tarPath = path.join(tmpRoot, 'in.tar.gz');
  fs.writeFileSync(tarPath, tarball);
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir);
  try {
    tar(['xzf', tarPath, '-C', extractDir]);
  } catch (e) {
    log(`SKIP — extract failed (${e.message})`);
    return { id: product.id, status: 'extract-failed', tmpRoot };
  }

  // ── Identify root folder ─────────────────────────────────────────────
  const entries = fs.readdirSync(extractDir);
  if (entries.length !== 1) {
    log(`SKIP — expected single root folder, found ${entries.length}: ${entries.join(', ')}`);
    return { id: product.id, status: 'bad-layout', tmpRoot };
  }
  const rootName = entries[0];
  const rootDir = path.join(extractDir, rootName);
  const skillMdPath = path.join(rootDir, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    log(`SKIP — no SKILL.md in tarball`);
    return { id: product.id, status: 'no-skill-md', tmpRoot };
  }

  // ── Idempotency check ────────────────────────────────────────────────
  const existing = fs.readFileSync(skillMdPath, 'utf8');
  if (existing.startsWith('---\n') || existing.startsWith('---\r\n')) {
    log(`already has frontmatter — skip`);
    return { id: product.id, status: 'already-migrated', tmpRoot };
  }

  // ── Resolve canonical name + description ─────────────────────────────
  const skillJson = readJsonIfExists(path.join(rootDir, 'skill.json'));
  const pluginJsonPath = path.join(rootDir, '.claude-plugin', 'plugin.json');
  const pluginJson = readJsonIfExists(pluginJsonPath);

  const pluginDesc = pluginJson?.description?.trim() || null;
  const skillDesc = skillJson?.description?.trim() || null;

  const name = pluginJson?.name || skillJson?.name || rootName;
  const canonicalDesc = pluginDesc || skillDesc;

  if (!canonicalDesc) {
    log(`SKIP — no description in plugin.json or skill.json`);
    return { id: product.id, status: 'no-description', tmpRoot };
  }

  if (name !== rootName) {
    log(`WARN — name "${name}" != folder "${rootName}" (using folder name)`);
  }

  let driftFixed = false;
  if (pluginDesc && skillDesc && pluginDesc !== skillDesc) {
    log(`description drift detected — aligning skill.json to plugin.json`);
    log(`   plugin.json: ${pluginDesc}`);
    log(`   skill.json : ${skillDesc}`);
    driftFixed = true;
  }

  // ── Prepare new SKILL.md ─────────────────────────────────────────────
  const frontmatter = buildFrontmatter(rootName, canonicalDesc);
  const newSkillMd = frontmatter + existing.replace(/^\n+/, '');

  // ── Write changes into the working copy ──────────────────────────────
  fs.writeFileSync(skillMdPath, newSkillMd);
  if (driftFixed && skillJson) {
    skillJson.description = canonicalDesc;
    fs.writeFileSync(path.join(rootDir, 'skill.json'), JSON.stringify(skillJson, null, 2) + '\n');
  }

  // ── Repack ───────────────────────────────────────────────────────────
  const outPath = path.join(tmpRoot, 'out.tar.gz');
  // BSD tar (macOS) and GNU tar both accept this. Tar from the extract dir
  // so the archive's root is just <rootName>/ (no parent path leaks in).
  tar(['czf', outPath, rootName], extractDir);
  const newBuffer = fs.readFileSync(outPath);
  const newSha = crypto.createHash('sha256').update(newBuffer).digest('hex');

  log(`would migrate — old sha=${product.sha256?.slice(0, 12) || 'none'}…  new sha=${newSha.slice(0, 12)}…  size ${tarball.length}→${newBuffer.length}B`);
  log(`frontmatter:`);
  for (const line of frontmatter.trimEnd().split('\n')) {
    log(`   ${line}`);
  }

  // ── Apply ────────────────────────────────────────────────────────────
  if (APPLY) {
    await r2Put(r2Key, newBuffer);
    await getDb().collection('products').updateOne(
      { _id: product._id },
      { $set: { sha256: newSha, frontmatterMigratedAt: new Date() } },
    );
    log(`applied → uploaded to R2 + sha256 updated`);
  }

  return {
    id: product.id,
    status: 'migrated',
    oldSha: product.sha256,
    newSha,
    driftFixed,
    tmpRoot,
  };
}

function cleanup(tmpRoot) {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`\n=== Skill frontmatter migration ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (will write to R2 + Mongo)' : 'DRY-RUN (no writes)'}`);
  if (ONLY) console.log(`Filter: only id="${ONLY}"`);
  console.log('');

  await connect();

  const filter = {
    type: { $in: ['skill', 'blueprint'] },
    folder: { $in: ['skills', 'blueprints'] },
    file: { $exists: true, $ne: null },
  };
  if (ONLY) filter.id = ONLY;

  const products = await getDb().collection('products').find(filter).sort({ folder: 1, id: 1 }).toArray();
  console.log(`Found ${products.length} candidate products.\n`);

  const results = [];
  for (const product of products) {
    console.log(`→ ${product.folder}/${product.file}  (id=${product.id}, type=${product.type}, status=${product.status})`);
    let outcome = { id: product.id, status: 'error' };
    try {
      outcome = await processProduct(product);
    } catch (e) {
      console.log(`  [${product.id}] ERROR ${e.message}`);
    }
    cleanup(outcome.tmpRoot);
    results.push(outcome);
    console.log('');
  }

  // ── Summary ────────────────────────────────────────────────────────
  const tally = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`=== Summary ===`);
  for (const [k, v] of Object.entries(tally).sort()) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }
  if (!APPLY) {
    console.log(`\nDry-run complete. Re-run with --apply to write changes.`);
  }

  await close();
}

main().catch((err) => {
  console.error(err);
  close().finally(() => process.exit(1));
});
