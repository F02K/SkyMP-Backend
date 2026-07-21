'use strict'

const path = require('path')
const { syncLauncherUpdates } = require('../src/modules/launcher/update-service')

const sourceArgument = process.argv[2]
if (!sourceArgument) {
  console.error('Usage: npm run publish-launcher -- <launcher-dist-directory>')
  process.exit(1)
}

const source = path.resolve(sourceArgument)
const target = path.join(__dirname, '..', 'public', 'launcher-updates')

try {
  const metadata = syncLauncherUpdates(source, target)
  console.log(
    `Published launcher ${metadata['latest.yml'].version} for Windows and `
    + `${metadata['latest-linux.yml'].version} for Linux to ${target}`
  )
} catch (error) {
  console.error(`Launcher update publish failed: ${error.message}`)
  process.exitCode = 1
}
