# Data layout and migration

The persistent root is configured by `storage.dataDir` or `DATA_DIR` and contains:

- `content/`: news, lore, rules, mods and public keys;
- `access/`: access policy, whitelist, staff notes, role permissions and factions;
- `players/`: profiles, player records and balances;
- `sessions/`: play and dashboard sessions;
- `distribution/`: generated client-version metadata.

All domain writes use atomic temporary-file replacement. Keep the data root on a persistent volume and back it up independently of application releases.

New forks can copy the neutral tree from `examples/data` into their persistent `DATA_DIR`. It is intentionally separate from the repository's existing instance data. Never copy it over an active installation.

## Migrating the flat layout

```powershell
npm run migrate:data -- --dry-run
npm run migrate:data -- --apply
```

The apply command validates every source/target pair before writing, creates a timestamped sibling backup directory, then moves files. It is safe to run repeatedly. If old and new copies differ, it stops without changing either copy; reconcile the files manually and rerun.

Before migration, the application resolves a canonical file first and otherwise continues using its legacy flat path. It never silently chooses between conflicting copies.

## Backup and restore

Stop write traffic or shut the process down, then copy the complete `DATA_DIR` and the two distribution directories. A consistent backup must include all domain folders together because profiles, sessions and faction assignments reference one another. To restore, stop the service, replace the persistent directories, run `npm run migrate:data -- --dry-run`, then start and verify `/health/ready` plus a read-only launcher and dashboard request.

The migration backup is a timestamped sibling of `DATA_DIR`. It contains every legacy source file changed by that run. Restoration is explicit: stop the service, copy the required files back, and do not leave differing legacy and canonical copies in place.
