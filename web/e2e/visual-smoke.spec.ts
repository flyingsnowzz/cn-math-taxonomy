import { expect, test } from '@playwright/test'

const ROUTES = [
  { name: 'home', url: '/' },
  { name: 'explore', url: '/explore/?subject=math#cnm_221' },
  { name: 'diagnose-demo', url: '/diagnose/?target=cnm_221&demo=1' },
  { name: 'children', url: '/children/' },
  { name: 'children-history', url: '/children/history/' },
] as const

test.describe('visual smoke at desktop and mobile widths', () => {
  for (const route of ROUTES) {
    test(`${route.name} desktop renders without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(route.url, { waitUntil: 'networkidle' })
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        appHeight: document.querySelector('#app')?.getBoundingClientRect().height ?? 0,
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
      expect(metrics.appHeight).toBeGreaterThan(100)
    })

    test(`${route.name} mobile renders without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto(route.url, { waitUntil: 'networkidle' })
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        appHeight: document.querySelector('#app')?.getBoundingClientRect().height ?? 0,
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
      expect(metrics.appHeight).toBeGreaterThan(100)
    })
  }
})
