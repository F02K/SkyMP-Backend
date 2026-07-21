'use strict'

const fs = require('fs')
const path = require('path')
const cors = require('cors')
const express = require('express')
const config = require('../config')
const { legacyApi } = require('./deprecation')
const { setLauncherUpdateHeaders } = require('../modules/launcher/update-service')
const { createV2LauncherRouter, versionPayload } = require('../modules/launcher/routes')
const { createDiscordAuthRouter } = require('../modules/auth/discord-routes')
const {
  createLegacyMasterRouter, createLegacyServerInfoRouter, createLegacyServerRouter, createV2GameServerRouter,
} = require('../modules/game-servers/routes')
const { createV2AdminRouter } = require('../modules/admin/v2-routes')
const { createAdminAuthRouter } = require('../modules/admin/auth-routes')
const { errorBody } = require('../shared/http-error')

function legacyAdminAuthAdapter() {
  const target = createAdminAuthRouter()
  const router = express.Router()
  router.use((req, _res, next) => {
    if (req.path === '/url') req.url = req.url.replace('/url', '/start')
    else if (req.path === '/me') req.url = req.url.replace('/me', '/session')
    next()
  })
  router.use(target)
  return router
}

function createApp({ ready = () => true } = {}) {
  const app = express()
  if (config.http.trustProxy) app.set('trust proxy', config.http.trustProxy)
  const origins = config.http.corsOrigins
  app.use(cors({ origin: origins.includes('*') ? true : origins }))
  app.use(express.json({
    limit: '2mb',
    verify: (req, _res, buffer) => { req.rawBody = buffer },
  }))

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }))
  app.get('/health/ready', (_req, res) => ready() ? res.json({ status: 'ready' }) : res.status(503).json({ status: 'starting' }))

  app.use('/files/root', express.static(path.join(config.distribution.clientOutputDir, 'root')))
  app.use('/images', express.static(path.join(config.rootDir, 'public', 'images')))
  app.use('/launcher-updates', express.static(config.distribution.launcherUpdatesDir, { setHeaders: setLauncherUpdateHeaders }))

  app.use('/api/v2/launcher', createV2LauncherRouter())
  app.use('/api/v2/auth/discord', createDiscordAuthRouter())
  app.use('/api/v2/game-servers', createV2GameServerRouter())
  if (config.features.githubWebhook) {
    app.use('/api/v2/integrations', require('../integrations/github/webhook-routes'))
  }

  const legacy = {
    players: require('../modules/players/admin-routes'),
    access: require('../modules/access/admin-access-routes'),
    permissions: require('../modules/access/admin-permission-routes'),
    factions: require('../modules/factions/admin-routes'),
    lore: require('../modules/content/lore-routes'),
    rules: require('../modules/content/rules-routes'),
    whitelistNotes: require('../modules/content/whitelist-notes-routes'),
    proxy: require('../modules/admin/proxy-routes'),
  }
  app.use('/api/v2/admin', createV2AdminRouter(legacy))

  if (config.features.apiDocs) mountDocs(app)

  app.use('/api/news', legacyApi, require('../modules/launcher/legacy-news-routes'))
  app.use('/api/status', legacyApi, require('../modules/launcher/legacy-status-routes'))
  app.use('/api/manifest', legacyApi, require('../modules/launcher/legacy-manifest-routes'))
  app.get('/api/version', legacyApi, (_req, res) => res.json(versionPayload()))
  app.use('/api/serverinfo', legacyApi, createLegacyServerInfoRouter())
  app.use('/api/metrics', legacyApi, require('../modules/launcher/legacy-metrics-routes'))
  app.use('/api/files', legacyApi, require('../modules/launcher/legacy-client-files-routes'))
  app.use('/api/modlist', legacyApi, require('../modules/launcher/legacy-mods-routes'))
  app.use('/api/users', legacyApi, createDiscordAuthRouter({ legacy: true }))
  app.use('/auth', legacyApi, createLegacyMasterRouter())
  app.use('/api/servers', legacyApi, createLegacyServerRouter())
  app.use('/auth/dashboard', legacyApi, legacyAdminAuthAdapter())
  if (config.features.githubWebhook) {
    app.use('/webhooks', legacyApi, require('../integrations/github/webhook-routes'))
  }
  app.use('/api/admin', legacyApi, legacy.proxy)
  app.use('/api/lore', legacyApi, legacy.lore)
  app.use('/api/rules', legacyApi, legacy.rules)
  app.use('/api/whitelist', legacyApi, require('../modules/access/admin-whitelist-routes'))
  app.use('/api/whitelist-notes', legacyApi, legacy.whitelistNotes)
  app.use('/api/faction-whitelist', legacyApi, legacy.factions)
  app.use('/api/role-permissions', legacyApi, legacy.permissions)
  app.use('/api/server-access', legacyApi, legacy.access)
  app.use('/api/players', legacyApi, legacy.players)

  app.use((_req, res) => res.status(404).json({ error: { code: 'notFound', message: 'Route was not found.' } }))
  app.use((error, req, res, _next) => {
    console.error('[http] unhandled request error:', error.message)
    const v2 = req.path.startsWith('/api/v2/')
    if (v2) return res.status(error.status || 500).json(errorBody(error))
    res.status(error.status || 500).json({ error: error.expose ? error.message : 'Internal server error.' })
  })
  return app
}

function mountDocs(app) {
  const specPath = path.join(config.rootDir, 'docs', 'openapi.yaml')
  app.get('/docs/openapi.yaml', (_req, res) => res.sendFile(specPath))
  app.get('/docs', (_req, res) => {
    const title = `${config.project.name} API`
    res.type('html').send(`<!doctype html><html><head><title>${title}</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/docs/openapi.yaml',dom_id:'#swagger-ui'})</script></body></html>`)
  })
}

module.exports = { createApp }
