'use strict'

const config = require('../config')
const { createApp } = require('../http/create-app')
const { startDashboard } = require('../modules/admin/dashboard-server')
const { createRelay } = require('../integrations/websocket/relay')
const discordBot = require('../integrations/discord/bot')
const webhookJobs = require('../integrations/github/webhook-routes')

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    server.once('error', reject)
  })
}

function closeServer(server) {
  if (!server) return Promise.resolve()
  return new Promise(resolve => server.close(() => resolve()))
}

async function startRuntime({
  runtimeConfig = config,
  createApiApp = createApp,
  startDashboardService = startDashboard,
  relay = createRelay(),
  discord = discordBot,
  listenService = listen,
} = {}) {
  const started = []
  let isReady = false
  try {
    const api = await listenService(createApiApp({ ready: () => isReady }), runtimeConfig.http.port)
    started.push(() => closeServer(api))
    const dashboard = await startDashboardService()
    if (dashboard) started.push(() => closeServer(dashboard))
    if (runtimeConfig.features.websocketRelay) {
      await relay.start()
      started.push(() => relay.stop())
    }
    if (runtimeConfig.features.discordBot) {
      await discord.start()
      started.push(() => discord.stop())
    }
    isReady = true
    console.log(`[runtime] ${runtimeConfig.project.name} API listening on port ${api.address().port}`)

    let stopping = false
    async function stop() {
      if (stopping) return
      stopping = true
      isReady = false
      for (const close of started.reverse()) {
        try { await close() } catch (error) { console.error('[runtime] shutdown error:', error.message) }
      }
      if (runtimeConfig.features.githubWebhook) await webhookJobs.waitForIdle()
    }
    return { api, dashboard, relay, stop }
  } catch (error) {
    for (const close of started.reverse()) {
      try { await close() } catch { /* preserve startup error */ }
    }
    throw error
  }
}

module.exports = { startRuntime }
