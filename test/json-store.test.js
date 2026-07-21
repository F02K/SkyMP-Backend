'use strict'

const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const { JsonStore } = require('../src/shared/storage/json-store')

test('JsonStore creates directories and atomically persists JSON', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-json-store-'))
  const filePath = path.join(root, 'nested', 'state.json')
  const store = new JsonStore({ filePath, defaultValue: { count: 0 }, validate: value => Number.isInteger(value.count) })
  assert.deepEqual(store.read(), { count: 0 })
  store.update(value => ({ count: value.count + 1 }))
  assert.deepEqual(store.read(), { count: 1 })
  assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ['state.json'])
})

test('JsonStore rejects invalid writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-json-store-'))
  const store = new JsonStore({ filePath: path.join(root, 'state.json'), defaultValue: [], validate: Array.isArray })
  assert.throws(() => store.write({}), /invalid JSON/)
})
