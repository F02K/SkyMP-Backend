'use strict'

const { Router } = require('express')
const config = require('../../config')
const access = require('../access/access-service')
const factions = require('../factions/faction-service')
const profiles = require('../players/profile-repository')
const sessions = require('../auth/play-session-service')
const balances = require('./balance-service')
const heartbeat = require('./heartbeat-service')

function legacyError(res, status, message) { return res.status(status).json({ error: message }) }
function v2Error(res, status, code, message = code) { return res.status(status).json({ error: { code, message } }) }

function checkKey(req, res, v2 = false) {
  if (req.params.key === config.secrets.serverMasterKey) return true
  if (v2) v2Error(res, 403, 'invalidServerKey', 'Invalid server key.')
  else legacyError(res, 403, 'Invalid master key.')
  return false
}

function checkWriteToken(req, res, v2 = false) {
  const valid = req.headers['x-auth-token'] && req.headers['x-auth-token'] === config.secrets.masterApiAuthToken
  if (valid) return true
  if (v2) v2Error(res, 403, 'invalidAuthToken', 'Invalid server authorization token.')
  else legacyError(res, 403, 'Invalid auth token.')
  return false
}

function profileDiscordId(req, res, v2 = false) {
  const profileId = Number.parseInt(req.params.profileId || req.params.id, 10)
  if (!Number.isInteger(profileId)) {
    if (v2) v2Error(res, 400, 'invalidProfileId', 'Profile ID must be an integer.')
    else legacyError(res, 400, 'Invalid profileId.')
    return null
  }
  const discordId = profiles.getDiscordIdByProfileId(profileId)
  if (!discordId) {
    if (v2) v2Error(res, 404, 'profileNotFound', 'Profile was not found.')
    else legacyError(res, 404, 'profileNotFound')
    return null
  }
  return discordId
}

function factionPayload(discordId) {
  return {
    permissions: factions.getPlayerFactionPermissions(discordId),
    gameFactions: factions.getPlayerGameFactions(discordId),
    factions: factions.getPlayerAssignments(discordId),
  }
}

async function sessionPayload(token) {
  const entry = sessions.find(token)
  if (!entry) return { status: 404, error: 'sessionNotFound' }
  let decision
  try { decision = await access.getDiscordAccess(entry.discordId) }
  catch { return { status: 503, error: 'accessUnavailable' } }
  if (!decision.allowed) return { status: 403, error: decision.error || 'accessDenied' }
  return {
    status: 200,
    user: {
      id: entry.profileId,
      discordId: entry.discordId,
      username: entry.username,
      roles: decision.roles,
      ...factionPayload(entry.discordId),
    },
  }
}

async function accessForProfile(req, res, v2) {
  const discordId = profileDiscordId(req, res, v2)
  if (!discordId) return null
  let decision
  try { decision = await access.getDiscordAccess(discordId) }
  catch {
    if (v2) v2Error(res, 503, 'accessUnavailable', 'Access provider is unavailable.')
    else legacyError(res, 503, 'accessUnavailable')
    return null
  }
  if (!decision.allowed) {
    if (v2) v2Error(res, 403, decision.error || 'accessDenied', 'Profile is not allowed to connect.')
    else legacyError(res, 403, decision.error || 'accessDenied')
    return null
  }
  return { discordId, decision }
}

function createLegacyMasterRouter() {
  const router = Router()

  router.post('/session', (req, res) => {
    if (!config.features.legacyDirectSessionCreation) return legacyError(res, 410, 'Legacy direct session creation is disabled.')
    if (!checkWriteToken(req, res)) return
    const { discordUser } = req.body || {}
    if (!discordUser || !discordUser.id) return legacyError(res, 400, 'Missing discordUser.id')
    res.json(sessions.create(discordUser))
  })

  router.get('/:key/sessions/:session', async (req, res) => {
    if (!checkKey(req, res)) return
    const result = await sessionPayload(req.params.session)
    if (result.error) return legacyError(res, result.status, result.error)
    res.json({ user: result.user })
  })

  router.get('/:key/profiles/:profileId/check', async (req, res) => {
    if (!checkKey(req, res)) return
    const result = await accessForProfile(req, res, false)
    if (!result) return
    res.json({ allowed: true, roles: result.decision.roles, ...factionPayload(result.discordId) })
  })

  router.post('/:key/profiles/:profileId/factions', (req, res) => mutateFaction(req, res, false, false))
  router.delete('/:key/profiles/:profileId/factions/:assignmentId', (req, res) => mutateFaction(req, res, false, true))

  router.get('/:key/sessions/:session/balance', (req, res) => {
    if (!checkKey(req, res)) return
    const entry = sessions.find(req.params.session)
    if (!entry) return legacyError(res, 404, 'Session not found or expired.')
    res.json({ user: { id: entry.profileId, balance: balances.get(entry.profileId) } })
  })

  router.post('/:key/sessions/:session/purchase', (req, res) => purchase(req, res, false))
  return router
}

function createV2GameServerRouter() {
  const router = Router()
  router.post('/:key/heartbeat', (req, res) => {
    if (!checkKey(req, res, true)) return
    const value = heartbeat.update(req.body || {}, { name: config.skymp.serverName, maxPlayers: config.skymp.maxPlayers })
    res.json(value)
  })
  router.get('/:key/sessions/:session', async (req, res) => {
    if (!checkKey(req, res, true)) return
    const result = await sessionPayload(req.params.session)
    if (result.error) return v2Error(res, result.status, result.error)
    res.json({ user: result.user })
  })
  router.get('/:key/profiles/:id/access', async (req, res) => {
    if (!checkKey(req, res, true)) return
    const result = await accessForProfile(req, res, true)
    if (!result) return
    res.json({ allowed: true, roles: result.decision.roles, ...factionPayload(result.discordId) })
  })
  router.post('/:key/profiles/:id/factions', (req, res) => mutateFaction(req, res, true, false))
  router.delete('/:key/profiles/:id/factions/:assignmentId', (req, res) => mutateFaction(req, res, true, true))
  router.get('/:key/sessions/:session/balance', (req, res) => {
    if (!checkKey(req, res, true)) return
    const entry = sessions.find(req.params.session)
    if (!entry) return v2Error(res, 404, 'sessionNotFound')
    res.json({ profileId: entry.profileId, balance: balances.get(entry.profileId) })
  })
  router.post('/:key/sessions/:session/purchases', (req, res) => purchase(req, res, true))
  return router
}

function createLegacyServerRouter() {
  const router = Router()
  router.get('/', (_req, res) => res.json([serverSummary()]))
  router.get('/:key/serverinfo', async (req, res) => {
    if (!checkKey(req, res)) return
    const details = await serverDetails(req.headers['x-session'])
    res.json({
      host: details.address,
      port: details.port,
      name: details.name,
      maxPlayers: details.maxPlayers,
      offlineMode: details.offlineMode,
      masterKey: details.masterKey,
      masterUrl: details.masterUrl,
      locked: details.locked,
      sessionValid: details.sessionValid,
      allowed: details.allowed,
    })
  })
  router.get('/:key/manifest.json', (req, res) => {
    if (!checkKey(req, res)) return
    res.json({ versionMajor: 1, mods: [] })
  })
  router.post('/:key', (req, res) => {
    if (!checkKey(req, res)) return
    heartbeat.update(req.body || {}, { name: config.skymp.serverName, maxPlayers: config.skymp.maxPlayers })
    res.json({ ok: true })
  })
  return router
}

function createLegacyServerInfoRouter() {
  const router = Router()
  router.get('/', async (req, res) => {
    const details = await serverDetails(req.headers['x-session'])
    res.json({
      name: details.name,
      maxPlayers: details.maxPlayers,
      port: details.port,
      offlineMode: details.offlineMode,
      npcEnabled: details.npcEnabled,
      gamemode: details.gamemode,
      discordAuthRequired: details.discordAuthRequired,
      masterKey: details.masterKey,
      masterUrl: details.masterUrl,
      locked: details.locked,
      sessionValid: details.sessionValid,
      allowed: details.allowed,
      publicKeys: readPublicKeys(),
    })
  })
  return router
}

function readPublicKeys() {
  try {
    const fs = require('fs')
    const { resolveDataFile } = require('../../shared/storage/paths')
    return JSON.parse(fs.readFileSync(resolveDataFile('publicKeys'), 'utf8'))
  } catch { return null }
}

async function mutateFaction(req, res, v2, remove) {
  if (!checkKey(req, res, v2) || !checkWriteToken(req, res, v2)) return
  const discordId = profileDiscordId(req, res, v2)
  if (!discordId) return
  try {
    if (remove) {
      const belongs = factions.getPlayerAssignments(discordId).some(item => item.id === req.params.assignmentId)
      if (!belongs) return v2 ? v2Error(res, 404, 'assignmentNotFound') : legacyError(res, 404, 'assignment not found for player')
      factions.deleteAssignment(req.params.assignmentId)
      return res.json({ ok: true, ...factionPayload(discordId) })
    }
    const assignment = factions.createAssignment({ ...req.body, discordId }, 'skymp-server')
    res.status(201).json({ assignment, ...factionPayload(discordId) })
  } catch (error) {
    if (v2) v2Error(res, error.status || 500, 'factionMutationFailed', error.message)
    else legacyError(res, error.status || 500, error.message || 'faction mutation failed')
  }
}

function purchase(req, res, v2) {
  if (!checkKey(req, res, v2) || !checkWriteToken(req, res, v2)) return
  const entry = sessions.find(req.params.session)
  if (!entry) return v2 ? v2Error(res, 404, 'sessionNotFound') : legacyError(res, 404, 'Session not found or expired.')
  try { res.json(balances.purchase(entry.profileId, req.body && req.body.balanceToSpend)) }
  catch (error) {
    if (v2) v2Error(res, error.status || 500, 'invalidPurchase', error.message)
    else legacyError(res, error.status || 500, error.message)
  }
}

function serverSummary() {
  const current = heartbeat.get()
  return {
    key: 'default',
    name: current?.name ?? config.skymp.serverName,
    address: config.skymp.host,
    port: config.skymp.port,
    online: current?.online ?? null,
    maxPlayers: current?.maxPlayers ?? config.skymp.maxPlayers,
    lastSeen: current?.lastSeen ?? null,
  }
}

async function serverDetails(sessionToken) {
  const current = heartbeat.get()
  let sessionValid = false
  let allowed = true
  if (sessionToken) {
    const entry = sessions.find(sessionToken)
    sessionValid = !!entry
    if (!entry) allowed = false
    else {
      try { allowed = (await access.getDiscordAccess(entry.discordId)).allowed }
      catch { allowed = false }
    }
  }
  return {
    ...serverSummary(),
    maxPlayers: current?.maxPlayers ?? config.skymp.maxPlayers,
    offlineMode: config.skymp.offlineMode,
    npcEnabled: config.skymp.npcEnabled,
    gamemode: config.skymp.gamemode,
    discordAuthRequired: !!config.discord.clientId,
    masterKey: config.secrets.serverMasterKey || null,
    masterUrl: config.skymp.masterUrl || null,
    locked: access.load().serverLocked,
    sessionValid,
    allowed,
  }
}

module.exports = {
  createLegacyServerInfoRouter,
  createLegacyServerRouter,
  createLegacyMasterRouter,
  createV2GameServerRouter,
  serverDetails,
  serverSummary,
}
