'use strict'

/**
 * Merge pipeline — combines the two source directories into the file bucket
 * that the launcher downloads, and builds the distributable zip.
 *
 *   sources/client/  +  sources/skse/  →  public/files/root/
 *                                      →  public/files/frostfall-client.zip
 *                                      →  data/files-version.json
 *
 * Run standalone:  node scripts/merge-files.js
 * Called by:       scripts/setup-client.js  and  routes/webhook.js
 */

const path               = require('path')
const fs                 = require('fs')
const crypto             = require('crypto')
const { execFileSync }   = require('child_process')
const archiver           = require('archiver')

const ROOT = path.join(__dirname, '..')

const CLIENT_SRC  = path.join(ROOT, 'sources', 'client')
const SKSE_SRC    = path.join(ROOT, 'sources', 'skse')
const OUTPUT_DIR  = path.join(ROOT, 'public', 'files', 'root')
const ZIP_PATH    = path.join(ROOT, 'public', 'files', 'frostfall-client.zip')
const VERSION_FILE = path.join(ROOT, 'data', 'files-version.json')

// ── Version helpers ───────────────────────────────────────────────────────────

/**
 * Short git commit hash of the client source repo.
 * This changes exactly when new commits are pulled — never on mere restarts.
 * Falls back to 'nogit' if the directory isn't a repo yet.
 */
function clientGitHash() {
  try {
    return execFileSync('git', ['-C', CLIENT_SRC, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio:    ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'nogit'
  }
}

/**
 * 7-char hash derived from the names and sizes of SKSE binaries.
 * Changes when .exe/.dll files in sources/skse/ are added, removed or replaced.
 */
function skseFingerprint() {
  if (!fs.existsSync(SKSE_SRC)) return '0000000'
  const entries = fs.readdirSync(SKSE_SRC)
    .filter(f => f.endsWith('.exe') || f.endsWith('.dll'))
    .sort()
    .map(f => `${f}:${fs.statSync(path.join(SKSE_SRC, f)).size}`)
    .join('|')
  if (!entries) return '0000000'
  return crypto.createHash('sha256').update(entries).digest('hex').slice(0, 7)
}

// ── File copy ─────────────────────────────────────────────────────────────────

function copyDir(srcDir, destDir, skipNames = new Set()) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[merge] source not found, skipping: ${srcDir}`)
    return 0
  }
  let count = 0
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue
    const src  = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true })
      count += copyDir(src, dest, skipNames)
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
      count++
    }
  }
  return count
}

// ── Zip builder ───────────────────────────────────────────────────────────────

function buildZip(srcDir, zipPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(zipPath), { recursive: true })
    const output  = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve(archive.pointer()))
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(srcDir, false)  // false = no root folder prefix in zip
    archive.finalize()
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

async function mergeSourcesIntoRoot() {
  const startMs = Date.now()

  console.log('[merge] Starting merge…')
  console.log(`[merge]   client  : ${CLIENT_SRC}`)
  console.log(`[merge]   skse    : ${SKSE_SRC}`)
  console.log(`[merge]   output  : ${OUTPUT_DIR}`)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const SKIP_ALWAYS = new Set(['.git', '.gitignore', '.gitattributes'])
  const SKSE_SKIP   = new Set([...SKIP_ALWAYS, 'README.md', 'README.txt'])

  const clientFiles = copyDir(CLIENT_SRC, OUTPUT_DIR, SKIP_ALWAYS)
  console.log(`[merge]   ${clientFiles} file(s) from client`)

  const skseFiles = copyDir(SKSE_SRC, OUTPUT_DIR, SKSE_SKIP)
  console.log(`[merge]   ${skseFiles} file(s) from skse`)

  const total = clientFiles + skseFiles
  console.log(`[merge] Files merged: ${total} total in ${Date.now() - startMs}ms`)

  if (!fs.existsSync(path.join(OUTPUT_DIR, 'skse64_loader.exe'))) {
    console.warn('[merge] ⚠  skse64_loader.exe not found. Place SKSE binaries in sources/skse/')
  }

  // ── Build distributable zip ──────────────────────────────────────────────────
  console.log('[merge] Building zip…')
  const zipStart = Date.now()
  const zipSize  = await buildZip(OUTPUT_DIR, ZIP_PATH)
  console.log(`[merge] Zip built: ${(zipSize / 1024 / 1024).toFixed(1)} MB in ${Date.now() - zipStart}ms`)

  // ── Write version file ───────────────────────────────────────────────────────
  // Version is content-based: "<client-commit>-<skse-fingerprint>"
  //   • Same content  → same version → launcher skips re-download after restart
  //   • New commit    → new version  → launcher re-downloads automatically
  //   • SKSE updated  → new version  → launcher re-downloads automatically
  const version = `${clientGitHash()}-${skseFingerprint()}`
  fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true })
  fs.writeFileSync(VERSION_FILE, JSON.stringify({
    version,
    builtAt:   new Date().toISOString(),
    fileCount: total,
    zipSize,
  }, null, 2) + '\n')
  console.log(`[merge] Version: ${version}`)

  return { clientFiles, skseFiles, total, zipSize }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  mergeSourcesIntoRoot().catch(err => {
    console.error('[merge] Fatal:', err.message)
    process.exit(1)
  })
}

module.exports = { mergeSourcesIntoRoot }
