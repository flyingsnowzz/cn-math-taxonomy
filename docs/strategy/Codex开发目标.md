# Codex 开发目标（方向 A · C 端闭环）

> 本文是 [方向A-C端闭环详细规划](方向A-C端闭环详细规划.md) 的**工程落地层**。
>
> - 规划文档里的 M0–M4 是**产品里程碑**（混合业务/运营/工程，粒度按周），不能直接派给 Codex。
> - 本文把里程碑拆成**任务（Task）**：每个任务有独立写范围、数据契约、验收条件和验证命令，一个任务对应一次 Codex 开发会话。
>
> **使用方式**：每次开会话只领一个任务（如「执行 T0.2」），完成后跑该任务的「验证」，全绿才算完。任务之间有依赖，必须按编号顺序。

## 0. 工程现状与全局规则（每次会话必读）

### 技术栈与目录（`web/`）

- Vue 3 + TypeScript + Vite + Pinia + Tailwind；路由在 `src/router/index.ts`；页面在 `src/pages/`；通用组件在 `src/components/base/`（`BaseButton/BaseCard/BaseBadge...`，新 UI 必须复用，不另造样式体系）。
- 零依赖 JS 引擎以 vendored 副本形式存在：根目录 `diagnose/engine.js` → `web/src/engine/legacy/diagEngine.js` + `diagEngine.d.ts`，TS 侧只通过 `src/engine/engineAdapter.ts` 调用，页面/Store 不直接 import legacy。
- 数据走 `src/data/dataClient.ts`（学科包 + 题库），Pinia 典型参考 `src/stores/diagnose.ts`；本地存储只用 `src/utils/storage.ts` 的 `readJson/writeJson/remove`。
- 测试：web 内 `npm test`（vitest）、`npm run typecheck`、`npm run lint`；根目录纯 JS 用 `node tests/test_*.js`；端到端 `npm run test:e2e`（playwright，spec 在 `web/e2e/`）。

### 硬性规则

1. **M0/M1 阶段零后端**：不新增服务端、不引入账号与网络请求（AI 讲解在 M2，账号支付在 M3）。进度全部存 localStorage。
2. **判题不重写**：所有判定走 `engineAdapter` 的 `judgeAnswer/judgeQuestion`，remediation 只接收 `correct|wrong|skip`。
3. **纯逻辑不进 Vue 组件**：状态机逻辑放 `remediation.js`（根目录单一事实源，Node 测试），web 侧 vendored 副本必须与根目录逐字节一致；TS 只包一层 adapter 和 store。
4. **存储键版本化**：新键统一 `cnmRemedy.*.v1`，带 `v` 字段和类型守卫，风格对齐 `blindspots.ts` 的 `cnmBlind.local.v1`。
5. **中文 UI**，移动端优先（现有站点主要在手机上用）；不引入新的重型依赖（图片导出等优先用已有 `src/share/shareCard.ts` 的方案）。
6. **不破坏既有门**：每次任务结束前，根目录 `node tests/test_engine.js tests/test_remediation.js tests/test_blindspots.js tests/test_children.js` 与 web 的 `npm run typecheck && npm test` 必须全绿；改动页面的任务要更新/新增对应 e2e。
7. **不提交 `web/` 里与任务无关的既有未提交改动**；每个任务的 commit 只含本任务文件。

### remediation 状态机（T0.x 的领域语言）

```
locked → practice ⇄ help（答错挂起，讲解/看解析后 resume）→ retest → mastered
                      practice/retest 题不足 → shortfall（addVariant 补题，禁止重复出题）
mastered 后：reviewDueAt 到期 → 复习通过推进 1/3/7/15 天，失败打回 practice
```

---

## M0：纯前端闭环（对应产品里程碑 M0，第 1–2 周）

> 目标：学生从诊断结果页一路做到「薄弱点复测通过」，全程不离开网页、无后端。

### T0.1 ✅ 已完成（2026-11-02）
把 remediation 接入 web 工程（基础设施）

- 背景：`diagnose/remediation.js` 与 `tests/test_remediation.js` 已在根目录存在并通过；web 工程还看不到它。
- 写范围：
  - `web/scripts/sync-legacy.mjs`（新增）：把根目录 `diagnose/remediation.js` 复制为 `web/src/engine/legacy/remediation.js`；同时校验 `web/src/engine/legacy/diagEngine.js` 与根目录 `diagnose/engine.js` 的差异只允许出现在白名单注释里（若当前差异较大，本任务只复制 remediation，并在脚本里对 remediation 做逐字节一致断言）。
  - `package.json`：`predev`/`prebuild` 之前挂 `node scripts/sync-legacy.mjs`（保证副本不漂移）。
  - `web/src/engine/legacy/remediation.d.ts`（新增）：为 remediation 全部导出补类型（`RemedyPlan/RemedyCard/RemedyItem` 等，题目类型复用 `@/data/types` 的 `Question`）。
  - `web/src/engine/remediationAdapter.ts`（新增）：薄封装，签名风格对齐 `engineAdapter.ts`，导出 `createPlan/startPractice/nextItem/applyAnswer/resumeAfterHelp/addVariant/dueReviews/applyReview/progress`。
- 验收：
  - 删除 vendored 副本后跑 `npm run dev` 构建链能自动重建，且副本与根文件一致；
  - `vue-tsc` 下 adapter 有完整类型，无 `any` 逃逸（legacy 文件本身除外）。
- 验证：`node scripts/sync-legacy.mjs`、`npm run typecheck`、根目录 `node tests/test_remediation.js`。
- 依赖：无（可第一个开工）。

### T0.2 ✅ 已完成（2026-11-02）
remediation Pinia store + 本地持久化

- 写范围：`web/src/stores/remediation.ts`（新增）、`web/src/stores/__tests__/remediation.test.ts`（新增）。
- 契约：
  - state：当前学科 `graph` 引用、`plan: RemedyPlan | null`、当前卡 id；按学科存 localStorage（键 `cnmRemedy.plan.{subject}.v1`），结构 `{v:1, subject, plan, savedAt}`，带类型守卫，坏数据回退为空。
  - actions：`startFromSummary(graph, summary, usedQuestionIds, subject)`（用诊断 store 的 summary + `session.answers` 里的 qid 建 plan 并落盘）、`answerCurrent(verdict)`、`resumeHelp()`、`selectCard(id)`、`reset()`。
  - getters：`cards`（带知识点名称/章节，join `graph.topics`）、`currentCard`、`progress`（透传 `Remediation.progress`）、`dueReviews`。
  - 卡片掌握（state 变 mastered）时，同步写一条结果到现有盲区汇总（复用 `blindspots.ts` 的写入路径，状态记为「已补上」，不改变其既有数据结构，只允许新增字段并向后兼容）。
- 验收：刷新页面计划不丢；对同一份 summary 重复 `startFromSummary` 生成相同 plan（种子固定用诊断 session 的 seed）；store 单测覆盖「建卡/答题推进/复测通过解锁下一张/持久化读写」。
- 验证：`npm test -- remediation`、`npm run typecheck`。
- 依赖：T0.1。

### T0.3 ✅ 已完成（2026-11-02）
诊断结果页「开始补救」入口

- 写范围：`web/src/pages/DiagnosePage.vue`（只改 summary 区，约在「建议学习路径」标题附近）、`src/router/index.ts`（新增 `/remedy/` 路由，meta 标题「补救计划」）。
- 行为：summary 存在且 `weak/shaky` 非空时，路径区下方显示主按钮「开始补救（N 个薄弱点）」；点击 → `remediation.startFromSummary(graph, summary, 已做题 id 列表, subject)` → 跳转 `/remedy/`。无薄弱点时显示「本次未发现薄弱点」不显示按钮。
- 注意：诊断 demo 模式（URL 带 demo）不自动建计划，必须用户点击。
- 验收：手动/单测验证按钮数量等于 summary.path 中 weak+shaky 数；e2e 覆盖「诊断完成 → 点击 → 跳转」。
- 依赖：T0.2。

### T0.4 ✅ 已完成（2026-11-02）
补救计划页（任务卡列表）

- 写范围：`web/src/pages/RemedyPage.vue`（新增）、`web/src/components/remedy/RemedyCard.vue`（新增）。
- 行为：
  - 卡片按 plan 顺序列出：知识点名、章节、根因/目标标记（复用 `BaseBadge`）、状态（待补/学习中/待复测/已掌握）、进度条（`progress()`）；
  - 未解锁卡置灰；当前可练卡显示「开始/继续」，点击进入答题（T0.5 路由 `/remedy/practice/:topicId`，本任务可先占位）；
  - 顶部显示总进度「已补上 x/y」；空计划态引导回诊断。
- 验收：vitest 挂载测试覆盖锁定/解锁/完成三态；移动端窄屏（375px）布局不溢出。
- 依赖：T0.3。

### T0.5 ✅ 已完成（2026-11-02）
练习/复测答题流（闭环主体）

- 写范围：`web/src/pages/RemedyPracticePage.vue`（新增）、必要的小题组件放 `web/src/components/remedy/`。
- 行为（严格映射 remediation 状态机，不发明新状态）：
  - 出题/渲染：复用诊断页的题型渲染与判题交互（选择题、numeric、verify 表达式判定），答完调用 `store.answerCurrent`；
  - practice 中答错 → card 进入 `help`：展示该题解析（question.explanation）与「我看懂了，继续」→ `resumeHelp()`；本任务**不接 AI**；
  - 练习无错走完 → 自动进入 retest，UI 标注「复测」；复测全对 → mastered → 展示「已补上」庆祝态并露出下一张卡入口；复测错 → 回练习，提示「还需要再练」；
  - `shortfall`（题库不足）：显示「本题库练习即将补充」，允许用当前已有题继续/返回计划页（不允许重复出题），并在本地记录该 topicId（供 M2 扩题优先级用，键 `cnmRemedy.shortfall.v1`）。
- 验收：以数学 `cnm_221` 配方法为脚本化场景，e2e 走通「练习全对→复测通过→第二张卡解锁」；再造一个答错场景覆盖 help→继续→复测失败→回练习。
- 验证：`npm run test:e2e -- remedy`（新增 spec `web/e2e/remedy-flow.spec.ts`）+ typecheck + vitest。
- 依赖：T0.4。

### T0.6 ✅ 已完成（2026-11-02）
回归、走查与旧站入口收口

- 写范围：必要时调整 `web/src/pages/HomePage.vue`（增加「查漏补缺 → 诊断」入口卡片，仅链接，无新逻辑）、PWA 缓存清单（`scripts/generate-sw.mjs` 相关流程若需要）。
- 行为：首页能进入诊断 → 补救全链路；离线（PWA）下闭环可用（数据本就本地）。
- 验收：`web/e2e` 全量通过；按 docs 里的配方法 demo URL 在手机视口手工走查一遍；根目录四个 node 测试全绿。
- 依赖：T0.5。

**M0 完成定义**：~~T0.1–T0.6 全绿~~ **已达成（2026-11-02）**；`docs/strategy/方向A-C端闭环详细规划.md` 的 M0 验收句（学生不离开网页完成复测通过）有对应 e2e 证明。

---

## M1：报告、复习、传播（第 3–5 周）

> 目标：产生可分享的提分证据和回流闭环；仍无后端。

### T1.1 ✅ 已完成（2026-11-02）
家长报告页

- 新增 `web/src/pages/RemedyReportPage.vue` + 路由 `/remedy/report`：测了什么（目标/章节）、根因数、已补上数与名称、学习路径缩略、用时题量（从 plan/session 派生）、未完成项。
- 数据契约：报告从「诊断 session + remediation plan」组合生成一个纯函数 `buildReport(session, plan)`（放 `src/engine/report.ts` 并配 vitest），页面只渲染，便于以后导出与分享复用。
- 验收：单测覆盖全掌握/部分掌握/零完成三种输入；报告无学员真名以外的隐私字段。

### T1.2 ✅ 已完成（2026-11-02）
报告图片导出与分享

- 扩展 `src/share/shareCard.ts`：生成报告长图（沿用其现有 canvas/绘制方案，不引新库），底部固定品牌区 + 当前站点 URL + 带参数的直达链接（`/diagnose/?target=...` 风格，复用现有 query 解析）。
- 验收：导出图在 2x 屏不糊；链接在无痕窗口可打开报告的**公开摘要版**（只含非敏感的学科/章节/进度，不含昵称）。

### T1.3 ✅ 已完成（2026-11-02）
间隔复习与「今日复习」

- store 增加复习队列（透传 `dueReviews(plan, Date.now())`，按学科聚合）；首页与补救页顶部显示「今日复习 N 题」；复习用该点未做过的题出 1–2 题，结果走 `applyReview`。
- 验收：用 vitest 的假时钟覆盖 1/3/7/15 天推进与失败打回；到期复习在首页出现。

### T1.4 ✅ 已完成（2026-11-02）
本地漏斗埋点

- 新增极简埋点模块 `src/utils/track.ts`：事件先存 localStorage 数组（键 `cnmTrack.v1`，限长 1000 条），六步事件：diagnose_start/diagnose_done、practice_start/practice_done、help_view、retest_pass、report_share。M3 接后端时只换 transport。
- 验收：单测验证限长与字段；e2e 中关键步骤后能读到事件。

### T1.5 ✅ 已完成（2026-11-02）
种子用户灰度配置

- 一个本地/URL 开关（`?remedy=1` 或已默认开）控制入口可见性，便于灰度与回滚；默认在 M1 末对数学高中开放。
- 验收：关闭时站点行为与现状一致，既有 e2e 不需要改。

---

## M2：AI 讲解与扩题（第 6–10 周，开工前细化任务书）

只列目标，不预设实现任务（依赖 M0/M1 真实数据）：

- T2.x 讲解代理（**M2 第一个任务才允许引入后端**）：服务端只做模型密钥中转与内容安全；提示词由知识点 `description + mastery_criteria + 错题解析 + 直接先修` 拼装，先补先修再讲题，末尾必返回一道跟练题（题目 id 必须来自题库或合规生成并过 verify）。
- T2.x help 状态接入讲解：`resumeHelp` 前展示讲解，讲解质量反馈（有用/没用）进埋点。
- T2.x 扩题流水线：用 `cnmRemedy.shortfall.v1` 与诊断高频 weak 根因确定 Top 50 点，沿用仓库两轮审校方式扩到每点 10–12 题；扩题后 `scripts/quality_report.py` 指标不退化。
- 决策门复算：被讲解点的复测通过率 vs 无讲解，无显著提升则按规划降级为解析+变式。

## M3：账号、云存、支付（第 11–14 周，开工前细化任务书）

- T3.x 登录与会话云同步（本地存储成为缓存，冲突按 savedAt 最后写入）；T3.x 扫码支付与会员权益拦截（免费边界严格按规划文档 §5.1）；T3.x 埋点 transport 切到服务端；T3.x 公众号落地页与分享承接。

---

## 每个任务的完成清单（Codex 自查）

1. 只动了任务「写范围」里的文件；发现范围外必须改的东西，先停下来说明。
2. 新增纯逻辑都有自动化测试（根目录 node 测试或 web vitest），不是只靠手点。
3. 跑通任务「验证」命令 + 全局门：根目录 4 个 node 测试、web `typecheck`、`vitest run`；改了页面就有/更新 e2e。
4. 用户可见文案中文、移动端可用；不引入规划之外的第三方服务。
5. 收尾说明：改了什么、为什么、怎么验的、残留问题（尤其 shortfall、manual 判题这类已知边界）。
