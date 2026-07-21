'use strict'

const assert = require('node:assert/strict')
const path = require('path')
const test = require('node:test')
const { loadConfig } = require('../src/config')
const { loadEnvironment } = require('../src/config/environment')
const { redactSecrets, validateProjectConfig } = require('../src/config/validation')
const fs = require('node:fs')
const os = require('node:os')

const rootDir = path.join(__dirname, '..')

test('environment values override project configuration', () => {
  const config = loadConfig({ rootDir, env: { PORT: '4100', SERVER_NAME: 'Test Realm', FEATURE_DISCORD_BOT: 'false' } })
  assert.equal(config.http.port, 4100)
  assert.equal(config.skymp.serverName, 'Test Realm')
  assert.equal(config.features.discordBot, false)
})

test('legacy flat aliases reference the nested configuration', () => {
  const config = loadConfig({ rootDir, env: { FEATURE_DISCORD_BOT: 'false' } })
  assert.equal(config.serverName, config.skymp.serverName)
  assert.equal(config.launcherUpdatePublicUrl, config.distribution.launcherUpdatePublicUrl)
  assert.ok(Object.isFrozen(config))
})

test('legacy direct sessions require a master API token', () => {
  assert.throws(
    () => loadConfig({ rootDir, env: { LEGACY_DIRECT_SESSION_CREATION: 'true', FEATURE_DISCORD_BOT: 'false' } }),
    /MASTER_API_AUTH_TOKEN/
  )
})

test('project validation rejects unknown schema properties', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend.config.json'), 'utf8'))
  raw.features.typo = true
  assert.throws(() => validateProjectConfig(raw), /features\.typo is not supported/)
})

test('deprecated shared environment alias warns and loads explicitly selected file', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-env-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  fs.writeFileSync(path.join(temporary, 'shared.env'), 'PROJECT_NAME=Shared Project\n')
  const env = { FROSTFALL_SHARED_ENV: 'shared.env' }
  const warnings = []
  loadEnvironment({ rootDir: temporary, env, logger: { warn: value => warnings.push(value) } })
  assert.equal(env.PROJECT_NAME, 'Shared Project')
  assert.match(warnings[0], /deprecated/)
})

test('production validation requires enabled integration secrets without exposing values', () => {
  assert.throws(() => loadConfig({ rootDir, env: {
    NODE_ENV: 'production', PUBLIC_API_URL: 'https://api.example.test', WEBSITE_URL: 'https://example.test',
    DASHBOARD_PUBLIC_URL: 'https://dashboard.example.test', DASHBOARD_API_BASE_URL: 'https://api.example.test',
    MASTER_URL: 'https://api.example.test', LAUNCHER_UPDATE_PUBLIC_URL: 'https://api.example.test/launcher-updates',
  } }), /SERVER_MASTER_KEY/)
  const previous = process.env.ADMIN_TOKEN
  process.env.ADMIN_TOKEN = 'secret-value-that-must-not-leak'
  try { assert.equal(redactSecrets('failure secret-value-that-must-not-leak'), 'failure [redacted]') }
  finally {
    if (previous === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = previous
  }
})
