const router = require('express').Router()
const config = require('../config')

router.get('/', (_req, res) => {
  res.json([
    {
      name:    config.serverName,
      address: config.skyrimServerHost,
      port:    config.skyrimServerPort,
    },
  ])
})

module.exports = router
