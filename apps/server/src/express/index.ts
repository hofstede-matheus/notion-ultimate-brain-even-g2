import './load-env';
import cors from 'cors';
import express from 'express';
import { config } from '../config';
import { ROUTES, runRoute } from '../routes';

const app = express();
app.use(cors());
app.use(express.json());

for (const route of ROUTES) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
  app[method](route.path, async (req, res) => {
    const result = await runRoute(route, {
      params: req.params,
      body: req.body,
      tenantHeader: req.headers['x-notion-config'],
      tokenHeader: req.headers['x-notion-token'],
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.status(result.status).json(result.body);
  });
}

app.listen(config.port, () => {
  console.log(`[notion-ultimate-brain-server] Listening on http://localhost:${config.port}`);
});
