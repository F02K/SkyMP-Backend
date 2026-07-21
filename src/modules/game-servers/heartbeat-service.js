'use strict'

let heartbeat = null

function update(input, defaults) {
  heartbeat = {
    name: typeof input.name === 'string' ? input.name : defaults.name,
    maxPlayers: typeof input.maxPlayers === 'number' ? input.maxPlayers : defaults.maxPlayers,
    online: typeof input.online === 'number' ? input.online : null,
    lastSeen: new Date().toISOString(),
  }
  return heartbeat
}

function get() { return heartbeat }
function clear() { heartbeat = null }

module.exports = { clear, get, update }
