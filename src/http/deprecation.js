'use strict'

function legacyApi(req, res, next) {
  res.setHeader('Deprecation', 'true')
  res.setHeader('Link', '</docs#legacy-api>; rel="deprecation"')
  next()
}

module.exports = { legacyApi }
