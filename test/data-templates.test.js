'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('neutral data seed contains valid JSON without project-specific identifiers', () => {
  const root = path.join(__dirname, '..', 'examples', 'data')
  const files = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.name.endsWith('.json')) files.push(target)
    }
  }
  walk(root)
  assert.ok(files.length >= 10)
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    JSON.parse(raw)
    assert.doesNotMatch(raw, /frostfall/i)
    assert.doesNotMatch(raw, /\b\d{16,20}\b/)
  }
})
