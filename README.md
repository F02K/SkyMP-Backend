# SkyMP Backend

> [!WARNING]
> **Deprecated and frozen.** This backend is not part of the current
> Directory-managed SkyMP stack and will not receive the unversioned API
> cutover. New and existing deployments should migrate to the
> [SkyMP Managed Backend](https://github.com/f02k/skymp/tree/master/skymp-backend).

SkyMP Backend is a configurable backend template for SkyMP launchers and multiplayer servers. It provides launcher content and client files, Discord authentication, the SkyMP master API, access and player management, an administrative dashboard, a WebSocket relay, and automatic launcher-update hosting.

## Quick start

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run config:check
npm test
npm start
```

Edit `backend.config.json` for non-secret project settings and `.env` for secrets or deployment overrides. The API listens on port 4000, the dashboard on 4002, and the WebSocket relay on 7778 by default.

- API documentation: `http://localhost:4000/docs`
- Liveness: `http://localhost:4000/health/live`
- Readiness: `http://localhost:4000/health/ready`

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration reference](docs/configuration.md)
- [HTTP API and authentication](docs/api.md)
- [Data layout and migration](docs/data-and-migration.md)
- [Deployment and operations](docs/deployment.md)
- [Distribution and webhook workflows](docs/workflows.md)
- [Development and tests](docs/development.md)
- [Migrating callers from API v1](docs/v1-migration.md)
- [Legacy and SkyMP compatibility routes](docs/legacy-api.md)
- [OpenAPI specification](docs/openapi.yaml)

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run config:check` | Validate project configuration and environment overrides |
| `npm run migrate:data -- --dry-run` | Preview legacy JSON-data migration |
| `npm run migrate:data -- --apply` | Back up and migrate legacy JSON data |
| `npm run client:setup` | Clone or update the configured client repository |
| `npm run client:build` | Build the launcher client archive and version metadata |
| `npm run client:populate` | Copy a local SkyMP build into the distribution root |
| `npm run launcher:publish -- <dist>` | Atomically publish Electron update artifacts |

API v2 is canonical. Legacy API and SkyMP protocol routes remain available with deprecation headers; see the migration guide before changing an existing deployment.
