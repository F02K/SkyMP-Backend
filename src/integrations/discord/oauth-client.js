'use strict'

const https = require('https')

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, response => {
      let data = ''
      response.on('data', chunk => { data += chunk })
      response.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (response.statusCode >= 400 || result.error) reject(new Error(result.error_description || result.message || result.error || `Discord HTTP ${response.statusCode}`))
          else resolve(result)
        } catch (error) { reject(error) }
      })
    })
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  }).toString()
  return requestJson({
    hostname: 'discord.com',
    path: '/api/oauth2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body)
}

function getCurrentUser(accessToken) {
  return requestJson({
    hostname: 'discord.com',
    path: '/api/users/@me',
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

module.exports = { exchangeCode, getCurrentUser }
