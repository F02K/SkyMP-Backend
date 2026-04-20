'use strict'

/**
 * Handles two concerns:
 *
 * 1. Stable profileId assignment (offline mode)
 *    POST /auth/session
 *      Body: { discordUser: { id, username, … } }
 *      Returns: { profileId: <integer> }
 *      The launcher calls this after Discord login.  Each Discord user receives
 *      a stable integer profileId that is written into gameData.profileId in the
 *      client settings file when the server runs in offlineMode.
 *
 * 2. Session validation (online mode — future)
 *    GET /api/servers/:key/sessions/:session
 *      Called by the SkyMP server to validate a session token created by the
 *      SkyMP client's own in-game Discord auth flow.
 *      Returns: { user: { id: <profileId>, discordId: "<snowflake>" } }
 *
 * NOTE: In online mode the SkyMP client manages the full auth flow itself
 * (in-game browser → Discord OAuth → master API session).  The launcher does
 * NOT write gameData at all in online mode — it only sets `master` and
 * `server-master-key` in the client settings file and the client handles the
 * rest.
 */

const router = require('express').Router()
const crypto = require('crypto')
const fs     = require('fs')
const path   = require('path')
const config = require('../config')

// ── Persistent Discord → profileId mapping ────────────────────────────────────

const PROFILES_PATH = path.join(__dirname, '..', 'data', 'profiles.json')

function loadProfiles() {
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')) }
  catch { return { nextId: 1, map: {} } }
}

function saveProfiles(data) {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2) + '\n')
}

function getOrCreateProfileId(discordId) {
  const data = loadProfiles()
  if (!data.map[discordId]) {
    data.map[discordId] = data.nextId++
    saveProfiles(data)
  }
  return data.map[discordId]
}

// ── In-memory session store — used for online-mode validation only ────────────

const sessions    = new Map()
const SESSION_TTL = 24 * 60 * 60 * 1000  // 24 h

function pruneExpired() {
  const now = Date.now()
  for (const [token, s] of sessions)
    if (s.expiresAt < now) sessions.delete(token)
}

// ── POST /auth/session ────────────────────────────────────────────────────────

router.post('/session', (req, res) => {
  const { discordUser } = req.body || {}
  if (!discordUser || !discordUser.id)
    return res.status(400).json({ error: 'Missing discordUser.id' })

  pruneExpired()

  const profileId = getOrCreateProfileId(discordUser.id)

  // Also mint a session token so this endpoint stays useful when online mode
  // is enabled in the future.
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    profileId,
    discordId: discordUser.id,
    username:  discordUser.username || '',
    expiresAt: Date.now() + SESSION_TTL,
  })

  res.json({ profileId, session: token })
})

// ── GET /api/servers/:key/sessions/:session ───────────────────────────────────
// SkyMP server calls this in online mode to validate a client's session token.

router.get('/servers/:key/sessions/:session', (req, res) => {
  pruneExpired()
  const entry = sessions.get(req.params.session)
  if (!entry)
    return res.status(404).json({ error: 'Session not found or expired.' })

  // Lockdown check: if the server is locked, only allow listed Discord IDs.
  if (config.serverLocked) {
    const allowed = config.serverLockedAllowList
    if (!allowed.includes(entry.discordId)) {
      return res.status(403).json({ error: 'serverLocked' })
    }
  }

  res.json({
    user: {
      id:        entry.profileId,
      discordId: entry.discordId,
      username:  entry.username,
    },
  })
})

module.exports = router
