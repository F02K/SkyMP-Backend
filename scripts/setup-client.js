'use strict'

/**
 * One-time (and subsequent) setup for the configured client source directory.
 *
 *   First run: clone the configured repository into the source directory.
 *   Later runs: pull fast-forward-only updates.
 *
 * After the clone / pull the merge pipeline runs automatically so that
 * public/files/root/ is immediately up to date.
 *
 * Usage:  node scripts/setup-client.js
 *         npm run setup
 */

const { execFileSync } = require('child_process')
const fs   = require('fs')
const path = require('path')
const config = require('../src/config')

const CLIENT_REPO = config.distribution.clientRepositoryUrl
const CLIENT_DIR = config.distribution.clientSourceDir

if (!CLIENT_REPO) {
  console.error('[setup] Configure distribution.clientRepositoryUrl or CLIENT_REPOSITORY_URL first.')
  process.exit(1)
}

// ── Clone or pull ─────────────────────────────────────────────────────────────

const isCloned = fs.existsSync(path.join(CLIENT_DIR, '.git'))

if (isCloned) {
  console.log('[setup] Client repo already present — pulling latest…')
  try {
    const out = execFileSync('git', ['-C', CLIENT_DIR, 'pull', '--ff-only'], {
      encoding: 'utf8',
    })
    console.log('[setup]', out.trim())
  } catch (err) {
    console.error('[setup] git pull failed:', err.stderr || err.message)
    process.exit(1)
  }
} else {
  console.log('[setup] Cloning configured client repository…')
  console.log('[setup]   →', CLIENT_DIR)
  try {
    execFileSync('git', ['clone', CLIENT_REPO, CLIENT_DIR], { stdio: 'inherit' })
  } catch (err) {
    console.error('[setup] git clone failed:', err.message)
    process.exit(1)
  }
  console.log('[setup] Clone complete.')
}

// ── Merge into root ───────────────────────────────────────────────────────────

console.log('[setup] Running merge pipeline…')
const { mergeSourcesIntoRoot } = require('./merge-files')
mergeSourcesIntoRoot()
  .then(() => console.log('[setup] Setup complete. public/files/root/ and zip are ready.'))
  .catch(err => { console.error('[setup] Merge failed:', err.message); process.exit(1) })
