#!/usr/bin/env node

// Copies source files to ~/.bloby/ so everything lives in one
// predictable location. Backward compat for `npm install -g bloby`.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const BLOBY_HOME = path.join(os.homedir(), '.bloby');

// Loop guard: if we're already running inside ~/.bloby/, exit
// (prevents infinite loop when npm install triggers postinstall again)
if (path.resolve(PKG_ROOT) === path.resolve(BLOBY_HOME)) {
  process.exit(0);
}

// Dev guard: don't interfere with development
if (fs.existsSync(path.join(PKG_ROOT, '.git'))) {
  process.exit(0);
}

// ── Copy source files to ~/.bloby/ ──

fs.mkdirSync(BLOBY_HOME, { recursive: true });

// Code directories — always overwrite (these are application code)
const CODE_DIRS = ['bin', 'supervisor', 'worker', 'shared', 'scripts'];

// Code files — always overwrite
const CODE_FILES = [
  'package.json', 'vite.config.ts', 'vite.bloby.config.ts',
  'tsconfig.json', 'postcss.config.js', 'components.json',
];

for (const dir of CODE_DIRS) {
  const src = path.join(PKG_ROOT, dir);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(BLOBY_HOME, dir);
  fs.cpSync(src, dst, { recursive: true, force: true });
}

// Workspace template — only on first install (preserves user files, uploads, etc.)
const wsSrc = path.join(PKG_ROOT, 'workspace');
const wsDst = path.join(BLOBY_HOME, 'workspace');
if (fs.existsSync(wsSrc) && !fs.existsSync(wsDst)) {
  fs.cpSync(wsSrc, wsDst, { recursive: true });
}

// Ensure workspace has its own package.json and .npmrc (handles upgrades from older versions)
for (const f of ['package.json', '.npmrc']) {
  const src = path.join(PKG_ROOT, 'workspace', f);
  const dst = path.join(BLOBY_HOME, 'workspace', f);
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
  }
}

for (const file of CODE_FILES) {
  const src = path.join(PKG_ROOT, file);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(BLOBY_HOME, file));
}

// ── Install dependencies in ~/.bloby/ ──

// claude-agent-sdk 0.3.x moved @anthropic-ai/sdk + @modelcontextprotocol/sdk to
// peerDependencies; upgrading the existing ~/.bloby tree in place deadlocks npm's
// resolver (ERESOLVE). Persist legacy-peer-deps so this install — and the manual
// recovery command below — resolve cleanly. (.npmrc is excluded from npm tarballs.)
try {
  const npmrc = path.join(BLOBY_HOME, '.npmrc');
  const cur = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf-8') : '';
  if (!/^legacy-peer-deps\s*=/m.test(cur)) {
    fs.writeFileSync(npmrc, (cur && !cur.endsWith('\n') ? cur + '\n' : cur) + 'legacy-peer-deps=true\n');
  }
} catch { /* best-effort */ }

try {
  execSync('npm install --omit=dev', {
    cwd: BLOBY_HOME,
    stdio: 'inherit',
  });
} catch (e) {
  // Don't swallow this — partial deps leave bloby in a crash loop on first
  // start (e.g. missing @anthropic-ai/claude-agent-sdk after a release that
  // adds a new dep). The CLI has a self-heal pass but only triggers when the
  // user runs `bloby` again, so make the failure visible here too.
  console.error(`\nError: npm install failed in ${BLOBY_HOME}: ${e.message}`);
  console.error(`Run manually: cd ${BLOBY_HOME} && npm install --omit=dev\n`);
  process.exit(1);
}

// Verify every declared dependency actually landed on disk.
const installedDeps = JSON.parse(fs.readFileSync(path.join(BLOBY_HOME, 'package.json'), 'utf-8')).dependencies || {};
const missing = Object.keys(installedDeps).filter(
  d => !fs.existsSync(path.join(BLOBY_HOME, 'node_modules', d, 'package.json'))
);
if (missing.length > 0) {
  console.error(`\nError: npm install reported success but these deps are missing: ${missing.join(', ')}`);
  console.error(`Try: cd ${BLOBY_HOME} && rm -rf node_modules package-lock.json && npm install --omit=dev\n`);
  process.exit(1);
}

// ── Prune wrong-libc claude-agent-sdk native package ──
// The SDK's binary resolver tries the musl variant before glibc on Linux. If
// both optionalDependencies install (npm does that for arm64), a glibc system
// like Raspberry Pi OS picks the musl binary and fails to spawn it.
if (process.platform === 'linux') {
  const muslLoader = `/lib/ld-musl-${process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch}.so.1`;
  const systemIsMusl = fs.existsSync(muslLoader);
  const unwanted = systemIsMusl
    ? `claude-agent-sdk-linux-${process.arch}`
    : `claude-agent-sdk-linux-${process.arch}-musl`;
  const unwantedPath = path.join(BLOBY_HOME, 'node_modules', '@anthropic-ai', unwanted);
  if (fs.existsSync(unwantedPath)) {
    fs.rmSync(unwantedPath, { recursive: true, force: true });
  }
}

// ── Install workspace dependencies (isolated from system deps) ──
// Native modules (better-sqlite3) must be built for the target platform —
// failures here cause backend crash loops, so surface them.

try {
  execSync('npm install --omit=dev', {
    cwd: path.join(BLOBY_HOME, 'workspace'),
    stdio: 'inherit',
  });
} catch {
  console.error('Error: workspace dependency install failed — backend will not start until fixed.');
  console.error(`Run manually: cd ${path.join(BLOBY_HOME, 'workspace')} && npm install --omit=dev`);
  process.exit(1);
}

// ── Copy pre-built UI if available, otherwise build ──

const distSrc = path.join(PKG_ROOT, 'dist-bloby');
const distDst = path.join(BLOBY_HOME, 'dist-bloby');
if (fs.existsSync(distSrc)) {
  // Always use the pre-built UI from the package (handles updates)
  if (fs.existsSync(distDst)) fs.rmSync(distDst, { recursive: true });
  fs.cpSync(distSrc, distDst, { recursive: true });
} else if (!fs.existsSync(path.join(distDst, 'onboard.html'))) {
  try {
    execSync('npm run build:bloby', {
      cwd: BLOBY_HOME,
      stdio: 'ignore',
    });
  } catch {
    // Non-fatal: supervisor will build on first start
  }
}

// ── Create bloby symlink ──

const cliPath = path.join(BLOBY_HOME, 'bin', 'cli.js');
fs.chmodSync(cliPath, 0o755);

if (process.platform === 'win32') {
  // On Windows, npm handles the bin linking via package.json "bin" field
  // Just ensure the files are in place
} else {
  const targets = ['/usr/local/bin/bloby', path.join(os.homedir(), '.local', 'bin', 'bloby')];
  let linked = false;

  for (const target of targets) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.unlinkSync(target); } catch {}
      fs.symlinkSync(cliPath, target);
      linked = true;
      break;
    } catch {
      // No permission, try next
    }
  }

  if (!linked) {
    console.log(`Note: Could not create bloby symlink. You can run it directly: node ${cliPath}`);
  }
}
