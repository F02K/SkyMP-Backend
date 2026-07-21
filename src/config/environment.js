'use strict'

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

function loadEnvironment({ rootDir = path.join(__dirname, '..', '..'), env = process.env, logger = console } = {}) {
  dotenv.config({ path: path.join(rootDir, '.env'), processEnv: env })

  const sharedPath = env.SHARED_ENV_PATH || env.FROSTFALL_SHARED_ENV
  if (env.FROSTFALL_SHARED_ENV && !env.SHARED_ENV_PATH) {
    logger.warn('[config] FROSTFALL_SHARED_ENV is deprecated; use SHARED_ENV_PATH.')
  }
  if (sharedPath) {
    const resolved = path.resolve(rootDir, sharedPath)
    if (!fs.existsSync(resolved)) throw new Error(`SHARED_ENV_PATH does not exist: ${resolved}`)
    dotenv.config({ path: resolved, override: false, processEnv: env })
  }
}

module.exports = { loadEnvironment }
