'use strict'

const { loadEnvironment } = require('./config/environment')

loadEnvironment()

const { redactSecrets } = require('./config/validation')
const { startRuntime } = require('./runtime/start')

startRuntime().then(runtime => {
  const stop = async signal => {
    console.log(`[runtime] received ${signal}; shutting down`)
    await runtime.stop()
    process.exit(0)
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))
}).catch(error => {
  console.error(redactSecrets(error.stack || error.message))
  process.exitCode = 1
})
