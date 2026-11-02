import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('production service worker supports offline reload', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.state === 'activated'
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await page.reload()
  await expect(page.getByRole('heading', { name: '先找到真正没有学会的那一步' })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '先找到真正没有学会的那一步' })).toBeVisible()
  await context.setOffline(false)
})

test('service worker always registers at the application root scope', async ({ page }) => {
  await page.goto('/explore/?subject=math#cnm_221')
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return false
    const registrations = await navigator.serviceWorker.getRegistrations()
    return registrations.some((registration) => {
      const script = registration.active?.scriptURL
      return new URL(registration.scope).pathname === '/' && Boolean(script)
    })
  })
  const registrations = await page.evaluate(async () => {
    const items = await navigator.serviceWorker.getRegistrations()
    return items.map((registration) => {
      const script = registration.active?.scriptURL
        ?? registration.waiting?.scriptURL
        ?? registration.installing?.scriptURL
        ?? ''
      return {
        scope: new URL(registration.scope).pathname,
        script: script ? new URL(script).pathname : '',
      }
    })
  })
  expect(registrations).toContainEqual({ scope: '/', script: '/sw.js' })
  expect(registrations.filter((registration) => registration.scope.startsWith('/explore'))).toHaveLength(0)
})
