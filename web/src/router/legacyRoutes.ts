import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { subjectFromTopicId } from '@/data/subjectRegistry'

function querySubject(to: RouteLocationNormalized): string | undefined {
  const explicit = typeof to.query.subject === 'string' ? to.query.subject : ''
  if (explicit) return explicit
  const target = typeof to.query.target === 'string' ? to.query.target : ''
  const first = target.split(',')[0]?.trim() ?? ''
  return subjectFromTopicId(first) ?? undefined
}

export function redirectLegacyFileRoute(to: RouteLocationNormalized): RouteLocationRaw | undefined {
  const fileMap: Record<string, string> = {
    'index.html': '/',
    'explore/index.html': '/explore/',
    'explore.html': '/explore/',
    'diagnose/index.html': '/diagnose/',
    'diagnose.html': '/diagnose/',
    'children/index.html': '/children/',
    'children.html': '/children/',
    'children/history.html': '/children/history/',
    'children/history/index.html': '/children/history/',
  }

  const normalisedPath = to.path.replace(/^\/+/, '')
  const destination = fileMap[normalisedPath]
  if (!destination) return undefined
  return {
    path: destination,
    query: to.fullPath.includes('?')
      ? Object.fromEntries(new URL(to.fullPath, 'http://legacy.local').searchParams)
      : to.query,
    hash: to.hash,
    replace: true,
  }
}

export function redirectLegacyHash(to: RouteLocationNormalized): RouteLocationRaw | undefined {
  if (to.path !== '/' || !to.hash) return undefined
  const topicId = decodeURIComponent(to.hash.replace(/^#/, ''))
  const subject = subjectFromTopicId(topicId)
  if (!subject) return undefined
  return {
    path: '/explore/',
    query: { ...to.query, subject },
    hash: `#${encodeURIComponent(topicId)}`,
    replace: true,
  }
}

export function normalizeDiagnoseSubject(to: RouteLocationNormalized): RouteLocationRaw | undefined {
  if (to.path !== '/diagnose/' && to.path !== '/diagnose') return undefined
  const subject = querySubject(to)
  if (!subject || to.query.subject === subject) return undefined
  return {
    path: to.path,
    query: { ...to.query, subject },
    hash: to.hash,
    replace: true,
  }
}
