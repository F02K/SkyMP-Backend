/**
 * Backend server configuration.
 * All values are read from environment variables (set via .env for local dev,
 * real env vars in production).
 */
const path = require('path')

const SKYMP_PORT = parseInt(process.env.SKYMP_PORT || '7777', 10)

module.exports = {
  // ── Game server connection (used for status checks and metrics) ─────────────
  skyrimServerHost: process.env.SKYMP_HOST || '127.0.0.1',
  skyrimServerPort: SKYMP_PORT,

  // SkyMP HTTP UI port: always 3000 when game port is 7777, else port+1
  skympUiPort: SKYMP_PORT === 7777 ? 3000 : SKYMP_PORT + 1,

  // ── Server metadata (returned by /api/serverinfo and /api/servers) ──────────
  serverName:       process.env.SERVER_NAME        || 'SkyMP Server',
  serverMaxPlayers: parseInt(process.env.SERVER_MAX_PLAYERS || '100', 10),
  serverOfflineMode: process.env.SERVER_OFFLINE_MODE === 'true',
  serverNpcEnabled:  process.env.SERVER_NPC_ENABLED  === 'true',
  // Short gamemode label shown in the launcher (optional)
  serverGamemode:   process.env.SERVER_GAMEMODE     || null,

  // ── Discord OAuth (launcher login) ──────────────────────────────────────────
  discordClientId:     process.env.DISCORD_CLIENT_ID     || '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  // Redirect URI registered in the Discord application settings
  discordRedirectUri:  process.env.DISCORD_REDIRECT_URI  || 'http://localhost:4000/auth/callback',

  // ── Metrics HTTP auth (Basic auth for the game server's /metrics endpoint) ──
  metricsUser:     process.env.METRICS_USER     || '',
  metricsPassword: process.env.METRICS_PASSWORD || '',
}
