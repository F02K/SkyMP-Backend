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
    // Needed by the launcher to write correct skymp5-client-settings.txt
    masterKey:           config.serverMasterKey  || null,
    masterUrl:           config.masterUrl         || null,
    // Lockdown state — launcher uses this to show an indicator and block Play
    locked:              config.serverLocked,
  })
})

module.exports = router
