'use strict'
// ── Dashboard session store ───────────────────────────────────────────────────
// Short-lived tokens issued after Discord OAuth. Persisted to
// data/dashboard-sessions.json so restarts don't log everyone out.

const crypto = require('crypto')
const { JsonStore } = require('../../shared/storage/json-store')
const { resolveDataFile } = require('../../shared/storage/paths')

const store = new JsonStore({
  filePath: resolveDataFile('dashboardSessions'),
  defaultValue: [],
  validate: Array.isArray,
})
const TTL  = 24 * 60 * 60 * 1000  // 24 h

// token → { discordId, username, avatar, expiresAt }
const sessions = new Map()

function _load() {
  try {
    const entries = store.read()
    const now     = Date.now()
    for (const [token, data] of entries) {
      if (data.expiresAt > now) sessions.set(token, data)
    }
    console.log(`[dashboard-sessions] loaded ${sessions.size} active session(s)`)
  } catch { /* file absent on first run */ }
}

function _save() {
  try {
    store.write([...sessions.entries()])
  } catch (err) {
    console.error('[dashboard-sessions] save failed:', err.message)
  }
}

function create(discordId, username, avatar, roles = [], permissions = []) {
  // Prune expired first
  const now = Date.now()
  for (const [t, d] of sessions) if (d.expiresAt <= now) sessions.delete(t)

  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { discordId, username, avatar, roles, permissions, expiresAt: now + TTL })
  _save()
  return token
}

function validate(token) {
  if (!token) return null
  const data = sessions.get(token)
  if (!data) return null
  if (data.expiresAt < Date.now()) {
    sessions.delete(token)
    _save()
    return null
  }
  return data
}

function revoke(token) {
  if (sessions.delete(token)) _save()
}

_load()
module.exports = { create, validate, revoke }
