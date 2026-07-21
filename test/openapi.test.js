'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

test('OpenAPI document parses and covers every canonical route group', () => {
  const document = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8'))
  assert.match(document.openapi, /^3\./)
  const paths = Object.keys(document.paths)
  const required = [
    '/api/v2/launcher/news',
    '/api/v2/launcher/releases/current',
    '/api/v2/auth/discord/start',
    '/api/v2/admin/players',
    '/api/v2/admin/access-policy',
    '/api/v2/admin/content/{resource}',
    '/api/v2/game-servers/{key}/heartbeat',
    '/api/v2/game-servers/{key}/sessions/{token}/purchases',
    '/health/live',
    '/health/ready',
  ]
  for (const route of required) assert.ok(paths.includes(route), `missing OpenAPI path ${route}`)

  const operationIds = []
  for (const item of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (item[method]) operationIds.push(item[method].operationId)
    }
  }
  assert.equal(new Set(operationIds).size, operationIds.length)
  assert.ok(operationIds.every(Boolean), 'every operation needs an operationId')
})
