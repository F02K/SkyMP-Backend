# SKSE Source Files

Place the SKSE64 binaries for Skyrim Special Edition here.
The merge script (`npm run merge`) copies everything in this folder
into `public/files/root/` alongside the SkyMP client files.

## Required files

| File | Where to get it |
|------|-----------------|
| `skse64_loader.exe` | [SKSE64 releases](https://skse.silverlock.org/) — extract the archive |
| `skse64_1_6_1170.dll` | Same archive (version number may differ) |
| `skse64_steam_loader.dll` | Same archive (optional, Steam build only) |

Download the build that matches your Skyrim SE version (Runtime 1.6.1170 for
the current AE build). Extract the zip and copy only the root-level `.exe` and
`.dll` files here — not the `Data/` subdirectory.

## What NOT to put here

- `Data/` folder contents — those come from the Frostfall-Client repo.
- SKSE plugins (SkyrimPlatform.dll, MpClientPlugin.dll) — those are part of
  the client repo.

## Gitignore note

`*.exe` and `*.dll` files in this directory are excluded from git (large
binaries). Place them manually on the server after cloning the repo, or add
a deployment step to download them from the SKSE release page.
