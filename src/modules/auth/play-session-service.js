'use strict'

const crypto = require('crypto')
const players = require('../players/player-service')
const { JsonStore } = require('../../shared/storage/json-store')
const { resolveDataFile } = require('../../shared/storage/paths')

const SESSION_TTL = 24 * 60 * 60 * 1000
const store = new JsonStore({
  filePath: resolveDataFile('playSessions'),
  defaultValue: [],
  validate: Array.isArray,
})
const sessions = new Map()

function load() {
  const now = Date.now()
  for (const [token, entry] of store.read()) {
    if (entry && entry.expiresAt > now) sessions.set(token, entry)
  }
}

function prune() {
  const now = Date.now()
  let changed = false
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) {
      sessions.delete(token)
      changed = true
    }
  }
  return changed
}

function persist() {
  prune()
  store.write([...sessions.entries()])
}

function create(discordUser) {
  if (!discordUser || !discordUser.id) throw new Error('discordUser.id is required')
  prune()
  const player = players.upsertFromDiscordUser(discordUser)
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    profileId: player.profileId,
    discordId: String(discordUser.id),
    username: discordUser.username || '',
    expiresAt: Date.now() + SESSION_TTL,
  })
  persist()
  return { profileId: player.profileId, session: token }
}

function find(token) {
  if (prune()) persist()
  return sessions.get(token) || null
}

function revoke(token) {
  if (sessions.delete(token)) persist()
}

load()

module.exports = { SESSION_TTL, create, find, revoke }
