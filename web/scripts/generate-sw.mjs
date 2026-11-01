import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const manifestPath = path.join(dist, '.vite', 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

const entries = Object.values(manifest)
const assets = new Set(['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'])
for (const entry of entries) {
  if (entry.file) assets.add(`/${entry.file}`)
  for (const css of entry.css ?? []) assets.add(`/${css}`)
  for (const asset of entry.assets ?? []) {
    if (typeof asset === 'string') assets.add(`/${asset}`)
  }
}

const precacheList = JSON.stringify([...assets], null, 2)
const serviceWorker = `const CACHE_VERSION = 'cnm-vue-v1-' + __BUILD_ID__
const PRECACHE_URLS = ${precacheList}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION)
    await cache.addAll(PRECACHE_URLS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(CACHE_VERSION)
        await cache.put(request, response.clone())
        return response
      } catch {
        return (await caches.match(request)) ?? caches.match('/index.html')
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    const network = fetch(request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION)
          await cache.put(request, response.clone())
        }
        return response
      })
      .catch(() => undefined)
    return cached ?? (await network) ?? Response.error()
  })())
})
`
  .replace("__BUILD_ID__", JSON.stringify(new Date().toISOString()))

await writeFile(path.join(dist, 'sw.js'), serviceWorker)
