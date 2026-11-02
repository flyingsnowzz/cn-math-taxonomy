import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import type { Question } from '../src/data/types'

type QuestionBankGraph = { bank: Record<string, Question[]> }

const require = createRequire(import.meta.url)
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(webRoot, '..')
const engine = require(path.join(repoRoot, 'diagnose', 'engine.js'))
const remediation = require(path.join(repoRoot, 'diagnose', 'remediation.js'))

const ROOT_TOPIC = 'cnm_148' // 完全平方公式
const TARGET_TOPIC = 'cnm_221' // 配方法

function loadGraph() {
  const dataset = JSON.parse(readFileSync(path.join(webRoot, 'dist/data/subjects/math.json'), 'utf8'))
  const questionsFile = JSON.parse(
    readFileSync(path.join(webRoot, 'dist/data/subjects/math-questions.json'), 'utf8'),
  )
  return engine.buildGraph(dataset.topics, dataset.edges, questionsFile.questions)
}

function buildPlan(graph: QuestionBankGraph) {
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

async function seedPlan(page: Page, plan: unknown) {
  await page.addInitScript((value) => {
    // 只在首次注入：后续整页导航要保留已持久化的进度。
    if (!localStorage.getItem('cnmRemedy.plan.math.v1')) {
      localStorage.setItem(
        'cnmRemedy.plan.math.v1',
        JSON.stringify({ v: 1, subject: 'math', plan: value, savedAt: new Date().toISOString() }),
      )
    }
  }, plan)
}

async function answerChoice(page: Page, question: Question, correct: boolean) {
  const wantedKey = correct
    ? question.answer
    : (question.choices?.find((choice) => choice.key !== question.answer)?.key ?? question.answer)
  const wantedText = question.choices?.find((choice) => choice.key === wantedKey)?.text ?? ''
  await page
    .locator('[data-test="remedy-choices"] button', { hasText: wantedText })
    .first()
    .click()
  await page.getByRole('button', { name: '提交', exact: true }).click()
}

async function answerNumeric(page: Page, question: Question, correct: boolean) {
  await page
    .locator('[data-test="remedy-text-input"]')
    .fill(correct ? question.answer : '-99999')
  await page.getByRole('button', { name: '提交', exact: true }).click()
}

async function answer(page: Page, question: Question, correct: boolean) {
  if (question.type === 'choice') await answerChoice(page, question, correct)
  else await answerNumeric(page, question, correct)
}

function questionById(graph: QuestionBankGraph, id: string): Question {
  return graph.bank[ROOT_TOPIC].find((question: Question) => question.id === id)
}

test.describe('补救闭环（remediation）', () => {
  test('练习全对 → 复测通过 → 第一张卡补上、第二张解锁', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    expect(card.topicId).toBe(ROOT_TOPIC)
    await seedPlan(page, plan)

    await page.goto(`/remedy/practice/${ROOT_TOPIC}`)
    await expect(page.getByRole('heading', { name: '完全平方公式' })).toBeVisible()
    await expect(page.locator('[data-test="remedy-phase"]')).toHaveText('针对性练习')

    // 练习 3 题全对
    for (const qid of card.practice) {
      const question = questionById(graph, qid)
      await expect(page.locator('[data-test="remedy-choices"], [data-test="remedy-text-input"]').first()).toBeVisible()
      await answer(page, question, true)
    }
    // 复测
    await expect(page.locator('[data-test="remedy-phase"]')).toHaveText('复测')
    for (const qid of card.retest) {
      await answer(page, questionById(graph, qid), true)
    }

    await expect(page.locator('[data-test="remedy-done"]')).toBeVisible()
    await expect(page.getByText('已补上')).toBeVisible()

    await page.goto('/remedy/')
    await expect(page.locator('[data-test="remedy-progress"]')).toHaveText(/已补上 1 \/ 2/)
    const cards = page.locator('[data-test="remedy-card"]')
    await expect(cards.nth(0)).toContainText('已补上')
    await expect(cards.nth(1)).toContainText('开始练习')
  })

  test('练习答错进入讲解继续；复测答错打回练习', async ({ page }) => {
    const graph = loadGraph()
    const plan = buildPlan(graph)
    const card = plan.cards[0]
    await seedPlan(page, plan)

    await page.goto(`/remedy/practice/${ROOT_TOPIC}`)
    // 第一题（选择题）答错 → help
    await answer(page, questionById(graph, card.practice[0]), false)
    await expect(page.locator('[data-test="remedy-help"]')).toBeVisible()
    await expect(page.locator('[data-test="remedy-help"]')).toContainText('参考答案')
    await page.getByRole('button', { name: '我看懂了，继续' }).click()

    // 剩余练习题答对
    for (const qid of card.practice.slice(1)) {
      await answer(page, questionById(graph, qid), true)
    }
    await expect(page.locator('[data-test="remedy-phase"]')).toHaveText('复测')

    // 复测答错 → 回到练习（第一题重新出现）
    await answer(page, questionById(graph, card.retest[0]), false)
    await expect(page.locator('[data-test="remedy-phase"]')).toHaveText('针对性练习')
    await expect(page.locator('[data-test="remedy-choices"]')).toBeVisible()
  })

  test('诊断结果页的「开始补救」CTA 跳转并落盘计划', async ({ page }) => {
    const graph = loadGraph()
    // 构造一份已完成、全部答错的诊断会话
    let session = engine.createSession(graph, [ROOT_TOPIC], { limit: 16, seed: 'e2e-remedy' })
    let item = engine.nextItem(graph, session)
    while (item) {
      session = engine.applyAnswer(graph, session, item.topicId, 'wrong')
      item = engine.nextItem(graph, session)
    }
    const summary = engine.summarize(graph, session)
    expect(summary.weak.length + summary.shaky.length).toBeGreaterThan(0)

    await page.addInitScript((value) => {
      localStorage.setItem('cnmDiagnose.session.v2', JSON.stringify(value))
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
    const cta = page.locator('[data-test="remedy-cta"]')
    await expect(cta).toBeVisible({ timeout: 20_000 })
    await cta.getByRole('button', { name: /开始补救/ }).click()
    await expect(page).toHaveURL(/\/remedy\/$/)
    const saved = await page.evaluate(() => localStorage.getItem('cnmRemedy.plan.math.v1'))
    expect(saved).toBeTruthy()
    expect(String(saved)).toContain('"cards"')
  })
})
