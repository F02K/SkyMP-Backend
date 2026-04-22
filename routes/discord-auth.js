const router = require('express').Router()
const https  = require('https')
const crypto = require('crypto')
const config = require('../config')

// Temporary store: state token → launcher callback URL (10-minute TTL)
const pendingAuth = new Map()

// Completed in-game auth store: state → session info (5-minute TTL, consumed on read)
const completedAuth = new Map()
const COMPLETED_AUTH_TTL = 5 * 60 * 1000

function pruneCompletedAuth() {
  const now = Date.now()
  for (const [k, v] of completedAuth)
    if (v.expiresAt < now) completedAuth.delete(k)
}

// GET /auth/discord/url — returns the Discord OAuth authorization URL and the state token.
// Optional ?redirect=<launcher-local-url> — when present the callback route
// will forward the code there instead of returning a plain page.
// In-game clients omit ?redirect and poll GET /auth/discord/status?state=... instead.
router.get('/url', (req, res) => {
  if (!config.discordClientId) {
    return res.status(503).json({ error: 'Discord auth not configured on this server.' })
  }

  const state = crypto.randomBytes(16).toString('hex')

  if (req.query.redirect) {
    pendingAuth.set(state, req.query.redirect)
    setTimeout(() => pendingAuth.delete(state), 10 * 60 * 1000)
  }

  const params = new URLSearchParams({
    client_id:     config.discordClientId,
    redirect_uri:  config.discordRedirectUri,
    response_type: 'code',
    scope:         'identify',
    state,
  })
  // Return both url and state so the caller knows what state to poll with
  res.json({ url: `https://discord.com/api/oauth2/authorize?${params}`, state })
})

// GET /auth/discord/status?state=... — poll for completed in-game OAuth.
// Returns 401 while auth is still pending, 200 with session data once complete.
// Consumes the entry on first successful read.
router.get('/status', (req, res) => {
  pruneCompletedAuth()
  const { state } = req.query
  if (!state) return res.status(400).json({ error: 'Missing state.' })
  const entry = completedAuth.get(state)
  if (!entry) return res.status(401).json({ error: 'Auth not completed yet.' })
  completedAuth.delete(state)
  res.json(entry)
})


// GET /auth/discord/exchange?code=... — exchanges code for user info
router.get('/exchange', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code.' })

  if (!config.discordClientId || !config.discordClientSecret) {
    return res.status(503).json({ error: 'Discord auth not fully configured (missing credentials).' })
  }

  try {
    const tokenData = await discordTokenExchange({
      client_id:     config.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  config.discordRedirectUri,
    })

    const user = await discordGetUser(tokenData.access_token)

    res.json({
      ok: true,
      user: {
        id:       user.id,
        username: user.global_name || user.username,
        tag:      user.discriminator !== '0'
          ? `${user.username}#${user.discriminator}`
          : user.username,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
          : null,
      },
      accessToken: tokenData.access_token,
    })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function discordTokenExchange(params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString()
    const req  = https.request(
      {
        hostname: 'discord.com',
        path:     '/api/oauth2/token',
        method:   'POST',
        headers:  {
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          const json = JSON.parse(data)
          if (json.error) reject(new Error(json.error_description || json.error))
          else resolve(json)
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function discordGetUser(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: 'discord.com',
        path:     '/api/users/@me',
        headers:  { Authorization: `Bearer ${accessToken}` },
      },
      res => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => resolve(JSON.parse(data)))
      }
    )
    req.on('error', reject)
  })
}

// Called by the /auth/callback handler in server.js when there is no launcher redirect.
// Exchanges the OAuth code, creates a session, and stores the result for polling.
async function handleInGameCallback(code, state) {
  const { createSession } = require('./master-api')

  const tokenData = await discordTokenExchange({
    client_id:     config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  config.discordRedirectUri,
  })

  const user = await discordGetUser(tokenData.access_token)

  const { session, profileId } = createSession({
    id:       user.id,
    username: user.global_name || user.username,
  })

  completedAuth.set(state, {
    session,
    profileId,
    discordId: user.id,
    username:  user.global_name || user.username,
    avatar: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null,
    expiresAt: Date.now() + COMPLETED_AUTH_TTL,
  })
}

module.exports = router
module.exports.pendingAuth          = pendingAuth
module.exports.completedAuth        = completedAuth
module.exports.handleInGameCallback = handleInGameCallback
