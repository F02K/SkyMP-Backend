# Distribution and integration workflows

## Client files

Configure `CLIENT_REPOSITORY_URL`, source/output directories, archive name and tracked branch. `npm run client:setup` clones or fast-forwards the checkout, then calls the build pipeline. `npm run client:build` copies the checkout into the distribution root, creates the configured ZIP, and writes `data/distribution/client-version.json`. `npm run client:populate` first copies `SKYMP_BUILD_DATA_DIR` into the source tree for local release preparation.

The launcher reads `/api/v2/launcher/manifest`, `/client/version`, and `/client/download`. A failed build leaves the preceding published client files usable.

## GitHub webhook

Enable `features.githubWebhook`, set `GITHUB_WEBHOOK_SECRET`, and configure a GitHub push webhook for `/api/v2/integrations/github` (legacy `/webhooks/github` also remains available). Use JSON content and the same HMAC secret at both ends. Only the configured `CLIENT_BRANCH` triggers work. Duplicate deliveries while a build is running are ignored, and shutdown waits for the current job.

## Launcher updates

Build NSIS and AppImage artifacts in the launcher repository. The dist directory must include `latest.yml`, `latest-linux.yml`, installers/AppImages, blockmaps, and matching checksums. Publish atomically:

```powershell
npm run launcher:publish -- E:\path\to\launcher\dist
```

The command validates both update channels in a staging directory before swapping it into `LAUNCHER_UPDATES_DIR`. Old launchers continue to use `/api/version`; new Electron builds use `/launcher-updates` directly.
