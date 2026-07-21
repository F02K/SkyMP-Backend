# Deployment and operations

Use Node.js 20 or newer. Run `npm ci`, `npm run config:check`, and `npm test` before starting `node src/index.js` under a process supervisor.

Persist `DATA_DIR`, the client output directory, and `public/launcher-updates`. Forward the API and dashboard public URLs to their configured ports. Forward WebSocket traffic directly to `WS_PORT`. Set `TRUST_PROXY` only when requests pass through a trusted reverse proxy and restrict `CORS_ORIGINS` in production.

Probe `/health/live` for process liveness and `/health/ready` for completed service startup. Send `SIGTERM` during rollout so listeners and the Discord client close cleanly.

Launcher metadata (`latest.yml`, `latest-linux.yml`) is served without long-term caching. Versioned installers, AppImages and blockmaps receive immutable one-year caching. Publish a complete feed atomically with:

```powershell
npm run launcher:publish -- E:\path\to\launcher\dist
```

Never embed Discord, GitHub, relay, admin or master API secrets in launcher builds.

## Reverse proxy

Route `/api`, `/auth`, `/webhooks`, `/launcher-updates`, `/files`, `/images`, `/docs`, and `/health` to the API port. Route the dashboard host to `DASHBOARD_PORT`, and forward WebSocket upgrade requests to `WS_PORT`. Preserve `X-Forwarded-Proto` so generated image and redirect URLs use HTTPS. Metadata cache rules from the backend must not be overridden by a CDN.

Mount persistent volumes for `DATA_DIR`, `CLIENT_OUTPUT_DIR`, and `LAUNCHER_UPDATES_DIR`; application source can remain read-only. Keep the three listeners private behind the proxy except where a game server connects directly to the relay.
