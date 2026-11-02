import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../services/tokens.js'

/** 可选登录：带有效 Bearer 则注入 req.user，否则按匿名继续。 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (match) {
    try {
      const claims = await verifyAccessToken(match[1])
      req.user = { id: claims.sub }
    } catch {
      // 匿名继续；埋点不因 token 过期而失败
    }
  }
  next()
}
