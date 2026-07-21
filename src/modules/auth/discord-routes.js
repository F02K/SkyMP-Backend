'use strict'

const { Router } = require('express')
const config = require('../../config')
const sessions = require('./play-session-service')
const oauth = require('../../integrations/discord/oauth-client')

const states = new Map()
const PENDING_TTL = 10 * 60 * 1000
const DONE_TTL = 5 * 60 * 1000

function prune() {
  const now = Date.now()
  for (const [key, value] of states) if (value.expiresAt <= now) states.delete(key)
}

function error(res, legacy, status, code, message) {
  if (legacy) return res.status(status).json({ error: message || code })
  return res.status(status).json({ error: { code, message: message || code } })
}

function createDiscordAuthRouter({ legacy = false } = {}) {
  const router = Router()
  const startPath = legacy ? '/login-discord' : '/start'
  const callbackPath = legacy ? '/login-discord/callback' : '/callback'
  const statusPath = legacy ? '/login-discord/status' : '/status'

  router.get(startPath, (req, res) => {
    const state = String(req.query.state || '')
    if (!state) return legacy ? res.status(400).send('Missing state parameter.') : error(res, false, 400, 'missingState')
    if (!config.discord.clientId) return legacy ? res.status(503).send('Discord OAuth is not configured on this server.') : error(res, false, 503, 'discordNotConfigured')
    prune()
    states.set(state, { status: 'pending', expiresAt: Date.now() + PENDING_TTL })
    const params = new URLSearchParams({
      client_id: config.discord.clientId,
      redirect_uri: config.discord.launcherRedirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
    })
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
  })

  router.get(callbackPath, async (req, res) => {
    const { code, state, error: oauthError } = req.query
    if (oauthError) {
      if (state) states.delete(state)
      return res.status(400).send('Discord authorization was cancelled.')
    }
    const pending = state && states.get(state)
    if (!code || !state || !pending || pending.status !== 'pending') return res.status(400).send('Unknown or expired OAuth state.')
    try {
      const token = await oauth.exchangeCode({
        clientId: config.discord.clientId,
        clientSecret: config.secrets.discordClientSecret,
        code,
        redirectUri: config.discord.launcherRedirectUri,
      })
      const user = await oauth.getCurrentUser(token.access_token)
      const created = sessions.create({ id: user.id, username: user.global_name || user.username, avatar: user.avatar })
      states.set(state, {
        status: 'done', expiresAt: Date.now() + DONE_TTL,
        session: created.session, profileId: created.profileId,
        username: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null,
      })
      res.type('html').send('<!doctype html><title>SkyMP</title><h2>Authorized. You may close this tab.</h2>')
    } catch (requestError) {
      console.error('[discord-oauth] callback failed:', requestError.message)
      states.delete(state)
      res.status(500).send('Authentication failed.')
    }
  })

  router.get(statusPath, (req, res) => {
    const state = String(req.query.state || '')
    if (!state) return error(res, legacy, 400, 'missingState', 'Missing state.')
    prune()
    const entry = states.get(state)
    if (!entry) return error(res, legacy, 403, 'stateExpired', 'Unknown or expired state.')
    if (entry.status === 'pending') return error(res, legacy, 401, 'authorizationPending', 'Auth not completed yet.')
    states.delete(state)
    const payload = {
      token: entry.session,
      masterApiId: entry.profileId,
      discordUsername: entry.username || null,
      discordDiscriminator: null,
      discordAvatar: entry.avatar || null,
    }
    res.json(legacy ? payload : { session: payload.token, profileId: payload.masterApiId, user: { username: payload.discordUsername, avatar: payload.discordAvatar } })
  })

  if (legacy) {
    router.post('/me/play/:serverKey', (req, res) => {
      const token = req.headers.authorization
      if (!token) return error(res, true, 401, 'missingAuthorization', 'Missing authorization header.')
      if (req.params.serverKey !== config.secrets.serverMasterKey) return error(res, true, 403, 'invalidServerKey', 'Invalid server key.')
      if (!sessions.find(token)) return error(res, true, 401, 'invalidSession', 'Invalid or expired session token.')
      res.json({ session: token })
    })
  }

  return router
}

module.exports = { createDiscordAuthRouter }
