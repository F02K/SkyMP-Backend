'use strict'
// ── Discord bot (role-fetch only) ─────────────────────────────────────────────
// A minimal discord.js client used exclusively to fetch guild member roles at
// login time. Requires the Privileged "Server Members Intent" to be enabled in
// the Discord Developer Portal for this bot application.

const { Client, GatewayIntentBits } = require('discord.js')
const config = require('../config')

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
})

let ready = false

client.once('ready', () => {
  ready = true
  console.log(`[discord-bot] ready as ${client.user.tag}`)
})

client.on('error', err => {
  console.error('[discord-bot] error:', err.message)
})

/**
 * Returns an array of Discord role ID strings for the given user in the
 * configured guild. Returns [] if the bot is not ready, the user is not in
 * the guild, or any error occurs.
 * @param {string} discordId
 * @returns {Promise<string[]>}
 */
async function getMemberRoles(discordId) {
  if (!ready || !config.discordGuildId) return []
  try {
    const guild  = await client.guilds.fetch(config.discordGuildId)
    const member = await guild.members.fetch(discordId)
    return [...member.roles.cache.keys()]
  } catch {
    return []
  }
}

function isReady() {
  return ready && !!config.discordGuildId
}

async function memberHasRole(discordId, roleId) {
  if (!roleId) return false
  if (!isReady()) throw new Error('discord bot is not ready')
  try {
    const guild = await client.guilds.fetch(config.discordGuildId)
    const member = await guild.members.fetch(discordId)
    return member.roles.cache.has(roleId)
  } catch (err) {
    if (err.code === 10007) return false
    throw err
  }
}

async function getMembersWithRole(roleId) {
  if (!roleId) return []
  if (!isReady()) throw new Error('discord bot is not ready')

  const guild = await client.guilds.fetch(config.discordGuildId)
  const role = await guild.roles.fetch(roleId)
  if (!role) return []

  await guild.members.fetch()

  return guild.members.cache
    .filter(member => member.roles.cache.has(roleId))
    .map(member => ({
      discordId: member.user.id,
      username: member.user.username,
      displayName: member.displayName || member.user.globalName || member.user.username,
      avatar: member.user.displayAvatarURL({ size: 64 }),
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
      roles: [...member.roles.cache.keys()],
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/**
 * Starts the Discord bot. No-op if DISCORD_BOT_TOKEN is not configured.
 */
function start() {
  if (!config.discordBotToken) {
    console.warn('[discord-bot] DISCORD_BOT_TOKEN not set — role-based access checks will be skipped')
    return
  }
  client.login(config.discordBotToken).catch(err => {
    console.error('[discord-bot] login failed:', err.message)
  })
}

module.exports = { start, getMemberRoles, isReady, memberHasRole, getMembersWithRole }
