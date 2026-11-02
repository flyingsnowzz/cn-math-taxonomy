import express, { type Express } from 'express'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { smsRouter } from './routes/sms.js'
import { wechatRouter } from './routes/wechat.js'
import { syncRouter } from './routes/sync.js'
import { trackRouter } from './routes/track.js'
import { adminRouter } from './routes/admin.js'
import { errorHandler, notFound } from './middleware/errors.js'

export function createApp(): Express {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  // 简单 CORS：开发与生产的前端来源由环境变量收敛（T3.4 收紧为白名单）
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  app.get('/', (_req, res) => res.json({ service: 'cnm-server', docs: '/healthz' }))
  app.use(healthRouter)
  app.use(authRouter)
  app.use(smsRouter)
  app.use(wechatRouter)
  app.use(syncRouter)
  app.use(trackRouter)
  app.use(adminRouter)

  // T3.1–T3.7 的路由在此挂载：/auth、/me、/sync、/track

  app.use(notFound)
  app.use(errorHandler)
  return app
}
