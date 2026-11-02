import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const remediation = require(path.join(webRoot, '..', 'diagnose', 'remediation.js'))
const engine = require(path.join(webRoot, '..', 'diagnose', 'engine.js'))

function seededRemedyPlan() {
  const dataset = JSON.parse(readFileSync(path.join(webRoot, 'dist/data/subjects/math.json'), 'utf8'))
  const questionsFile = JSON.parse(
    readFileSync(path.join(webRoot, 'dist/data/subjects/math-questions.json'), 'utf8'),
  )
  const graph = engine.buildGraph(dataset.topics, dataset.edges, questionsFile.questions)
  return remediation.createPlan(
    graph,
    {
      targets: ['cnm_221'],
      path: [
        { id: 'cnm_148', status: 'weak', isRoot: true },
        { id: 'cnm_221', status: 'weak', isTarget: true },
      ],
    },
    { seed: 42 },
  )
}

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

test.describe('remedy pages at desktop and mobile widths', () => {
  for (const [name, url] of [['remedy-list', '/remedy/'], ['remedy-practice', '/remedy/practice/cnm_148']] as const) {
    for (const [label, width] of [['desktop', 1280], ['mobile', 375]] as const) {
      test(`${name} ${label} renders without horizontal overflow`, async ({ page }) => {
        await page.addInitScript((plan) => {
          localStorage.setItem(
            'cnmRemedy.plan.math.v1',
            JSON.stringify({ v: 1, subject: 'math', plan, savedAt: new Date().toISOString() }),
          )
        }, seededRemedyPlan())
        await page.setViewportSize({ width, height: 900 })
        await page.goto(url, { waitUntil: 'networkidle' })
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          appHeight: document.querySelector('#app')?.getBoundingClientRect().height ?? 0,
        }))
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2)
        expect(metrics.appHeight).toBeGreaterThan(100)
      })
    }
  }
})
