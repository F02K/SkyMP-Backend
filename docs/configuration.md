# Configuration

`backend.config.json` is the versioned, non-secret project configuration. `.env` and process environment variables hold secrets and deployment-specific overrides. Precedence is environment, then project configuration, then neutral defaults.

The configuration file is validated against `backend.config.schema.json`. Run `npm run config:check` in CI and before deployment.

| Section | Responsibility |
| --- | --- |
| `project` | Name, website URL and public API URL |
| `http` | API port, CORS origins and reverse-proxy trust |
| `dashboard` | Dashboard enablement, port and public URLs |
| `skymp` | Game endpoint and public server metadata |
| `discord` | OAuth redirects and dashboard allow-list values |
| `access` | Initial server-lock policy |
| `integrations` | Admin upstream and tracked client branch |
| `distribution` | Client source/output and launcher update feed |
| `storage` | Persistent data root |
| `features` | Optional services and compatibility switches |

Never put these secrets in the JSON file: `SERVER_MASTER_KEY`, `MASTER_API_AUTH_TOKEN`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `ADMIN_TOKEN`, `METRICS_PASSWORD`, `RELAY_SECRET`, and `GITHUB_WEBHOOK_SECRET`.

Production validation requires HTTPS public URLs and all secrets needed by enabled integrations. Error output is redacted. `BAN_ROLE_ID` remains an alias for `BANNED_ROLE_ID`; `FROSTFALL_SHARED_ENV` is a deprecated alias for `SHARED_ENV_PATH`. No environment file is loaded from a user Documents directory implicitly.

See `.env.example` for the complete variable list.

## Environment reference

| Variables | Purpose |
| --- | --- |
| `BACKEND_CONFIG`, `SHARED_ENV_PATH`, `NODE_ENV` | Select configuration and production validation mode |
| `PROJECT_NAME`, `PUBLIC_API_URL`, `WEBSITE_URL` | Public project identity and URLs |
| `PORT`, `CORS_ORIGINS`, `TRUST_PROXY` | Public API listener and proxy policy |
| `DASHBOARD_ENABLED`, `DASHBOARD_PORT`, `DASHBOARD_PUBLIC_URL`, `DASHBOARD_API_BASE_URL` | Dashboard listener and browser-visible endpoints |
| `DATA_DIR` | Persistent JSON-data root |
| `SKYMP_HOST`, `SKYMP_PORT`, `SKYMP_UI_PORT` | Game and metrics endpoints |
| `SERVER_NAME`, `SERVER_MAX_PLAYERS`, `SERVER_OFFLINE_MODE`, `SERVER_NPC_ENABLED`, `SERVER_GAMEMODE` | Public game-server metadata |
| `SERVER_MASTER_KEY`, `MASTER_URL`, `MASTER_API_AUTH_TOKEN` | SkyMP master API authentication |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Launcher OAuth |
| `DISCORD_DASHBOARD_REDIRECT_URI`, `DASHBOARD_DISCORD_IDS` | Dashboard OAuth and explicit operator allow-list |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `WHITELIST_ROLE_ID`, `BANNED_ROLE_ID` | Discord role integration |
| `SERVER_LOCKED`, `SERVER_LOCKED_ROLE_IDS`, `SERVER_LOCKED_ALLOW` | Initial access policy values |
| `WS_PORT`, `RELAY_SECRET` | WebSocket relay listener and game-mode authentication |
| `ADMIN_URL`, `ADMIN_TOKEN` | Optional upstream admin service |
| `METRICS_USER`, `METRICS_PASSWORD` | SkyMP metrics authentication |
| `CLIENT_REPOSITORY_URL`, `CLIENT_SOURCE_DIR`, `CLIENT_OUTPUT_DIR`, `CLIENT_ARCHIVE_NAME`, `CLIENT_BRANCH` | Client build and webhook pipeline |
| `SKYMP_BUILD_DATA_DIR` | Local SkyMP build copied by `client:populate` |
| `LAUNCHER_UPDATE_PUBLIC_URL`, `LAUNCHER_UPDATES_DIR` | Electron update feed URL and storage |
| `GITHUB_WEBHOOK_SECRET` | GitHub HMAC verification |
| `FEATURE_DISCORD_BOT`, `FEATURE_WEBSOCKET_RELAY`, `FEATURE_GITHUB_WEBHOOK`, `FEATURE_API_DOCS` | Optional runtime services |
| `LEGACY_DIRECT_SESSION_CREATION` | Opt-in compatibility endpoint; requires `MASTER_API_AUTH_TOKEN` |

Comma-separated list variables ignore empty entries. Boolean values accept `true`/`false` and `1`/`0`. Relative paths resolve from the backend root. Production errors name missing variables but never include their values.
