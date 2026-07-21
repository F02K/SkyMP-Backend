# HTTP API

API v2 is rooted at `/api/v2`. Its machine-readable contract is available at `/docs/openapi.yaml` and Swagger UI at `/docs`.

## Authentication

- Launcher Discord authentication uses a browser redirect plus state polling under `/api/v2/auth/discord`.
- Dashboard endpoints use `Authorization: Bearer <dashboard-session>` and Discord-role permissions.
- Game-server writes use a server key in the route and `X-Auth-Token` for privileged mutations.
- Webhooks use GitHub's `X-Hub-Signature-256` HMAC signature.

v2 errors use `{ "error": { "code": "profileNotFound", "message": "Profile was not found." } }`. Collections use `{ "items": [], "total": 0 }`; binary downloads are the exception.

Legacy `/api/*`, `/auth/dashboard/*` and `/webhooks/*` routes return `Deprecation: true` and a documentation `Link` header. SkyMP-required protocol paths retain their established wire shapes.

Unauthenticated direct creation through `POST /auth/session` is disabled by default. If `LEGACY_DIRECT_SESSION_CREATION=true`, `X-Auth-Token` is required. `/api/version` remains for launcher 1.1.1 and older; Electron clients use `/launcher-updates`.
