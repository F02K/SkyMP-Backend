'use strict'

const assert = require('node:assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const YAML = require('yaml')
const config = require('../src/config')
const { versionPayload: getVersionPayload } = require('../src/modules/launcher/routes')
const {
  getLegacyVersionInfo,
  setLauncherUpdateHeaders,
  syncLauncherUpdates,
} = require('../src/modules/launcher/update-service')

function sha512(data) {
  return crypto.createHash('sha512').update(data).digest('base64')
}

function createFixture(root) {
  const win = Buffer.from('windows installer')
  const linux = Buffer.from('linux appimage')
  fs.writeFileSync(path.join(root, 'SkyMP Launcher-1.2.0-win-x64.exe'), win)
  fs.writeFileSync(path.join(root, 'SkyMP-Launcher-1.2.0-linux-x64.AppImage'), linux)
  fs.writeFileSync(path.join(root, 'latest.yml'), YAML.stringify({
    version: '1.2.0',
    files: [{ url: 'SkyMP Launcher-1.2.0-win-x64.exe', sha512: sha512(win) }],
    path: 'SkyMP Launcher-1.2.0-win-x64.exe',
    sha512: sha512(win),
  }))
  fs.writeFileSync(path.join(root, 'latest-linux.yml'), YAML.stringify({
    version: '1.2.0',
    files: [{ url: 'SkyMP-Launcher-1.2.0-linux-x64.AppImage', sha512: sha512(linux) }],
    path: 'SkyMP-Launcher-1.2.0-linux-x64.AppImage',
    sha512: sha512(linux),
  }))
}

test('publishing validates and atomically copies both update channels', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-updates-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const source = path.join(temp, 'source')
  const target = path.join(temp, 'target')
  fs.mkdirSync(source)
  createFixture(source)
  fs.writeFileSync(path.join(source, 'stale-0.1.0.exe'), 'stale')

  const metadata = syncLauncherUpdates(source, target)
  assert.equal(metadata['latest.yml'].version, '1.2.0')
  assert.equal(metadata['latest-linux.yml'].version, '1.2.0')
  assert.equal(fs.existsSync(path.join(target, 'SkyMP Launcher-1.2.0-win-x64.exe')), true)
  assert.equal(fs.existsSync(path.join(target, 'stale-0.1.0.exe')), false)
})

test('publishing rejects a mismatched artifact checksum', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-updates-bad-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  createFixture(temp)
  fs.appendFileSync(path.join(temp, 'SkyMP Launcher-1.2.0-win-x64.exe'), 'tampered')
  assert.throws(() => syncLauncherUpdates(temp, path.join(temp, 'target')), /SHA-512 mismatch/)
})

test('legacy update payload points old launchers at the NSIS installer', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-updates-legacy-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  createFixture(temp)
  assert.deepEqual(getLegacyVersionInfo(temp, 'https://example.test/updates/'), {
    version: '1.2.0',
    downloadUrl: 'https://example.test/updates/SkyMP%20Launcher-1.2.0-win-x64.exe',
  })
})

test('legacy endpoint uses the configured neutral website without metadata', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-updates-empty-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  assert.deepEqual(getVersionPayload(temp, 'https://example.test/updates'), {
    version: '1.0.0',
    downloadUrl: config.project.websiteUrl,
  })
})

test('metadata is not cached while binary artifacts are immutable', () => {
  const headers = {}
  const res = { setHeader: (name, value) => { headers[name] = value } }
  setLauncherUpdateHeaders(res, 'C:/updates/latest.yml')
  assert.match(headers['Cache-Control'], /no-store/)
  setLauncherUpdateHeaders(res, 'C:/updates/SkyMP.exe')
  assert.match(headers['Cache-Control'], /immutable/)
})
