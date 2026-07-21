'use strict'

const { JsonStore } = require('../../shared/storage/json-store')
const { resolveDataFile } = require('../../shared/storage/paths')

const store = new JsonStore({
  filePath: resolveDataFile('profiles'),
  defaultValue: { nextId: 1, map: {} },
  validate: value => value && typeof value === 'object' && !Array.isArray(value),
})

function load() {
  try {
    const data = store.read()
    return {
      nextId: Number.isInteger(data.nextId) ? data.nextId : 1,
      map: data.map && typeof data.map === 'object' ? data.map : {},
    }
  } catch {
    return { nextId: 1, map: {} }
  }
}

function save(data) { store.write(data) }

function getOrCreateProfileId(discordId) {
  const id = String(discordId || '').trim()
  if (!id) throw new Error('discordId is required')

  const data = load()
  if (!data.map[id]) {
    data.map[id] = data.nextId++
    save(data)
  }
  return data.map[id]
}

function getDiscordIdByProfileId(profileId) {
  const id = Number(profileId)
  const entry = Object.entries(load().map).find(([, value]) => value === id)
  return entry ? entry[0] : null
}

function list() {
  return Object.entries(load().map)
    .map(([discordId, profileId]) => ({ discordId, profileId }))
    .sort((a, b) => a.profileId - b.profileId)
}

module.exports = {
  load,
  save,
  list,
  getOrCreateProfileId,
  getDiscordIdByProfileId,
}
