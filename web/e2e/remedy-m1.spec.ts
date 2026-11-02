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
const TARGET_TOPIC = 'cnm_221'
const PLAN_KEY = 'cnmRemedy.plan.math.v1'

function loadGraph() {
  const dataset = JSON.parse(readFileSync(path.join(webRoot, 'dist/data/subjects/math.json'), 'utf8'))
  const questionsFile = JSON.parse(
    readFileSync(path.join(webRoot, 'dist/data/subjects/math-questions.json'), 'utf8'),
  )
  return engine.buildGraph(dataset.topics, dataset.edges, questionsFile.questions)
}

function buildPlan(graph: unknown) {
  return remediation.createPlan(
    graph,
    {
      targets: [TARGET_TOPIC],
      path: [
        { id: ROOT_TOPIC, status: 'weak', isRoot: true },
        { id: TARGET_TOPIC, status: 'weak', isTarget: true },
      ],
    },
    { seed: 42 },
  )
}

async function seedPlan(page: Page, plan: unknown, onlyIfMissing = true) {
  await page.addInitScript(({ key, value, missing }) => {
    if (!missing || !localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ v: 1, subject: 'math', plan: value, savedAt: new Date().toISOString() }))
    }
  }, { key: PLAN_KEY, value: plan, missing: onlyIfMissing })
}

test.describe('M1：报告、分享、复习、灰度', () => {
  test('提分报告显示进度，分享链接可打开公开摘要；下载分享图记埋点', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    card.state = 'mastered'
    card.masteredAt = plan.createdAt + 3 * 60000
    card.reviewStep = 0
    card.reviewDueAt = plan.createdAt + 3 * 60000 + 86400000
    await seedPlan(page, plan)

    await page.goto('/remedy/report')
    await expect(page.locator('[data-test="report-mastered"]')).toHaveText('1')
    await expect(page.getByText('完全平方公式')).toBeVisible()
    await expect(page.getByText('还在补')).toBeVisible()

    const shareUrl = (await page.locator('[data-test="report-share-url"]').textContent()) ?? ''
    expect(shareUrl).toContain('/remedy/shared?r=')
    await page.locator('[data-test="report-download"]').click()
    const track = await page.evaluate(() => localStorage.getItem('cnmTrack.v1'))
    expect(track).toContain('report_share')

    await page.goto(shareUrl.replace('http://127.0.0.1:4173', ''))
    await expect(page.locator('[data-test="shared-mastered"]')).toContainText('1')
    await expect(page.getByText('完全平方公式')).toBeVisible()
    await expect(page.getByRole('link', { name: /免费诊断/ })).toBeVisible()
  })

  test('到期复习：首页横幅进入，答对后完成，到期清零', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    card.state = 'mastered'
    card.masteredAt = Date.now() - 2 * 86400000
    card.reviewStep = 0
    card.reviewDueAt = Date.now() - 86400000
    // 保留 q4 作为未做过的复习题（练习只用了 q1-q3）
    plan.usedIds = card.practice.slice()
    const reviewQuestion = graph.bank[ROOT_TOPIC].find((q: { id: string }) => q.id === card.retest[0])
    expect(reviewQuestion.type).toBe('numeric')

    await seedPlan(page, plan)
    await page.goto('/')
    await expect(page.locator('[data-testid="home-review-banner"]')).toBeVisible()
    await page.goto('/remedy/')
    await expect(page.locator('[data-test="remedy-review-banner"]')).toBeVisible()
    await page.locator('[data-test="remedy-review-banner"]').click()

    await expect(page.getByRole('heading', { name: '今日复习' })).toBeVisible()
    await expect(page.locator('[data-test="review-remaining"]')).toContainText('到期 1 个')
    await page.locator('[data-test="remedy-text-input"]').fill(reviewQuestion.answer)
    await page.getByRole('button', { name: '提交', exact: true }).click()

    await expect(page.locator('[data-test="review-done"]')).toBeVisible()
    await page.goto('/remedy/')
    await expect(page.locator('[data-test="remedy-review-banner"]')).toHaveCount(0)
  })

  test('复习答错：打回练习队列并给出入口', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    card.state = 'mastered'
    card.masteredAt = Date.now() - 2 * 86400000
    card.reviewStep = 0
    card.reviewDueAt = Date.now() - 86400000
    plan.usedIds = card.practice.slice()

    await seedPlan(page, plan)
    await page.goto('/remedy/review')
    await expect(page.getByRole('heading', { name: '今日复习' })).toBeVisible()
    await page.locator('[data-test="remedy-text-input"]').fill('-99999')
    await page.getByRole('button', { name: '提交', exact: true }).click()
    await expect(page.locator('[data-test="review-failed"]')).toBeVisible()
    await expect(page.locator('[data-test="review-failed"] a')).toHaveAttribute(
      'href',
      `/remedy/practice/${ROOT_TOPIC}`,
    )
  })

  test('灰度关闭：首页入口与诊断 CTA 隐藏', async ({ page }) => {
    // 首页入口
    await page.goto('/?remedy=0')
    await expect(page.locator('[data-testid="home-remedy-entry"]')).toHaveCount(0)

    // 已完成诊断也不显示 CTA
    const graph = loadGraph()
    let session = engine.createSession(graph, [ROOT_TOPIC], { limit: 16, seed: 'm1-flag' })
    let item = engine.nextItem(graph, session)
    while (item) {
      session = engine.applyAnswer(graph, session, item.topicId, 'wrong')
      item = engine.nextItem(graph, session)
    }
    await page.addInitScript((value) => {
      localStorage.setItem(
        'cnmDiagnose.session.v2',
        JSON.stringify(value),
      )
    }, {
      v: 2,
      mode: session.mode,
      targets: session.targets,
      limit: session.limit,
      confirm: session.confirm,
      label: '完全平方公式',
      answers: session.answers,
      seed: session.seed,
      avoid: session.avoid,
      savedAt: new Date().toISOString(),
    })
    await page.goto(`/diagnose/?target=${ROOT_TOPIC}`)
    await expect(page.locator('[data-test="remedy-cta"]')).toHaveCount(0)
  })

  test('练习漏斗埋点：practice_start/help_view/retest_pass 落本地', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    await seedPlan(page, plan)

    await page.goto(`/remedy/practice/${ROOT_TOPIC}`)
    await expect(page.getByRole('heading', { name: '完全平方公式' })).toBeVisible()
    // 第一题答错 → help_view
    const firstId = card.practice[0]
    const first = graph.bank[ROOT_TOPIC].find((q: { id: string }) => q.id === firstId)
    if (first.type === 'choice') {
      const wrongText = first.choices.find((c: { key: string }) => c.key !== first.answer).text
      await page.locator('[data-test="remedy-choices"] button', { hasText: wrongText }).first().click()
      await page.getByRole('button', { name: '提交', exact: true }).click()
    }
    await page.getByRole('button', { name: '我看懂了，继续' }).click()
    // 剩余练习答对
    for (const qid of card.practice.slice(1)) {
      const question = graph.bank[ROOT_TOPIC].find((q: { id: string }) => q.id === qid)
      await page.locator('[data-test="remedy-text-input"]').fill(question.answer)
      await page.getByRole('button', { name: '提交', exact: true }).click()
    }
    // 复测答对
    const retest = graph.bank[ROOT_TOPIC].find((q: { id: string }) => q.id === card.retest[0])
    await page.locator('[data-test="remedy-text-input"]').fill(retest.answer)
    await page.getByRole('button', { name: '提交', exact: true }).click()
    await expect(page.locator('[data-test="remedy-done"]')).toBeVisible()

    const raw = await page.evaluate(() => localStorage.getItem('cnmTrack.v1'))
    const names = JSON.parse(raw ?? '[]').map((event: { name: string }) => event.name)
    expect(names).toContain('practice_start')
    expect(names).toContain('help_view')
    expect(names).toContain('retest_pass')
    expect(names).toContain('practice_done')
  })
})
