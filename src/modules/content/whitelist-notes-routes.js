'use strict'
// ── Whitelist staff notes API ─────────────────────────────────────────────────
// A single editable document with notes for staff handling whitelist applications.
// Read requires 'staff.whitelist_info', write requires 'rules.write' (Management).

const { Router }        = require('express')
const requirePermission = require('../../http/require-permission')
const { JsonStore } = require('../../shared/storage/json-store')
const { resolveDataFile } = require('../../shared/storage/paths')

const router = Router()
const store = new JsonStore({
  filePath: resolveDataFile('whitelistNotes'),
  defaultValue: { content: '', updatedAt: null, updatedBy: null },
  validate: value => value && typeof value === 'object' && !Array.isArray(value),
})

function load() {
  try {
    return store.read()
  } catch {
    return { content: '', updatedAt: null, updatedBy: null }
  }
}

function save(data) { store.write(data) }

// GET /api/whitelist-notes  — requires staff.whitelist_info
router.get('/', requirePermission('staff.whitelist_info'), (_req, res) => {
  res.json(load())
})

// PUT /api/whitelist-notes  — requires rules.write
router.put('/', requirePermission('rules.write'), (req, res) => {
  const { content } = req.body || {}
  if (content === undefined) return res.status(400).json({ error: 'content required' })
  const doc = {
    content,
    updatedAt: new Date().toISOString(),
    updatedBy: req.session.discordId,
  }
  save(doc)
  res.json(doc)
})

module.exports = router
