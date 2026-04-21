const router      = require('express').Router()
const config      = require('../config')
const { lookupSession } = require('./master-api')
const { getHeartbeat }  = require('./servers')

router.get('/', (req, res) => {
  const token = req.headers['x-session']

  let sessionValid = false
  let allowed      = true   // true when no session provided (offline / launcher handles it)

  if (token) {
    const entry = lookupSession(token)
    if (!entry) {
      sessionValid = false
      allowed      = false
    } else {
      sessionValid = true
      allowed      = config.serverLocked
        ? config.serverLockedAllowList.includes(entry.discordId)
        : true
    }
  }

  const hb = getHeartbeat()

  res.json({
    name:                hb?.name       ?? config.serverName,
    maxPlayers:          hb?.maxPlayers ?? config.serverMaxPlayers,
    port:                config.skyrimServerPort,
    offlineMode:         config.serverOfflineMode,
    npcEnabled:          config.serverNpcEnabled,
    gamemode:            config.serverGamemode,
    discordAuthRequired: !!config.discordClientId,
    masterKey:           config.serverMasterKey  || null,
    masterUrl:           config.masterUrl         || null,
    locked:              config.serverLocked,
    lockedAllowList:     config.serverLockedAllowList,
    // Session-aware fields — only meaningful when X-Session header is present
    sessionValid,
    allowed,
  })
})

module.exports = router
