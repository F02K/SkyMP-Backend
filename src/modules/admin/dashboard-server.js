'use strict'

const express = require('express')
const path = require('path')
const config = require('../../config')

function createDashboardApp() {
  const app = express()
  const publicDir = path.join(config.rootDir, 'public', 'dashboard')
  app.get('/dashboard-config.js', (_req, res) => {
    res.type('application/javascript').send(`window.SKYMP_DASHBOARD_CONFIG=${JSON.stringify({
      apiBaseUrl: config.dashboard.apiBaseUrl,
      dashboardUrl: config.dashboard.publicUrl,
      projectName: config.project.name,
    })};`)
  })
  app.use(express.static(publicDir))
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))
  return app
}

function startDashboard() {
  if (!config.dashboard.enabled) return Promise.resolve(null)
  const app = createDashboardApp()
  return new Promise((resolve, reject) => {
    const server = app.listen(config.dashboard.port, () => resolve(server))
    server.once('error', reject)
  })
}

module.exports = { createDashboardApp, startDashboard }
