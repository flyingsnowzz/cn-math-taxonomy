/* 补救计划（remediation）：诊断之后的练习 → 讲解 → 复测 → 间隔复习闭环。
 *
 * 纯函数、无 DOM、无依赖，会话状态可 JSON 序列化。图结构由 DiagEngine.buildGraph 产生
 * （用到 graph.byId / graph.prereqs / graph.bank）。本模块不直接依赖 engine.js，
 * 但约定与其相同的图形状。
 *
 * 数据流：
 *   createPlan(graph, summary, opts)                -> plan（任务卡按学习路径排序）
 *   startPractice(plan, cardId)                     -> plan
 *   nextItem(graph, plan, cardId)                   -> {phase:'practice'|'retest', question} | null
 *   applyAnswer(graph, plan, cardId, verdict)       -> plan（不修改入参）
 *     练习阶段：列表内全部答对 -> 'retest'；出现错题 -> 'help'（等待讲解/变式）
 *     讲解/变式完成后：resumeAfterHelp(plan, cardId) -> 用剩余未做题继续，仍不足则判 'shortfall'
 *     复测阶段：全对 -> 'mastered'（解锁下一张卡，排首次复习）；出现错题 -> 回到 'practice'
 *   dueReviews(plan, nowMs)                         -> 到期复习的卡 id
 *   applyReview(plan, cardId, passed, nowMs)        -> 通过则推进间隔（1/3/7/15 天），失败回到练习
 *
 * 题库约束：每点题量可能很少（4–5 题，且诊断已用掉部分）。createPlan 用 usedIds
 * 排除诊断做过的题；题不够时卡上记录 practiceShortfall/retestShortfall，由上层决定
 * 走 AI 变式还是降题量，绝不在数据里偷偷重复出题。
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Remediation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REVIEW_INTERVALS_MS = [1, 3, 7, 15].map(function (d) { return d * 24 * 3600 * 1000; });
  var DIFF_RANK = { basic: 0, standard: 1, challenge: 2, advanced: 2 };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // 选题：先 basic/standard，同难度内保持题号顺序为主、随机打散为辅；
  // 排除 used（全局已做题）与 exclude（本卡其它阶段已选）。
  function chooseQuestions(graph, topicId, want, used, exclude, rnd) {
    var pool = (graph.bank[topicId] || []).filter(function (q) {
      return !used[q.id] && !exclude[q.id];
    });
    // 练习不用 advanced；若池子因此为空（极端情况）再放开难度限制
    var normal = pool.filter(function (q) { return DIFF_RANK[q.difficulty] <= 1; });
    if (!normal.length) normal = pool;
    var byDiff = { basic: [], standard: [], other: [] };
    normal.forEach(function (q) {
      if (q.difficulty === 'basic') byDiff.basic.push(q);
      else if (q.difficulty === 'standard') byDiff.standard.push(q);
      else byDiff.other.push(q);
    });
    var ordered = byDiff.basic.concat(byDiff.standard).concat(shuffle(byDiff.other, rnd));
    return ordered.slice(0, want).map(function (q) { return q.id; });
  }

  /**
   * @param summary DiagEngine.summize 的返回值，使用其中 path（已按年级/拓扑排序）
   * @param opts.usedIds 本次诊断已答过的题目 id 数组（避免重复出题）
   * @param opts.seed    随机种子，保证可复现
   */
  function createPlan(graph, summary, opts) {
    opts = opts || {};
    var practiceSize = opts.practiceSize || 3;
    var retestSize = opts.retestSize || 2;
    var rnd = mulberry32(opts.seed || 1);
    var used = {};
    (opts.usedIds || []).forEach(function (id) { used[id] = true; });

    // summary.path 已按先修顺序排好；只给 weak / shaky 建卡
    var entries = (summary.path || []).filter(function (p) {
      return p.status === 'weak' || p.status === 'shaky';
    });

    var cards = entries.map(function (entry, idx) {
      var chosen = {};
      var practiceIds = chooseQuestions(graph, entry.id, practiceSize, used, chosen, rnd);
      practiceIds.forEach(function (id) { chosen[id] = true; });
      var retestIds = chooseQuestions(graph, entry.id, retestSize, used, chosen, rnd);
      return {
        topicId: entry.id,
        kind: entry.status,            // weak | shaky
        isRoot: !!entry.isRoot,
        isTarget: !!entry.isTarget,
        order: idx,
        state: 'locked',               // locked | practice | help | retest | mastered
        unlocked: idx === 0,
        practice: practiceIds,
        retest: retestIds,
        cursor: 0,
        phase: 'practice',
        wrongs: 0,
        practiceShortfall: practiceIds.length < practiceSize,
        retestShortfall: retestIds.length < retestSize,
        masteredAt: null,
        reviewStep: 0,
        reviewDueAt: null
      };
    });
    if (cards.length) cards[0].state = 'practice';

    return {
      v: 1,
      createdAt: opts.now || Date.now(),
      targets: (summary.targets || []).slice(),
      cards: cards,
      usedIds: (opts.usedIds || []).slice()
    };
  }

  function clone(plan) { return JSON.parse(JSON.stringify(plan)); }
  function cardIndex(plan, topicId) {
    for (var i = 0; i < plan.cards.length; i++) if (plan.cards[i].topicId === topicId) return i;
    return -1;
  }
  function unlockNext(plan, idx) {
    if (idx + 1 < plan.cards.length) {
      plan.cards[idx + 1].unlocked = true;
      if (plan.cards[idx + 1].state === 'locked') plan.cards[idx + 1].state = 'practice';
    }
  }

  function startPractice(plan, topicId) {
    var next = clone(plan);
    var i = cardIndex(next, topicId);
    if (i < 0) return plan;
    var c = next.cards[i];
    if (!c.unlocked || c.state === 'mastered') return plan;
    c.state = 'practice'; c.phase = 'practice'; c.cursor = 0; c.wrongs = 0;
    return next;
  }

  function nextItem(graph, plan, topicId) {
    var i = cardIndex(plan, topicId);
    if (i < 0) return null;
    var c = plan.cards[i];
    if (c.state !== 'practice' && c.state !== 'retest' && c.state !== 'help') return null;
    var list = c.phase === 'retest' ? c.retest : c.practice;
    var qid = list[c.cursor];
    if (!qid) return null;
    var q = null;
    (graph.bank[topicId] || []).forEach(function (x) { if (x.id === qid) q = x; });
    return q ? { phase: c.phase, question: q, index: c.cursor, total: list.length } : null;
  }

  function markUsed(plan, qid) {
    if (plan.usedIds.indexOf(qid) === -1) plan.usedIds.push(qid);
  }

  /**
   * 记录当前题判定。返回新 plan；上层可据此刷新 UI。
   * 练习规则：cursor 走完前，错一题计 wrongs 且进入 help（讲解后再继续）；
   *           列表走完无错 → 进入复测；题量不足且已走完 → shortfall（由上层补变式）。
   * 复测规则：错一题立刻回到练习；全部答对 → 掌握。
   */
  function applyAnswer(graph, plan, topicId, verdict, now) {
    var next = clone(plan);
    var i = cardIndex(next, topicId);
    if (i < 0) return plan;
    var c = next.cards[i];
    if (c.state !== 'practice' && c.state !== 'retest' && c.state !== 'help') return plan;
    var list = c.phase === 'retest' ? c.retest : c.practice;
    var qid = list[c.cursor];
    if (!qid) return plan;
    markUsed(next, qid);
    now = now || Date.now();

    if (c.phase === 'practice') {
      if (verdict === 'wrong' || verdict === 'skip') {
        c.wrongs += 1;
        c.cursor += 1;
        c.state = 'help';  // 等讲解；讲解结束由 resumeAfterHelp 推进
        if (!list[c.cursor] && c.practiceShortfall) c.state = 'shortfall';
        return next;
      }
      // correct
      c.cursor += 1;
      if (c.cursor >= list.length) {
        if (c.wrongs === 0 && c.retest.length) { c.phase = 'retest'; c.cursor = 0; c.state = 'retest'; }
        else if (!c.retest.length) { c.state = 'shortfall'; } // 没有复测题，需要补题
        else { c.phase = 'retest'; c.cursor = 0; c.state = 'retest'; }
      } else {
        c.state = 'practice';
      }
      return next;
    }

    // retest
    if (verdict === 'wrong' || verdict === 'skip') {
      c.phase = 'practice'; c.cursor = 0; c.state = 'practice'; c.wrongs += 1;
      return next;
    }
    c.cursor += 1;
    if (c.cursor >= list.length) {
      c.state = 'mastered';
      c.masteredAt = now;
      c.reviewStep = 0;
      c.reviewDueAt = now + REVIEW_INTERVALS_MS[0];
      unlockNext(next, i);
    }
    return next;
  }

  // 讲解完成：回到练习继续下一题；已无剩余题则视练习阶段结束
  function resumeAfterHelp(plan, topicId) {
    var next = clone(plan);
    var i = cardIndex(next, topicId);
    if (i < 0) return plan;
    var c = next.cards[i];
    if (c.state !== 'help') return plan;
    if (c.cursor >= c.practice.length) {
      // 讲完但练习题已耗尽：有错历史时需要补题才能确认，交给上层（shortfall）
      c.state = c.practiceShortfall ? 'shortfall' : 'practice';
      if (c.state === 'practice' && c.wrongs === 0 && c.retest.length) { c.phase = 'retest'; c.cursor = 0; c.state = 'retest'; }
      return next;
    }
    c.state = 'practice';
    return next;
  }

  // 上层补到变式题后注入（AI 出题/扩题批次），追加到当前阶段列表末尾
  function addVariant(plan, topicId, phase, questions) {
    var next = clone(plan);
    var i = cardIndex(next, topicId);
    if (i < 0) return plan;
    var c = next.cards[i];
    var list = phase === 'retest' ? c.retest : c.practice;
    questions.forEach(function (qq) {
      if (list.indexOf(qq.id) === -1) list.push(qq.id);
      if (phase === 'practice') c.practiceShortfall = false;
      else c.retestShortfall = false;
    });
    if (c.state === 'shortfall') {
      if (phase === 'retest') { c.phase = 'retest'; c.cursor = 0; c.state = 'retest'; }
      else { c.phase = 'practice'; c.state = 'practice'; }
    }
    return next;
  }

  function dueReviews(plan, now) {
    return plan.cards
      .filter(function (c) { return c.state === 'mastered' && c.reviewDueAt !== null && c.reviewDueAt <= now; })
      .map(function (c) { return c.topicId; });
  }

  // 复习出题：选该点没做过的题（优先 standard/basic），不改变 plan。
  // 返回 question 对象数组；题库耗尽时返回空数组（上层提示稍后再来）。
  function reviewItems(graph, plan, topicId, count) {
    var card = null;
    for (var i = 0; i < plan.cards.length; i++) {
      if (plan.cards[i].topicId === topicId) { card = plan.cards[i]; break; }
    }
    if (!card || card.state !== 'mastered') return [];
    var want = count || 2;
    var used = {};
    plan.usedIds.forEach(function (id) { used[id] = true; });
    var pool = (graph.bank[topicId] || []).filter(function (q) { return !used[q.id]; });
    var rank = function (q) { return q.difficulty === 'standard' ? 0 : q.difficulty === 'basic' ? 1 : 2; };
    pool.sort(function (a, b) { return rank(a) - rank(b); });
    return pool.slice(0, want);
  }

  // 复习判定：通过推进下一档间隔；最后一档通过后保持 15 天循环；失败打回练习
  function applyReview(plan, topicId, passed, now) {
    var next = clone(plan);
    var i = cardIndex(next, topicId);
    if (i < 0) return plan;
    var c = next.cards[i];
    if (c.state !== 'mastered') return plan;
    now = now || Date.now();
    if (passed) {
      c.reviewStep = Math.min(c.reviewStep + 1, REVIEW_INTERVALS_MS.length - 1);
      c.reviewDueAt = now + REVIEW_INTERVALS_MS[c.reviewStep];
    } else {
      c.phase = 'practice'; c.cursor = 0; c.state = 'practice'; c.reviewDueAt = null;
    }
    return next;
  }

  function progress(plan) {
    var total = plan.cards.length;
    var done = plan.cards.filter(function (c) { return c.state === 'mastered'; }).length;
    return { total: total, mastered: done, percent: total ? Math.round(done / total * 100) : 100 };
  }

  return {
    REVIEW_INTERVALS_MS: REVIEW_INTERVALS_MS,
    createPlan: createPlan,
    startPractice: startPractice,
    nextItem: nextItem,
    applyAnswer: applyAnswer,
    resumeAfterHelp: resumeAfterHelp,
    addVariant: addVariant,
    dueReviews: dueReviews,
    reviewItems: reviewItems,
    applyReview: applyReview,
    progress: progress
  };
});
