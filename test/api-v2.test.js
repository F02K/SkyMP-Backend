'use strict'

const assert = require('node:assert/strict')
const { once } = require('node:events')
const test = require('node:test')
const express = require('express')
const { createApp } = require('../src/http/create-app')
const { createV2AdminRouter } = require('../src/modules/admin/v2-routes')
const { serverDetails } = require('../src/modules/game-servers/routes')
const playSessions = require('../src/modules/auth/play-session-service')
const accessService = require('../src/modules/access/access-service')

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('app builder exposes health, v2 collections, and legacy deprecation headers', async () => {
  await withServer(createApp({ ready: () => true }), async base => {
    const health = await fetch(`${base}/health/ready`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ready' })

    const news = await fetch(`${base}/api/v2/launcher/news`)
    assert.equal(news.status, 200)
    const newsBody = await news.json()
    assert.ok(Array.isArray(newsBody.items))
    assert.equal(newsBody.total, newsBody.items.length)

    const servers = await fetch(`${base}/api/v2/launcher/servers`)
    const serverBody = await servers.json()
    assert.equal(serverBody.items[0].key, 'default')
    assert.equal(Object.hasOwn(serverBody.items[0], 'masterKey'), false)

    const legacy = await fetch(`${base}/api/servers`)
    assert.equal(legacy.headers.get('deprecation'), 'true')
    assert.match(legacy.headers.get('link'), /\/docs/)

    const directSession = await fetch(`${base}/auth/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(directSession.status, 410)

    const missing = await fetch(`${base}/api/v2/does-not-exist`)
    assert.deepEqual(await missing.json(), { error: { code: 'notFound', message: 'Route was not found.' } })

    const admin = await fetch(`${base}/api/v2/admin/players`)
    assert.equal(admin.status, 401)
    assert.equal((await admin.json()).error.code, 'not_authenticated')

    const heartbeat = await fetch(`${base}/api/v2/game-servers/invalid/heartbeat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(heartbeat.status, 403)
    assert.equal((await heartbeat.json()).error.code, 'invalidServerKey')

    const docs = await fetch(`${base}/docs/openapi.yaml`)
    assert.equal(docs.status, 200)
    assert.match(await docs.text(), /^openapi: 3\./)
  })
})

test('session-aware server details use the centralized access service', async () => {
  const originalFind = playSessions.find
  const originalAccess = accessService.getDiscordAccess
  playSessions.find = () => ({ discordId: '42' })
  accessService.getDiscordAccess = async discordId => ({ allowed: discordId === '42', roles: [] })
  try {
    const details = await serverDetails('test-session')
    assert.equal(details.sessionValid, true)
    assert.equal(details.allowed, true)
  } finally {
    playSessions.find = originalFind
    accessService.getDiscordAccess = originalAccess
  }
})

function stubRouter(register) {
  const router = express.Router()
  register(router)
  return router
}

test('v2 admin aliases forward to the domain route shapes', async () => {
  const legacy = {
    players: stubRouter(router => router.get('/', (_req, res) => res.json({ players: [{ id: 1 }] }))),
    access: stubRouter(router => {
      router.get('/', (_req, res) => res.json({ locked: false }))
      router.get('/check/:discordId', (req, res) => res.json({ discordId: req.params.discordId, allowed: true }))
    }),
    permissions: stubRouter(router => router.get('/', (_req, res) => res.json({ roles: {} }))),
    factions: stubRouter(router => {
      router.get('/', (_req, res) => res.json({ requirements: [], assignments: [] }))
      router.post('/assignments', (_req, res) => res.status(201).json({ id: 'created' }))
      router.delete('/assignments/:id', (req, res) => res.json({ deleted: req.params.id }))
    }),
    lore: stubRouter(router => router.get('/', (_req, res) => res.json([{ id: 'entry' }]))),
    rules: stubRouter(router => router.get('/', (_req, res) => res.json([]))),
    whitelistNotes: stubRouter(router => router.get('/', (_req, res) => res.json({ content: '' }))),
    proxy: stubRouter(router => router.all('/*', (_req, res) => res.json({ ok: true }))),
  }
  const app = express()
  app.use(express.json())
  app.use('/api/v2/admin', createV2AdminRouter(legacy))

  await withServer(app, async base => {
    const players = await fetch(`${base}/api/v2/admin/players`).then(response => response.json())
    assert.deepEqual(players, { items: [{ id: 1 }], total: 1 })

    const access = await fetch(`${base}/api/v2/admin/access-checks/42`).then(response => response.json())
    assert.deepEqual(access, { discordId: '42', allowed: true })

    const lore = await fetch(`${base}/api/v2/admin/content/lore`).then(response => response.json())
    assert.deepEqual(lore, { items: [{ id: 'entry' }], total: 1 })

    const factions = await fetch(`${base}/api/v2/admin/faction-assignments`).then(response => response.json())
    assert.deepEqual(factions, { items: [], total: 0, requirements: [] })

    const created = await fetch(`${base}/api/v2/admin/faction-assignments`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(created.status, 201)

    const removed = await fetch(`${base}/api/v2/admin/faction-assignments/abc`, { method: 'DELETE' }).then(response => response.json())
    assert.deepEqual(removed, { deleted: 'abc' })
  })
})
