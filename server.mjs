import 'dotenv/config'
import express from 'express'
import searchHandler from './netlify/functions/search.mjs'
import adminHandler from './netlify/functions/admin.mjs'

const app = express()
app.use(express.json({ limit: '256kb' }))
const port = Number(process.env.API_PORT || 8787)

async function bridge(handler, req, res) {
  try {
    const request = new Request(`http://localhost:${port}${req.originalUrl}`, {
      method: req.method,
      headers: { 'content-type': 'application/json', authorization: req.headers.authorization || '' },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    })
    const response = await handler(request)
    res.status(response.status).type('application/json').send(await response.text())
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Local API error' })
  }
}
app.post('/api/search', (req, res) => bridge(searchHandler, req, res))
app.post('/api/admin', (req, res) => bridge(adminHandler, req, res))
app.listen(port, () => console.log(`Norov Local AI API: http://localhost:${port}`))
