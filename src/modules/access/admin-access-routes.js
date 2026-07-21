'use strict'

const { Router }        = require('express')
const requirePermission = require('../../http/require-permission')
const serverAccess = require('./access-service')

const router = Router()

router.get('/', requirePermission('server.access.view'), (_req, res) => {
  res.json(serverAccess.publicState())
})

router.put('/', requirePermission('server.access.manage'), (req, res) => {
  res.json(serverAccess.update(req.body || {}))
})

router.get('/check/:discordId', requirePermission('server.access.view'), async (req, res) => {
  try {
    const result = await serverAccess.getDiscordAccess(req.params.discordId)
    res.json({
      discordId: req.params.discordId,
      allowed: result.allowed,
      error: result.error || null,
      roles: result.roles,
    })
  } catch (err) {
    res.status(503).json({ error: err.message || 'access check unavailable' })
  }
})

module.exports = router
