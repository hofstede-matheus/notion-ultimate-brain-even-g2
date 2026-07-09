import './load-env'
import express from 'express'
import cors from 'cors'
import { config } from '../config'
import { ROUTES } from '../routes'
import { parseTenant } from '../tenant'
import { createNotionClient } from '../notion-client'

const app = express()
app.use(cors())
app.use(express.json())

for (const route of ROUTES) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
  app[method](route.path, async (req, res) => {
    const tenant = parseTenant(req.headers['x-notion-config'])
    if (!route.public && !tenant) {
      res.status(401).json({ error: 'Missing or invalid Notion configuration' })
      return
    }
    const result = await route.handler({
      params: req.params,
      body: req.body,
      notion: tenant ? createNotionClient(tenant.token) : undefined,
      db: tenant?.db,
    })
    res.status(result.status).json(result.body)
  })
}

app.listen(config.port, () => {
  console.log(`[notion-ultimate-brain-server] Listening on http://localhost:${config.port}`)
})
