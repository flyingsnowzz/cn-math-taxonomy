import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { config } from '../config.js'
import { HttpError } from './errors.js'

function sameSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** 内部管理接口使用独立 Basic Auth，不与用户 JWT 或外部服务密钥复用。 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (config.adminPassword.length < 16) {
    next(new HttpError(503, '管理接口未配置', 'admin_not_configured'))
    return
  }
  const header = req.header('authorization') ?? ''
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(header)
  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    const username = separator >= 0 ? decoded.slice(0, separator) : ''
    const password = separator >= 0 ? decoded.slice(separator + 1) : ''
    if (sameSecret(username, config.adminUsername) && sameSecret(password, config.adminPassword)) {
      next()
      return
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="cnm-admin", charset="UTF-8"')
  next(new HttpError(401, '管理凭证无效', 'admin_unauthorized'))
}
