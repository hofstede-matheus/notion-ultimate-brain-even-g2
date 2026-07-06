import './load-env'
import express from 'express'
import cors from 'cors'
import { config, assertConfig } from '../config'
import { ROUTES } from '../routes'

try {
  assertConfig(config)
} catch (err: any) {
  console.error(err.message)
  process.exit(1)
}

console.log(
  `[notion-ultimate-brain-server] Notion DBs: tasks=${config.notionTasksDb} notes=${config.notionNotesDb} projects=${config.notionProjectsDb} tags=${config.notionTagsDb}`
)

const app = express()
app.use(cors())
app.use(express.json())

for (const route of ROUTES) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
  app[method](route.path, async (req, res) => {
    const result = await route.handler({ params: req.params, body: req.body })
    res.status(result.status).json(result.body)
  })
}

app.listen(config.port, () => {
  console.log(`[notion-ultimate-brain-server] Listening on http://localhost:${config.port}`)
})
