'use strict'

const fs = require('fs')
const path = require('path')
const { validateProjectConfig, validateRuntimeConfig } = require('./validation')

const ROOT_DIR = path.join(__dirname, '..', '..')

function envBool(env, name, fallback) {
  if (env[name] === undefined) return fallback
  return env[name] === 'true' || env[name] === '1'
}

function envInt(env, name, fallback) {
  if (env[name] === undefined || env[name] === '') return fallback
  const value = Number.parseInt(env[name], 10)
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`)
  return value
}

function envList(env, name, fallback = []) {
  if (env[name] === undefined) return fallback
  return env[name].split(',').map(value => value.trim()).filter(Boolean)
}

function absolute(rootDir, value) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value)
}

function loadConfig({ rootDir = ROOT_DIR, env = process.env, configPath } = {}) {
  const selectedPath = path.resolve(rootDir, configPath || env.BACKEND_CONFIG || 'backend.config.json')
  const raw = validateProjectConfig(JSON.parse(fs.readFileSync(selectedPath, 'utf8')))

  const apiPort = envInt(env, 'PORT', raw.http.port)
  const skympPort = envInt(env, 'SKYMP_PORT', raw.skymp.port)
  const dataDir = absolute(rootDir, env.DATA_DIR || raw.storage.dataDir)
  const config = {
    rootDir,
    configPath: selectedPath,
    project: {
      name: env.PROJECT_NAME || raw.project.name,
      websiteUrl: env.WEBSITE_URL || raw.project.websiteUrl,
      publicApiUrl: env.PUBLIC_API_URL || raw.project.publicApiUrl,
    },
    http: {
      port: apiPort,
      corsOrigins: envList(env, 'CORS_ORIGINS', raw.http.corsOrigins),
      trustProxy: envBool(env, 'TRUST_PROXY', raw.http.trustProxy),
    },
    dashboard: {
      enabled: envBool(env, 'DASHBOARD_ENABLED', raw.dashboard.enabled),
      port: envInt(env, 'DASHBOARD_PORT', raw.dashboard.port),
      publicUrl: env.DASHBOARD_PUBLIC_URL || raw.dashboard.publicUrl,
      apiBaseUrl: env.DASHBOARD_API_BASE_URL || raw.dashboard.apiBaseUrl,
    },
    skymp: {
      host: env.SKYMP_HOST || raw.skymp.host,
      port: skympPort,
      uiPort: envInt(env, 'SKYMP_UI_PORT', skympPort === 7777 ? 3000 : skympPort + 1),
      serverName: env.SERVER_NAME || raw.skymp.serverName,
      maxPlayers: envInt(env, 'SERVER_MAX_PLAYERS', raw.skymp.maxPlayers),
      offlineMode: envBool(env, 'SERVER_OFFLINE_MODE', raw.skymp.offlineMode),
      npcEnabled: envBool(env, 'SERVER_NPC_ENABLED', raw.skymp.npcEnabled),
      gamemode: env.SERVER_GAMEMODE || raw.skymp.gamemode,
      masterUrl: env.MASTER_URL || raw.skymp.masterUrl,
    },
    discord: {
      clientId: env.DISCORD_CLIENT_ID || '',
      guildId: env.DISCORD_GUILD_ID || '',
      launcherRedirectUri: env.DISCORD_REDIRECT_URI || raw.discord.launcherRedirectUri,
      dashboardRedirectUri: env.DISCORD_DASHBOARD_REDIRECT_URI || raw.discord.dashboardRedirectUri,
      dashboardUserIds: envList(env, 'DASHBOARD_DISCORD_IDS', raw.discord.dashboardUserIds),
      whitelistRoleId: env.WHITELIST_ROLE_ID || '',
      bannedRoleId: env.BANNED_ROLE_ID || env.BAN_ROLE_ID || '',
    },
    access: {
      serverLocked: envBool(env, 'SERVER_LOCKED', raw.access.serverLocked),
      lockedUserIds: envList(env, 'SERVER_LOCKED_ALLOW', raw.access.lockedUserIds),
      lockedRoleIds: envList(env, 'SERVER_LOCKED_ROLE_IDS', raw.access.lockedRoleIds),
    },
    integrations: {
      adminUrl: env.ADMIN_URL || raw.integrations.adminUrl,
      clientBranch: env.CLIENT_BRANCH || raw.integrations.clientBranch,
      metricsUser: env.METRICS_USER || '',
    },
    distribution: {
      clientRepositoryUrl: env.CLIENT_REPOSITORY_URL || raw.distribution.clientRepositoryUrl,
      clientSourceDir: absolute(rootDir, env.CLIENT_SOURCE_DIR || raw.distribution.clientSourceDir),
      clientOutputDir: absolute(rootDir, env.CLIENT_OUTPUT_DIR || raw.distribution.clientOutputDir),
      clientArchiveName: env.CLIENT_ARCHIVE_NAME || raw.distribution.clientArchiveName,
      launcherUpdatePublicUrl: (env.LAUNCHER_UPDATE_PUBLIC_URL || raw.distribution.launcherUpdatePublicUrl).replace(/\/$/, ''),
      launcherUpdatesDir: absolute(rootDir, env.LAUNCHER_UPDATES_DIR || 'public/launcher-updates'),
    },
    storage: { dataDir },
    features: {
      discordBot: envBool(env, 'FEATURE_DISCORD_BOT', raw.features.discordBot),
      websocketRelay: envBool(env, 'FEATURE_WEBSOCKET_RELAY', raw.features.websocketRelay),
      githubWebhook: envBool(env, 'FEATURE_GITHUB_WEBHOOK', raw.features.githubWebhook),
      legacyDirectSessionCreation: envBool(env, 'LEGACY_DIRECT_SESSION_CREATION', raw.features.legacyDirectSessionCreation),
      apiDocs: envBool(env, 'FEATURE_API_DOCS', raw.features.apiDocs),
    },
    websocket: { port: envInt(env, 'WS_PORT', 7778) },
    secrets: {
      adminToken: env.ADMIN_TOKEN || '',
      discordBotToken: env.DISCORD_BOT_TOKEN || '',
      discordClientSecret: env.DISCORD_CLIENT_SECRET || '',
      githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET || '',
      masterApiAuthToken: env.MASTER_API_AUTH_TOKEN || '',
      metricsPassword: env.METRICS_PASSWORD || '',
      relaySecret: env.RELAY_SECRET || '',
      serverMasterKey: env.SERVER_MASTER_KEY || '',
    },
  }

  validateRuntimeConfig(config, env)

  // Temporary flat aliases keep existing domain code and external imports working
  // while all route construction is moved behind the new module boundaries.
  Object.assign(config, {
    skyrimServerHost: config.skymp.host,
    skyrimServerPort: config.skymp.port,
    skympUiPort: config.skymp.uiPort,
    serverName: config.skymp.serverName,
    serverMaxPlayers: config.skymp.maxPlayers,
    serverOfflineMode: config.skymp.offlineMode,
    serverNpcEnabled: config.skymp.npcEnabled,
    serverGamemode: config.skymp.gamemode,
    serverMasterKey: config.secrets.serverMasterKey,
    masterUrl: config.skymp.masterUrl,
    masterApiAuthToken: config.secrets.masterApiAuthToken,
    discordClientId: config.discord.clientId,
    discordClientSecret: config.secrets.discordClientSecret,
    discordRedirectUri: config.discord.launcherRedirectUri,
    metricsUser: config.integrations.metricsUser,
    metricsPassword: config.secrets.metricsPassword,
    adminUrl: config.integrations.adminUrl,
    adminToken: config.secrets.adminToken,
    dashboardPort: config.dashboard.enabled ? config.dashboard.port : 0,
    dashboardPublicUrl: config.dashboard.publicUrl,
    dashboardApiBaseUrl: config.dashboard.apiBaseUrl,
    dashboardDiscordIds: config.discord.dashboardUserIds,
    discordDashboardRedirectUri: config.discord.dashboardRedirectUri,
    websiteUrl: config.project.websiteUrl,
    launcherUpdatePublicUrl: config.distribution.launcherUpdatePublicUrl,
    discordBotToken: config.secrets.discordBotToken,
    discordGuildId: config.discord.guildId,
    serverLocked: config.access.serverLocked,
    serverLockedAllowList: config.access.lockedUserIds,
    serverLockedRoleIds: config.access.lockedRoleIds,
    whitelistRoleId: config.discord.whitelistRoleId,
    bannedRoleId: config.discord.bannedRoleId,
  })

  Object.defineProperty(config, 'loadConfig', { value: loadConfig, enumerable: false })
  return deepFreeze(config)
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

let cached
function getConfig() {
  if (!cached) cached = loadConfig()
  return cached
}

module.exports = getConfig()
