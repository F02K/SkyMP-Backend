'use strict'

const { WebSocket, WebSocketServer } = require('ws')
const config = require('../../config')

function createRelay({ port = config.websocket.port, secret = config.secrets.relaySecret } = {}) {
  let server = null
  let gamemode = null
  const players = new Map()
  const nonces = new Map()

  function send(socket, message) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  function onConnection(socket) {
    let role = null
    let userId = null
    const authTimeout = setTimeout(() => {
      if (!role) socket.close(4000, 'auth required')
    }, 10_000)

    socket.on('message', raw => {
      let message
      try { message = JSON.parse(raw.toString()) } catch { return }
      if (!role) {
        if (message.type === 'auth' && message.role === 'gamemode') {
          if (message.secret !== secret) return socket.close(4001, 'bad secret')
          role = 'gamemode'
          gamemode = socket
          clearTimeout(authTimeout)
          return send(socket, { type: 'auth_ok', role })
        }
        if (message.type === 'auth' && nonces.has(message.nonce)) {
          role = 'player'
          userId = nonces.get(message.nonce)
          nonces.delete(message.nonce)
          players.set(userId, socket)
          clearTimeout(authTimeout)
          send(socket, { type: 'auth_ok', role, userId })
          return send(gamemode, { type: 'player_connected', userId })
        }
        return socket.close(4001, 'bad auth')
      }
      if (role === 'gamemode') {
        if (message.type === 'register_nonce' && message.nonce && message.userId !== undefined) {
          nonces.set(message.nonce, String(message.userId))
          setTimeout(() => nonces.delete(message.nonce), 60_000)
        } else if (message.type === 'chat_deliver') send(players.get(String(message.userId)), message)
        else if (message.type === 'chat_broadcast') for (const player of players.values()) send(player, message)
      } else if (role === 'player' && message.type === 'chat_send') {
        send(gamemode, { ...message, userId })
      }
    })

    socket.on('close', () => {
      clearTimeout(authTimeout)
      if (role === 'gamemode' && gamemode === socket) gamemode = null
      if (role === 'player') {
        players.delete(userId)
        send(gamemode, { type: 'player_disconnected', userId })
      }
    })
    socket.on('error', error => console.error('[websocket-relay] socket error:', error.message))
  }

  function start() {
    if (server) return Promise.resolve(server)
    return new Promise((resolve, reject) => {
      server = new WebSocketServer({ port })
      server.on('connection', onConnection)
      server.once('listening', () => resolve(server))
      server.once('error', reject)
    })
  }

  function stop() {
    if (!server) return Promise.resolve()
    for (const socket of server.clients) socket.terminate()
    return new Promise(resolve => server.close(() => { server = null; resolve() }))
  }

  return { start, stop }
}

module.exports = { createRelay }
