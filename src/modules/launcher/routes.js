'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const config = require('../../config')
const { resolveDataFile } = require('../../shared/storage/paths')
const { getLegacyVersionInfo } = require('./update-service')
const statusService = require('./status-service')
const { serverDetails, serverSummary } = require('../game-servers/routes')

const fileLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })

function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(resolveDataFile(name), 'utf8')) }
  catch { return structuredClone(fallback) }
}

function newsItems(req) {
  const base = `${req.protocol}://${req.get('host')}`
  return readJson('news', []).map(item => ({
    ...item,
    image: item.image ? (/^https?:\/\//i.test(item.image) ? item.image : `${base}${item.image}`) : null,
  }))
}

function versionPayload(directory = config.distribution.launcherUpdatesDir, publicUrl = config.distribution.launcherUpdatePublicUrl) {
  try { return getLegacyVersionInfo(directory, publicUrl) }
  catch { return { version: '1.0.0', downloadUrl: config.project.websiteUrl } }
}

function manifestItems() {
  const root = path.join(config.distribution.clientOutputDir, 'root')
  const items = []
  function walk(directory, relative = '') {
    if (!fs.existsSync(directory)) return
    for (const name of fs.readdirSync(directory)) {
      const absolute = path.join(directory, name)
      const next = relative ? `${relative}/${name}` : name
      const stat = fs.statSync(absolute)
      if (stat.isDirectory()) walk(absolute, next)
      else items.push({
        url: `/files/root/${next}`,
        dest: next,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
        size: stat.size,
      })
    }
  }
  walk(root)
  return items
}

function sendClientDownload(req, res, v2) {
  const archive = path.join(config.distribution.clientOutputDir, config.distribution.clientArchiveName)
  if (!fs.existsSync(archive)) {
    const message = 'Client package not found. Run `npm run client:build` first.'
    return v2 ? res.status(404).json({ error: { code: 'clientPackageMissing', message } }) : res.status(404).json({ error: message })
  }
  res.download(archive, config.distribution.clientArchiveName)
}

function createV2LauncherRouter() {
  const router = Router()
  router.get('/news', (req, res) => { const items = newsItems(req); res.json({ items, total: items.length }) })
  router.get('/status', async (_req, res) => res.json(await statusService.getStatus()))
  router.get('/servers', (_req, res) => res.json({ items: [serverSummary()], total: 1 }))
  router.get('/servers/:key', async (req, res) => {
    if (req.params.key !== 'default') return res.status(404).json({ error: { code: 'serverNotFound', message: 'Server was not found.' } })
    res.json(await serverDetails(req.headers['x-session']))
  })
  router.get('/manifest', (_req, res) => {
    const items = manifestItems()
    if (!items.length) return res.status(503).json({ error: { code: 'manifestEmpty', message: 'No client files have been built.' } })
    res.json({ items, total: items.length })
  })
  router.get('/mods', (_req, res) => { const items = readJson('modlist', []); res.json({ items, total: items.length }) })
  router.get('/metrics', async (_req, res) => {
    try { res.json({ metrics: await statusService.fetchMetrics() }) }
    catch (error) { res.status(503).json({ error: { code: 'metricsUnavailable', message: error.message } }) }
  })
  router.get('/client/version', fileLimiter, (_req, res) => {
    const file = resolveDataFile('clientVersion')
    if (!fs.existsSync(file)) return res.status(404).json({ error: { code: 'clientPackageMissing', message: 'Client version metadata is missing.' } })
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')))
  })
  router.get('/client/download', fileLimiter, (req, res) => sendClientDownload(req, res, true))
  router.get('/releases/current', (_req, res) => res.json(versionPayload()))
  return router
}

module.exports = { createV2LauncherRouter, manifestItems, newsItems, sendClientDownload, versionPayload }
