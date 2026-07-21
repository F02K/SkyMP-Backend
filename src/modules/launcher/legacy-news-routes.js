const router = require('express').Router()
const fs = require('fs')
const { resolveDataFile } = require('../../shared/storage/paths')

router.get('/', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`
  const news = JSON.parse(fs.readFileSync(resolveDataFile('news'), 'utf8'))
  const items = news.map(item => ({
    ...item,
    image: item.image
      ? /^https?:\/\//i.test(item.image) ? item.image : `${base}${item.image}`
      : null,
  }))
  res.json(items)
})

module.exports = router
