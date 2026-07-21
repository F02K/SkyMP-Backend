'use strict'

const crypto = require('crypto')
const { Router } = require('express')
const config = require('../../config')
const sessions = require('../auth/dashboard-session-service')
const discordBot = require('../../integrations/discord/bot')
const oauth = require('../../integrations/discord/oauth-client')
const { hasPermission, resolvePermissions } = require('../access/permission-service')

const pending = new Map()

function allowedRedirect(value) {
  const fallback = `${config.project.websiteUrl.replace(/\/$/, '')}/dashboard`
  if (!value) return fallback
  try {
    const candidate = new URL(value)
    const allowed = [config.project.websiteUrl, config.dashboard.publicUrl].map(url => new URL(url).origin)
    return allowed.includes(candidate.origin) ? candidate.toString() : fallback
  } catch { return fallback }
}

function bearer(req) {
  const value = req.headers.authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

function createAdminAuthRouter() {
  const router = Router()
  router.get('/start', (req, res) => {
    if (!config.discord.clientId) return res.status(503).json({ error: { code: 'discordNotConfigured', message: 'Discord OAuth is not configured.' } })
    const state = crypto.randomBytes(16).toString('hex')
    const redirectUrl = allowedRedirect(req.query.redirect)
    pending.set(state, { redirectUrl, expiresAt: Date.now() + 10 * 60 * 1000 })
    const params = new URLSearchParams({
      client_id: config.discord.clientId,
      redirect_uri: config.discord.dashboardRedirectUri,
      response_type: 'code', scope: 'identify', state,
    })
    res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` })
  })

  router.get('/callback', async (req, res) => {
    const fallback = allowedRedirect()
    const state = String(req.query.state || '')
    const entry = pending.get(state)
    if (req.query.error) return res.redirect(`${fallback}?error=cancelled`)
    if (!req.query.code || !entry || entry.expiresAt <= Date.now()) return res.redirect(`${fallback}?error=expired`)
    pending.delete(state)
    try {
      const token = await oauth.exchangeCode({
        clientId: config.discord.clientId,
        clientSecret: config.secrets.discordClientSecret,
        code: req.query.code,
        redirectUri: config.discord.dashboardRedirectUri,
      })
      const user = await oauth.getCurrentUser(token.access_token)
      const roleIds = await discordBot.getMemberRoles(user.id)
      const permissions = resolvePermissions(roleIds)
      if (config.discord.dashboardUserIds.includes(user.id) && !permissions.includes('admin.*')) permissions.push('admin.*')
      if (!hasPermission(permissions, 'dashboard.access') && !config.discord.dashboardUserIds.includes(user.id)) {
        return res.redirect(`${entry.redirectUrl}?error=unauthorized`)
      }
      const username = user.global_name || user.username
      const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null
      const session = sessions.create(user.id, username, avatar, roleIds, permissions)
      res.redirect(`${entry.redirectUrl}?token=${session}`)
    } catch (error) {
      console.error('[admin-auth] callback failed:', error.message)
      res.redirect(`${entry.redirectUrl}?error=server_error`)
    }
  })

  router.get('/session', (req, res) => {
    const session = sessions.validate(bearer(req))
    if (!session) return res.status(401).json({ error: { code: 'invalidSession', message: 'Session is invalid or expired.' } })
    res.json({ user: session })
  })

  router.post('/logout', (req, res) => {
    const token = bearer(req)
    if (token) sessions.revoke(token)
    res.json({ ok: true })
  })
  return router
}

module.exports = { createAdminAuthRouter }
