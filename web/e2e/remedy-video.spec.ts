import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const require = createRequire(import.meta.url)
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = require(path.join(webRoot, '..', 'diagnose', 'engine.js'))
const remediation = require(path.join(webRoot, '..', 'diagnose', 'remediation.js'))

const ROOT_TOPIC = 'cnm_148'
const VIDEO_URL = 'https://video.example.com/cnm_148-concept'

function loadGraph() {
  const dataset = JSON.parse(readFileSync(path.join(webRoot, 'dist/data/subjects/math.json'), 'utf8'))
  const questionsFile = JSON.parse(
    readFileSync(path.join(webRoot, 'dist/data/subjects/math-questions.json'), 'utf8'),
  )
  return engine.buildGraph(dataset.topics, dataset.edges, questionsFile.questions)
}

async function seed(page: Page, options: { withVideo: boolean }) {
  const graph = loadGraph()
  const plan = remediation.createPlan(
    graph,
    {
      targets: ['cnm_221'],
      path: [
        { id: ROOT_TOPIC, status: 'weak', isRoot: true },
        { id: 'cnm_221', status: 'weak', isTarget: true },
      ],
    },
    { seed: 42 },
  )
  await page.addInitScript((value) => {
    if (!localStorage.getItem('cnmRemedy.plan.math.v1')) {
      localStorage.setItem('cnmRemedy.plan.math.v1', JSON.stringify({ v: 1, subject: 'math', plan: value.plan, savedAt: new Date().toISOString() }))
    }
    if (value.withVideo) {
      const video = {
        topicId: value.topicId,
        kind: 'concept',
        title: '完全平方公式概念讲解',
        url: value.url,
        provider: 'example',
        durationSec: 480,
      }
      localStorage.setItem('cnmVideo.custom.v1', JSON.stringify({
        v: 1,
        videos: { [value.topicId]: [video] },
      }))
    }
  }, { plan, withVideo: options.withVideo, topicId: ROOT_TOPIC, url: VIDEO_URL })
}

test.describe('视频讲解接入框架', () => {
  test('答错进入 help：有视频时显示讲解入口，点击打开外链并记埋点', async ({ page, context }) => {
    await context.route('**/video.example.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>video</title>' }))
    await seed(page, { withVideo: true })
    await page.goto(`/remedy/practice/${ROOT_TOPIC}`)

    // help 面板
    const first = ((): { answer: string; choices?: { key: string; text: string }[]; type: string } => {
      const g = loadGraph()
      const q = g.bank[ROOT_TOPIC][0]
      return q
    })()
    if (first.type === 'choice') {
      const wrongText = first.choices!.find((c) => c.key !== first.answer)!.text
      await page.locator('[data-test="remedy-choices"] button', { hasText: wrongText }).first().click()
      await page.getByRole('button', { name: '提交', exact: true }).click()
    }
    await expect(page.locator('[data-test="remedy-help"]')).toBeVisible()
    const entry = page.locator('[data-test="remedy-help"] [data-test="video-entry-link"]')
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('href', VIDEO_URL)
    await expect(entry).toHaveAttribute('target', '_blank')
    await expect(entry).toContainText('8 分钟')

    // 点击打开新标签
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      entry.click(),
    ])
    expect(newPage.url()).toBe(VIDEO_URL)

    const raw = await page.evaluate(() => localStorage.getItem('cnmTrack.v1'))
    expect(raw).toContain('video_open')
  })

  test('没有视频时入口完全不渲染，help 流程不受影响', async ({ page }) => {
    await seed(page, { withVideo: false })
    await page.goto(`/remedy/practice/${ROOT_TOPIC}`)
    const g = loadGraph()
    const first = g.bank[ROOT_TOPIC][0]
    const wrongText = first.choices.find((c: { key: string }) => c.key !== first.answer).text
    await page.locator('[data-test="remedy-choices"] button', { hasText: wrongText }).first().click()
    await page.getByRole('button', { name: '提交', exact: true }).click()
    await expect(page.locator('[data-test="remedy-help"]')).toBeVisible()
    await expect(page.locator('[data-test="video-entry-link"]')).toHaveCount(0)
    await page.getByRole('button', { name: '我看懂了，继续' }).click()
    await expect(page.locator('[data-test="video-entry-link"]')).toHaveCount(0)
  })
})
