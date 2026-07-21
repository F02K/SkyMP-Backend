'use strict'

const fs = require('fs')
const path = require('path')
const config = require('../src/config')
const { DATA_FILES, canonicalDataFile, legacyDataFile } = require('../src/shared/storage/paths')

function inspectMigration({ dataDir = config.storage.dataDir } = {}) {
  const actions = []
  const conflicts = []
  for (const name of Object.keys(DATA_FILES)) {
    const source = legacyDataFile(name, { dataDir })
    const target = canonicalDataFile(name, { dataDir })
    if (!fs.existsSync(source)) continue
    if (fs.existsSync(target)) {
      if (!fs.readFileSync(source).equals(fs.readFileSync(target))) conflicts.push({ name, source, target })
      else actions.push({ name, source, target, duplicate: true })
    } else actions.push({ name, source, target, duplicate: false })
  }
  return { actions, conflicts }
}

function migrateData({ dataDir = config.storage.dataDir, apply = false, now = new Date() } = {}) {
  const inspection = inspectMigration({ dataDir })
  if (inspection.conflicts.length) {
    const names = inspection.conflicts.map(item => item.name).join(', ')
    throw new Error(`Migration stopped because old and new files differ: ${names}`)
  }
  if (!apply || !inspection.actions.length) return { ...inspection, applied: false, backupDir: null }

  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(path.dirname(dataDir), `${path.basename(dataDir)}.backup-${stamp}`)
  fs.mkdirSync(backupDir, { recursive: false })

  for (const action of inspection.actions) {
    const relative = path.relative(dataDir, action.source)
    const backup = path.join(backupDir, relative)
    fs.mkdirSync(path.dirname(backup), { recursive: true })
    fs.copyFileSync(action.source, backup, fs.constants.COPYFILE_EXCL)
  }
  for (const action of inspection.actions) {
    if (!action.duplicate) {
      fs.mkdirSync(path.dirname(action.target), { recursive: true })
      fs.renameSync(action.source, action.target)
    } else fs.unlinkSync(action.source)
  }
  return { ...inspection, applied: true, backupDir }
}

function main() {
  const apply = process.argv.includes('--apply')
  const result = migrateData({ apply })
  if (!result.actions.length) {
    console.log('Data layout is already current; nothing to migrate.')
    return
  }
  console.log(`${apply ? 'Migrated' : 'Would migrate'} ${result.actions.length} data file(s):`)
  for (const action of result.actions) console.log(`- ${action.source} -> ${action.target}`)
  if (result.backupDir) console.log(`Backup: ${result.backupDir}`)
  if (!apply) console.log('Dry run only. Re-run with --apply to perform the migration.')
}

if (require.main === module) {
  try { main() }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}

module.exports = { inspectMigration, migrateData }
