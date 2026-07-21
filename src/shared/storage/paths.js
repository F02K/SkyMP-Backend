'use strict'

const fs = require('fs')
const path = require('path')
const config = require('../../config')

const DATA_FILES = Object.freeze({
  news: ['content/news.json', 'news.json'],
  lore: ['content/lore.json', 'lore.json'],
  rules: ['content/rules.json', 'rules.json'],
  modlist: ['content/modlist.json', 'modlist.json'],
  publicKeys: ['content/public-keys.json', 'public-keys.json'],
  accessPolicy: ['access/server-access.json', 'server-access.json'],
  whitelist: ['access/whitelist.json', 'whitelist.json'],
  whitelistNotes: ['access/whitelist-staff-notes.json', 'whitelist-staff-notes.json'],
  rolePermissions: ['access/role-permissions.json', 'role-permissions.json'],
  factions: ['access/faction-whitelist.json', 'faction-whitelist.json'],
  profiles: ['players/profiles.json', 'profiles.json'],
  players: ['players/players.json', 'players.json'],
  balances: ['players/balances.json', 'balances.json'],
  playSessions: ['sessions/play-sessions.json', 'sessions.json'],
  dashboardSessions: ['sessions/dashboard-sessions.json', 'dashboard-sessions.json'],
  clientVersion: ['distribution/client-version.json', 'files-version.json'],
})

function filesEqual(left, right) {
  return fs.readFileSync(left).equals(fs.readFileSync(right))
}

function resolveDataFile(name, { dataDir = config.storage.dataDir } = {}) {
  const mapping = DATA_FILES[name]
  if (!mapping) throw new Error(`Unknown data file: ${name}`)
  const canonical = path.join(dataDir, mapping[0])
  const legacy = path.join(dataDir, mapping[1])
  const canonicalExists = fs.existsSync(canonical)
  const legacyExists = fs.existsSync(legacy)
  if (canonicalExists && legacyExists && !filesEqual(canonical, legacy)) {
    throw new Error(`Conflicting canonical and legacy data files for ${name}; run the data migration tool.`)
  }
  if (canonicalExists) return canonical
  if (legacyExists) return legacy
  return canonical
}

function canonicalDataFile(name, { dataDir = config.storage.dataDir } = {}) {
  const mapping = DATA_FILES[name]
  if (!mapping) throw new Error(`Unknown data file: ${name}`)
  return path.join(dataDir, mapping[0])
}

function legacyDataFile(name, { dataDir = config.storage.dataDir } = {}) {
  const mapping = DATA_FILES[name]
  if (!mapping) throw new Error(`Unknown data file: ${name}`)
  return path.join(dataDir, mapping[1])
}

module.exports = { DATA_FILES, canonicalDataFile, legacyDataFile, resolveDataFile }
