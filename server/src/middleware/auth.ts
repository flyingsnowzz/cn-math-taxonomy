import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../services/tokens.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) {
    res.status(401).json({ error: { code: 'unauthorized', message: '请先登录' } })
    return
  }
  try {
    const claims = await verifyAccessToken(match[1])
    req.user = { id: claims.sub }
    next()
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'invalid_token'
    res.status(401).json({ error: { code, message: '登录状态无效或已过期' } })
  }
}
