'use strict'

const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const { migrateData } = require('../scripts/migrate-data')

function temporaryData() { return fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-data-')) }

test('data migration dry-run does not change files', () => {
  const dataDir = temporaryData()
  fs.writeFileSync(path.join(dataDir, 'news.json'), '[]')
  const result = migrateData({ dataDir, apply: false })
  assert.equal(result.actions.length, 1)
  assert.ok(fs.existsSync(path.join(dataDir, 'news.json')))
  assert.ok(!fs.existsSync(path.join(dataDir, 'content', 'news.json')))
})

test('data migration creates a backup and is idempotent', () => {
  const dataDir = temporaryData()
  fs.writeFileSync(path.join(dataDir, 'news.json'), '[{"id":1}]')
  const result = migrateData({ dataDir, apply: true, now: new Date('2026-01-02T03:04:05Z') })
  assert.equal(result.applied, true)
  assert.ok(fs.existsSync(path.join(dataDir, 'content', 'news.json')))
  assert.ok(fs.existsSync(path.join(result.backupDir, 'news.json')))
  assert.equal(migrateData({ dataDir, apply: false }).actions.length, 0)
})

test('data migration rejects conflicting layouts before writing', () => {
  const dataDir = temporaryData()
  fs.mkdirSync(path.join(dataDir, 'content'))
  fs.writeFileSync(path.join(dataDir, 'news.json'), '[]')
  fs.writeFileSync(path.join(dataDir, 'content', 'news.json'), '[1]')
  assert.throws(() => migrateData({ dataDir, apply: true }), /differ/)
  assert.ok(fs.existsSync(path.join(dataDir, 'news.json')))
})
