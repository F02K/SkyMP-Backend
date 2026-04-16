const router = require('express').Router()
const config = require('../config')

router.get('/', (_req, res) => {
  res.json({
    name:                config.serverName,
    maxPlayers:          config.serverMaxPlayers,
    port:                config.skyrimServerPort,
    offlineMode:         config.serverOfflineMode,
    npcEnabled:          config.serverNpcEnabled,
    gamemode:            config.serverGamemode,
    discordAuthRequired: !!config.discordClientId,
  })
})

module.exports = router
