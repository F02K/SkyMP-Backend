'use strict'

const { loadEnvironment } = require('../src/config/environment')

try {
  loadEnvironment()
  const config = require('../src/config')
  console.log(`Configuration is valid for ${config.project.name}.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
