import { chromium } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'review-screenshots')
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const views = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 800 },
]
const pages = [
  { name: 'home', url: '/?subject=math' },
  { name: 'explore', url: '/explore/?subject=math#cnm_221' },
  { name: 'diagnose-demo', url: '/diagnose/?subject=math&target=cnm_221&demo=1' },
  { name: 'children', url: '/children/' },
]

for (const view of views) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  for (const item of pages) {
    await page.goto(`http://127.0.0.1:4188${item.url}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(outDir, `${view.name}-${item.name}.png`), fullPage: true })
  }
  await context.close()
}

await browser.close()
console.log(`Review screenshots written to ${outDir}`)
