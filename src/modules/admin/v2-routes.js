'use strict'

const { Router } = require('express')
const { createAdminAuthRouter } = require('./auth-routes')

function adapt(router, transform) {
  const wrapper = Router()
  wrapper.use((req, res, next) => {
    const send = res.json.bind(res)
    res.json = body => {
      if (res.statusCode >= 400 && body && typeof body.error === 'string') {
        return send({ error: { code: body.error.replace(/\s+/g, '_'), message: body.error } })
      }
      return send(transform ? transform(req, body) : body)
    }
    next()
  })
  wrapper.use(router)
  return wrapper
}

function createV2AdminRouter(legacy) {
  const router = Router()
  router.use('/auth', createAdminAuthRouter())
  router.use('/players', adapt(legacy.players, (req, body) => {
    if (req.method === 'GET' && req.path === '/' && body && Array.isArray(body.players)) return { items: body.players, total: body.players.length }
    return body
  }))
  router.use('/access-policy', adapt(legacy.access))
  router.use('/access-checks', adapt(createAccessCheckAlias(legacy.access)))
  router.use('/role-permissions', adapt(legacy.permissions))
  router.use('/faction-assignments', adapt(createFactionAlias(legacy.factions), factionCollection))
  router.use('/content/lore', adapt(legacy.lore, collection))
  router.use('/content/rules', adapt(legacy.rules, collection))
  router.use('/content/whitelist-notes', adapt(legacy.whitelistNotes))
  router.use('/proxy', adapt(legacy.proxy))
  return router
}

function collection(req, body) {
  if (req.method === 'GET' && req.path === '/' && Array.isArray(body)) return { items: body, total: body.length }
  return body
}

function factionCollection(req, body) {
  if (req.method === 'GET' && req.path === '/' && body && Array.isArray(body.assignments)) {
    return { items: body.assignments, total: body.assignments.length, requirements: body.requirements || [] }
  }
  return body
}

function createAccessCheckAlias(accessRouter) {
  const router = Router()
  router.get('/:discordId', (req, res, next) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    req.url = `/check/${encodeURIComponent(req.params.discordId)}${query}`
    accessRouter.handle(req, res, next)
  })
  return router
}

function createFactionAlias(factionRouter) {
  const router = Router()
  router.use((req, _res, next) => {
    if (req.path === '/' && req.method !== 'GET') req.url = '/assignments'
    else if (/^\/[^/]+$/.test(req.path) && req.method !== 'GET') req.url = `/assignments${req.url}`
    next()
  })
  router.use(factionRouter)
  return router
}

module.exports = { createV2AdminRouter }
