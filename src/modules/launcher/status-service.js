'use strict'

const http = require('http')
const net = require('net')
const config = require('../../config')

function tcpCheck(host, port, timeout = 3000) {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.connect(port, host, () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
  })
}

function fetchMetrics() {
  return new Promise((resolve, reject) => {
    const headers = {}
    if (config.integrations.metricsUser && config.secrets.metricsPassword) {
      headers.Authorization = `Basic ${Buffer.from(`${config.integrations.metricsUser}:${config.secrets.metricsPassword}`).toString('base64')}`
    }
    const request = http.get({
      hostname: config.skymp.host,
      port: config.skymp.uiPort,
      path: '/metrics',
      timeout: 5000,
      headers,
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        return reject(new Error(`HTTP ${response.statusCode}`))
      }
      let raw = ''
      response.on('data', chunk => { raw += chunk })
      response.on('end', () => resolve(parseMetrics(raw)))
    })
    request.on('error', reject)
    request.on('timeout', () => { request.destroy(); reject(new Error('timeout')) })
  })
}

function parseMetrics(raw) {
  const metrics = {}
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    const match = line.match(/^(skymp_\S+)\s+([\d.e+\-]+)/)
    if (match) metrics[match[1]] = Number.parseFloat(match[2])
  }
  return metrics
}

async function getStatus() {
  const online = await tcpCheck(config.skymp.host, config.skymp.port)
  if (!online) return { status: 'offline', players: null }
  try {
    const metrics = await fetchMetrics()
    const connects = metrics.skymp_connects_total
    const disconnects = metrics.skymp_disconnects_total
    const players = Number.isFinite(connects) && Number.isFinite(disconnects) ? Math.max(0, connects - disconnects) : null
    return { status: 'online', players }
  } catch { return { status: 'online', players: null } }
}

module.exports = { fetchMetrics, getStatus, parseMetrics, tcpCheck }
