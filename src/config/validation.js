'use strict'

const SECRET_NAMES = [
  'ADMIN_TOKEN', 'DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_SECRET',
  'GITHUB_WEBHOOK_SECRET', 'MASTER_API_AUTH_TOKEN', 'METRICS_PASSWORD',
  'RELAY_SECRET', 'SERVER_MASTER_KEY',
]

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`)
}

function assertKeys(value, name, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${name}.${key} is not supported`)
  }
}

function assertBoolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`)
}

function validateProjectConfig(raw) {
  assertObject(raw, 'backend.config.json')
  const sections = ['project', 'http', 'dashboard', 'skymp', 'discord', 'access', 'integrations', 'distribution', 'storage', 'features']
  for (const section of sections) assertObject(raw[section], section)
  assertKeys(raw, 'backend.config.json', ['$schema', ...sections])
  const keys = {
    project: ['name', 'websiteUrl', 'publicApiUrl'],
    http: ['port', 'corsOrigins', 'trustProxy'],
    dashboard: ['enabled', 'port', 'publicUrl', 'apiBaseUrl'],
    skymp: ['host', 'port', 'serverName', 'maxPlayers', 'offlineMode', 'npcEnabled', 'gamemode', 'masterUrl'],
    discord: ['launcherRedirectUri', 'dashboardRedirectUri', 'dashboardUserIds'],
    access: ['serverLocked', 'lockedUserIds', 'lockedRoleIds'],
    integrations: ['adminUrl', 'clientBranch'],
    distribution: ['clientRepositoryUrl', 'clientSourceDir', 'clientOutputDir', 'clientArchiveName', 'launcherUpdatePublicUrl'],
    storage: ['dataDir'],
    features: ['discordBot', 'websocketRelay', 'githubWebhook', 'legacyDirectSessionCreation', 'apiDocs'],
  }
  for (const section of sections) assertKeys(raw[section], section, keys[section])

  if (!String(raw.project.name || '').trim()) throw new Error('project.name must not be empty')
  for (const [name, value] of [
    ['project.websiteUrl', raw.project.websiteUrl],
    ['project.publicApiUrl', raw.project.publicApiUrl],
    ['dashboard.publicUrl', raw.dashboard.publicUrl],
    ['dashboard.apiBaseUrl', raw.dashboard.apiBaseUrl],
    ['skymp.masterUrl', raw.skymp.masterUrl],
    ['discord.launcherRedirectUri', raw.discord.launcherRedirectUri],
    ['discord.dashboardRedirectUri', raw.discord.dashboardRedirectUri],
    ['integrations.adminUrl', raw.integrations.adminUrl],
    ['distribution.launcherUpdatePublicUrl', raw.distribution.launcherUpdatePublicUrl],
  ]) {
    try { new URL(value) } catch { throw new Error(`${name} must be a valid URL`) }
  }
  for (const [name, value] of [['http.port', raw.http.port], ['dashboard.port', raw.dashboard.port], ['skymp.port', raw.skymp.port]]) {
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be an integer between 1 and 65535`)
  }
  if (!Array.isArray(raw.http.corsOrigins)) throw new Error('http.corsOrigins must be an array')
  if (!Array.isArray(raw.discord.dashboardUserIds)) throw new Error('discord.dashboardUserIds must be an array')
  if (!Array.isArray(raw.access.lockedUserIds) || !Array.isArray(raw.access.lockedRoleIds)) {
    throw new Error('access locked IDs must be arrays')
  }
  for (const [name, value] of [
    ['dashboard.enabled', raw.dashboard.enabled],
    ['access.serverLocked', raw.access.serverLocked],
    ['skymp.offlineMode', raw.skymp.offlineMode],
    ['skymp.npcEnabled', raw.skymp.npcEnabled],
    ...Object.entries(raw.features).map(([name, value]) => [`features.${name}`, value]),
  ]) assertBoolean(value, name)
  return raw
}

function validateRuntimeConfig(config, env = process.env) {
  const errors = []
  const production = env.NODE_ENV === 'production'
  if (production) {
    for (const [name, value] of [
      ['project.publicApiUrl', config.project.publicApiUrl],
      ['dashboard.publicUrl', config.dashboard.publicUrl],
      ['distribution.launcherUpdatePublicUrl', config.distribution.launcherUpdatePublicUrl],
    ]) {
      if (new URL(value).protocol !== 'https:') errors.push(`${name} must use HTTPS in production`)
    }
    if (!config.secrets.serverMasterKey) errors.push('SERVER_MASTER_KEY is required in production')
    if (!config.secrets.masterApiAuthToken) errors.push('MASTER_API_AUTH_TOKEN is required in production')
    if (config.dashboard.enabled && (!config.discord.clientId || !config.secrets.discordClientSecret)) {
      errors.push('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are required when the dashboard is enabled')
    }
    if (config.features.websocketRelay && !config.secrets.relaySecret) errors.push('RELAY_SECRET is required when websocketRelay is enabled')
    if (config.features.githubWebhook && (!config.secrets.githubWebhookSecret || !config.distribution.clientRepositoryUrl)) {
      errors.push('GITHUB_WEBHOOK_SECRET and CLIENT_REPOSITORY_URL are required when githubWebhook is enabled')
    }
    if (config.features.discordBot && (!config.secrets.discordBotToken || !config.discord.guildId)) {
      errors.push('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required when discordBot is enabled')
    }
    if (config.integrations.adminUrl && !config.secrets.adminToken) errors.push('ADMIN_TOKEN is required for the admin service proxy')
    if (config.integrations.metricsUser && !config.secrets.metricsPassword) errors.push('METRICS_PASSWORD is required when METRICS_USER is configured')
  }
  if (config.features.legacyDirectSessionCreation && !config.secrets.masterApiAuthToken) {
    errors.push('MASTER_API_AUTH_TOKEN is required when legacyDirectSessionCreation is enabled')
  }
  if (errors.length) throw new Error(`Invalid backend configuration:\n- ${errors.join('\n- ')}`)
  return config
}

function redactSecrets(value) {
  let text = String(value)
  for (const name of SECRET_NAMES) {
    const secret = process.env[name]
    if (secret) text = text.split(secret).join('[redacted]')
  }
  return text
}

module.exports = { redactSecrets, validateProjectConfig, validateRuntimeConfig }
