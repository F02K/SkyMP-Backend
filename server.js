require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const path     = require('path')

const newsRoute       = require('./routes/news')
const statusRoute     = require('./routes/status')
const manifestRoute   = require('./routes/manifest')
const versionRoute    = require('./routes/version')
const serverinfoRoute = require('./routes/serverinfo')
const metricsRoute    = require('./routes/metrics')
const discordRoute    = require('./routes/discord-auth')
const filesRoute      = require('./routes/files')
const modlistRoute    = require('./routes/modlist')
const serversRoute    = require('./routes/servers')
const webhookRoute    = require('./routes/webhook')

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors())

// Capture the raw request body so the webhook route can verify the
// GitHub HMAC-SHA256 signature without a separate body-parser step.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf },
}))

// Static file serving — root/ is installed into Skyrim/ (Data/ sub-dir + SKSE base files)
app.use('/files/root', express.static(path.join(__dirname, 'public', 'files', 'root')))

app.use('/api/news',       newsRoute)
app.use('/api/status',     statusRoute)
app.use('/api/manifest',   manifestRoute)
app.use('/api/version',    versionRoute)
app.use('/api/serverinfo', serverinfoRoute)
app.use('/api/metrics',    metricsRoute)
app.use('/api/files',     filesRoute)
app.use('/api/modlist',   modlistRoute)
app.use('/api/servers',   serversRoute)
app.use('/auth/discord',   discordRoute)
app.use('/webhooks',       webhookRoute)

app.listen(PORT, () => {
  console.log(`Frostfall backend running on http://localhost:${PORT}`)
})
