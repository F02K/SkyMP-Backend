# Migrating from API v1 to v2

API v1 has no removal date. Existing clients continue to work, but responses include deprecation headers.

Launcher callers should replace scattered `/api/*` URLs with a single API client rooted at `/api/v2`:

- `/api/news` becomes `/api/v2/launcher/news` and returns `items` plus `total`;
- `/api/servers` becomes `/api/v2/launcher/servers`;
- `/api/serverinfo` becomes `/api/v2/launcher/servers/default`;
- `/api/modlist` becomes `/api/v2/launcher/mods`;
- `/api/files/version` and `/zip` become `/api/v2/launcher/client/version` and `/download`;
- `/api/users/login-discord/*` becomes `/api/v2/auth/discord/{start,callback,status}`.

Dashboard callers move beneath `/api/v2/admin`. Authentication uses `auth/start`, `auth/callback`, `auth/session`, and `auth/logout`.

Do not rename SkyMP protocol URLs inside an unmodified SkyMP client or server. Those compatibility routes remain supported and delegate to the same v2 services.
