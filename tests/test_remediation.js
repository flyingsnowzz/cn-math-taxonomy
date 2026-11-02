#!/usr/bin/env node
/* 补救计划闭环测试：node tests/test_remediation.js（零依赖）。 */
'use strict';
const assert = require('assert');
const E = require('../diagnose/engine.js');
const R = require('../diagnose/remediation.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok   ' + name); }

function q(topic, n, diff) {
  return { id: topic + '_q' + n, topicId: topic, difficulty: diff, type: 'numeric',
    prompt: topic + n, answer: '1', explanation: 'e', verify: '1' };
}
const topics = [
  { id: 'a', name: 'A', domain: 'd', grade: 7, semester: '上', chapter: 'c', type: 'conceptual',
    description: '', mastery_criteria: ['x'], diagnostic_question: { question: 'q', answer: '1' }, external: false, standards: [] },
  { id: 'b', name: 'B', domain: 'd', grade: 8, semester: '上', chapter: 'c', type: 'procedural',
    description: '', mastery_criteria: ['x'], diagnostic_question: { question: 'q', answer: '1' }, external: false, standards: [] }
];
const deps = [{ topicId: 'b', prerequisiteId: 'a', strength: 'hard', reason: 'r' }];
const questions = [
  q('a', 1, 'basic'), q('a', 2, 'standard'), q('a', 3, 'standard'), q('a', 4, 'challenge'), q('a', 5, 'challenge'),
  q('b', 1, 'basic'), q('b', 2, 'standard'), q('b', 3, 'standard'), q('b', 4, 'challenge'), q('b', 5, 'challenge')
];
const graph = E.buildGraph(topics, deps, questions);
const DAY = 86400000;

// 构造一个 summary：a、b 都 weak，a 是根因（模拟引擎结构）
function weakSummary() {
  return { targets: ['b'], path: [
    { id: 'a', status: 'weak', isRoot: true, isTarget: false },
    { id: 'b', status: 'weak', isRoot: false, isTarget: true }
  ]};
}

test('建卡：按路径排序，第一张解锁，第二张锁定，排除诊断已做题', () => {
  const plan = R.createPlan(graph, weakSummary(), { usedIds: ['a_q1', 'b_q1'], seed: 7, practiceSize: 3, retestSize: 2 });
  assert.strictEqual(plan.cards.length, 2);
  const [ca, cb] = plan.cards;
  assert.strictEqual(ca.topicId, 'a');
  assert.strictEqual(ca.state, 'practice');
  assert.strictEqual(cb.state, 'locked');
  assert.deepStrictEqual(plan.usedIds.slice(0, 2).sort(), ['a_q1', 'b_q1']);
  // 练习题不与复测题重叠，且不含已做题
  const all = ca.practice.concat(ca.retest);
  assert.strictEqual(new Set(all).size, all.length);
  assert.ok(!all.includes('a_q1'));
  // 练习优先 basic/standard：排除 q1 后应选 q2/q3 等
  assert.ok(ca.practice.every((id) => !id.endsWith('_q1')));
});

test('练习全对进入复测，复测全对掌握并解锁下一张卡、排 1 天后复习', () => {
  let plan = R.createPlan(graph, weakSummary(), { seed: 1 });
  const t0 = Date.parse('2026-11-02T00:00:00+08:00');
  const ca = 'a';
  // 练习阶段
  let item = R.nextItem(graph, plan, ca);
  assert.strictEqual(item.phase, 'practice');
  plan = R.applyAnswer(graph, plan, ca, 'correct', t0);
  item = R.nextItem(graph, plan, ca);
  if (item && item.phase === 'practice') plan = R.applyAnswer(graph, plan, ca, 'correct', t0);
  item = R.nextItem(graph, plan, ca);
  if (item && item.phase === 'practice') plan = R.applyAnswer(graph, plan, ca, 'correct', t0);
  assert.strictEqual(plan.cards[0].state, 'retest');
  // 复测
  item = R.nextItem(graph, plan, ca);
  assert.strictEqual(item.phase, 'retest');
  plan = R.applyAnswer(graph, plan, ca, 'correct', t0);
  if (R.nextItem(graph, plan, ca)) plan = R.applyAnswer(graph, plan, ca, 'correct', t0);
  assert.strictEqual(plan.cards[0].state, 'mastered');
  assert.strictEqual(plan.cards[1].state, 'practice'); // 下一张解锁
  assert.strictEqual(plan.cards[0].reviewDueAt, t0 + DAY);
  assert.deepStrictEqual(R.dueReviews(plan, t0 + DAY + 1), ['a']);
  assert.deepStrictEqual(R.progress(plan), { total: 2, mastered: 1, percent: 50 });
});

test('练习答错进入 help，讲解后继续；复测答错打回练习', () => {
  let plan = R.createPlan(graph, weakSummary(), { seed: 1 });
  const ca = 'a';
  plan = R.applyAnswer(graph, plan, ca, 'wrong');
  assert.strictEqual(plan.cards[0].state, 'help');
  assert.strictEqual(plan.cards[0].wrongs, 1);
  // nextItem 在 help 阶段仍可看到当前游标之后的题？help 不推进游标出题，需 resume
  plan = R.resumeAfterHelp(plan, ca);
  assert.strictEqual(plan.cards[0].state, 'practice');
  // 答完剩余练习题
  let guard = 0;
  let item = R.nextItem(graph, plan, ca);
  while (item && item.phase === 'practice' && guard < 5) { plan = R.applyAnswer(graph, plan, ca, 'correct'); item = R.nextItem(graph, plan, ca); guard++; }
  assert.strictEqual(plan.cards[0].state, 'retest');
  // 复测第一题答错 -> 回练习
  plan = R.applyAnswer(graph, plan, ca, 'wrong');
  assert.strictEqual(plan.cards[0].phase, 'practice');
  assert.strictEqual(plan.cards[0].state, 'practice');
  assert.strictEqual(plan.cards[0].cursor, 0);
});

test('题量不足时标记 shortfall，不重复出题；注入变式后可继续', () => {
  // 小题库：a 只有 2 题，且诊断已用 1 题，练习只要 1 题，复测要 3 题（不足）
  const tiny = E.buildGraph(topics, deps, [
    q('a', 1, 'basic'), q('a', 2, 'standard'),
    q('b', 1, 'basic'), q('b', 2, 'standard'), q('b', 3, 'standard')
  ]);
  // a 仅 2 题：诊断用掉 q1，练习占走 q2，复测无题可出 -> shortfall
  const plan0 = R.createPlan(tiny, weakSummary(), { usedIds: ['a_q1'], practiceSize: 1, retestSize: 3 });
  assert.strictEqual(plan0.cards[0].practice.length, 1);
  assert.strictEqual(plan0.cards[0].retest.length, 0);
  assert.strictEqual(plan0.cards[0].retestShortfall, true);
  let plan = R.applyAnswer(tiny, plan0, 'a', 'correct');
  assert.strictEqual(plan.cards[0].state, 'shortfall');
  // 补一道变式复测题后继续
  plan = R.addVariant(plan, 'a', 'retest', [q('a', 6, 'standard')]);
  assert.strictEqual(plan.cards[0].state, 'retest');
  assert.ok(plan.cards[0].retest.includes('a_q6'));
  plan = R.applyAnswer(tiny, plan, 'a', 'correct');
  assert.strictEqual(plan.cards[0].state, 'mastered');
});

test('间隔复习：通过推进 3/7/15 天，失败打回练习', () => {
  let plan = R.createPlan(graph, weakSummary(), { seed: 3 });
  const t0 = 1000000;
  // 直接把 a 置为 mastered
  plan.cards[0].state = 'mastered'; plan.cards[0].masteredAt = t0;
  plan.cards[0].reviewStep = 0; plan.cards[0].reviewDueAt = t0 + DAY;
  plan = R.applyReview(plan, 'a', true, t0 + DAY);
  assert.strictEqual(plan.cards[0].reviewDueAt, t0 + DAY + 3 * DAY);
  plan = R.applyReview(plan, 'a', false, t0 + 4 * DAY);
  assert.strictEqual(plan.cards[0].state, 'practice');
  assert.strictEqual(plan.cards[0].reviewDueAt, null);
});

test('复习出题：只选未做过的题，未掌握的点不出题', () => {
  let plan = R.createPlan(graph, weakSummary(), { seed: 1 });
  // 未掌握：空数组
  assert.deepStrictEqual(R.reviewItems(graph, plan, 'a', 2), []);
  const card = plan.cards[0];
  card.state = 'mastered';
  const items = R.reviewItems(graph, plan, 'a', 2);
  assert.ok(items.length >= 1);
  items.forEach((q) => assert.ok(!plan.usedIds.includes(q.id)));
  // 不修改 plan
  assert.strictEqual(plan.cards[0].state, 'mastered');
});

test('纯函数：入参不被修改，plan 可 JSON 序列化', () => {
  const plan = R.createPlan(graph, weakSummary(), {});
  const snap = JSON.stringify(plan);
  R.applyAnswer(graph, plan, 'a', 'correct');
  assert.strictEqual(JSON.stringify(plan), snap);
  JSON.parse(JSON.stringify(plan)); // 无循环引用
});

console.log('\n' + passed + ' tests passed');
