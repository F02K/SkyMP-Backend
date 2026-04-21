'use strict'

const router = require('express').Router()
const config = require('../config')

// Last heartbeat received from the game server via POST /:key
let heartbeat = null

router.get('/', (_req, res) => {
  res.json([
    {
      name:    heartbeat?.name    ?? config.serverName,
      address: config.skyrimServerHost,
      port:    config.skyrimServerPort,
      online:  heartbeat?.online  ?? null,
      maxPlayers: heartbeat?.maxPlayers ?? config.serverMaxPlayers,
      lastSeen:   heartbeat?.lastSeen   ?? null,
    },
  ])
})

// Called by MasterClient every 5 s: POST /api/servers/:key
// Body: { name, maxPlayers, online }
router.post('/:key', (req, res) => {
  if (req.params.key !== config.serverMasterKey) {
    return res.status(403).json({ error: 'Invalid master key.' })
  }

  const { name, maxPlayers, online } = req.body || {}
  heartbeat = {
    name:       typeof name       === 'string' ? name       : config.serverName,
    maxPlayers: typeof maxPlayers === 'number' ? maxPlayers : config.serverMaxPlayers,
    online:     typeof online     === 'number' ? online     : null,
    lastSeen:   new Date().toISOString(),
  }

  res.json({ ok: true })
})

module.exports = router
module.exports.getHeartbeat = () => heartbeat
