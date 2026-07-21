const router  = require('express').Router()
const fs = require('fs')
const { resolveDataFile } = require('../../shared/storage/paths')

router.get('/', (_req, res) => res.json(JSON.parse(fs.readFileSync(resolveDataFile('modlist'), 'utf8'))))

module.exports = router
