import type { ErrorRequestHandler, RequestHandler } from 'express'

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: '接口不存在' } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code ?? 'error', message: err.message } })
    return
  }
  // express.json 等中间件抛出的错误带 status（如 413/400）
  if (typeof err?.status === 'number') {
    res.status(err.status).json({ error: { code: err.type ?? 'bad_request', message: err.message ?? '请求有误' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'internal', message: '服务异常' } })
}
