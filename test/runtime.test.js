'use strict'

const assert = require('node:assert/strict')
const express = require('express')
const test = require('node:test')
const { startRuntime } = require('../src/runtime/start')

function runtimeConfig(overrides = {}) {
  return {
    project: { name: 'Test Backend' },
    http: { port: 0 },
    features: { websocketRelay: false, discordBot: false, ...overrides },
  }
}

test('runtime starts an injected app on an ephemeral port and shuts it down', async () => {
  let ready
  const runtime = await startRuntime({
    runtimeConfig: runtimeConfig(),
    createApiApp: options => {
      ready = options.ready
      const app = express()
      app.get('/health/ready', (_req, res) => res.status(ready() ? 200 : 503).end())
      return app
    },
    startDashboardService: async () => null,
  })
  assert.equal(ready(), true)
  const port = runtime.api.address().port
  assert.equal((await fetch(`http://127.0.0.1:${port}/health/ready`)).status, 200)
  await runtime.stop()
  assert.equal(ready(), false)
})

test('runtime rolls back already-started services after partial startup failure', async () => {
  let relayStopped = false
  const relay = {
    start: async () => {},
    stop: async () => { relayStopped = true },
  }
  await assert.rejects(() => startRuntime({
    runtimeConfig: runtimeConfig({ websocketRelay: true, discordBot: true }),
    createApiApp: () => express(),
    startDashboardService: async () => null,
    relay,
    discord: { start: async () => { throw new Error('login failed') }, stop: async () => {} },
  }), /login failed/)
  assert.equal(relayStopped, true)
})
