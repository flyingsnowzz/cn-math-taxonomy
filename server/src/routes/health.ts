import { Router } from 'express'
import { getPool } from '../db/pool.js'

export const healthRouter = Router()

healthRouter.get('/healthz', async (_req, res) => {
  try {
    await getPool().query('SELECT 1')
    res.json({ ok: true, service: 'cnm-server', version: '0.1.0', db: 'up' })
  } catch {
    res.status(503).json({ ok: false, service: 'cnm-server', version: '0.1.0', db: 'down' })
  }
})
