# Legacy and SkyMP compatibility routes

These routes are compatibility surfaces, not the recommended API for new callers. Legacy HTTP routes include `/api/news`, `/api/status`, `/api/servers`, `/api/serverinfo`, `/api/manifest`, `/api/modlist`, `/api/metrics`, `/api/files/*`, `/api/users/*`, `/api/version`, `/auth/dashboard/*`, `/api/{players,server-access,role-permissions,faction-whitelist,lore,rules,whitelist,whitelist-notes,admin}/*`, and `/webhooks/github`.

They retain their established response shapes and add `Deprecation: true` plus a documentation `Link` header. There is no removal date.

SkyMP protocol routes under `/auth/:key/*` and `/api/servers/:key/*` remain available because unmodified SkyMP clients and servers depend on them. They share the v2 session, access, faction, profile and balance services. Direct `POST /auth/session` is disabled unless `LEGACY_DIRECT_SESSION_CREATION=true`; when enabled it always requires a matching `X-Auth-Token`.
