# 数据云端化 Codex 开发任务书：账号主档、离线缓存与学习数据完整性

> 日期：2026-11-03。本文是 [M3工程方案](M3工程方案.md) 与 [M3-Codex开发任务](M3-Codex开发任务.md) 的数据层后续任务书。
>
> 目标不是取消 localStorage，而是形成 **“登录账号的云端主档 + 本地离线缓存 + 匿名本地模式”**。一次会话只领取一个任务，按 D0 → D5 顺序执行；每个任务必须独立验证、独立收尾。

## 0. 背景与当前事实

截至 2026-11-02 的开发库核查：

- 已有 1 个测试用户、1 个有效 refresh token、1 条已使用短信验证码和限流记录。
- `entitlements`、`sync_blobs`、`events`、`user_identities` 均为 0；学习数据仍主要在 localStorage。
- 开发库只应用了 `001_init.sql`、`002_refresh_tokens.sql`，代码中的 `003_events_client_at.sql` 尚未应用。
- T3.5 已写五类同步代码，但“有代码”不等于“真实学习数据已端到端入云”。
- T3.6 已有埋点 transport；当前只要求登录后上报，匿名事件仍留本地。
- 诊断 session 与已见题目明确不在当前同步白名单中。

### 当前 localStorage 分类

| 数据键 | 内容 | 云端目标 |
|---|---|---|
| `cnmRemedy.plan.{subject}.v1` | 补救计划、答题状态、掌握情况、复测/复习时间 | 账号云同步 |
| `cnmRemedy.shortfall.v1` | 题量不足知识点 | 账号云同步 |
| `cnmBlind.local.v1` | 薄弱点、根因、错误次数、最近表现 | 账号云同步 |
| `cnmChildren.v1` | 孩子档案、当前孩子 | 账号云同步 |
| `cnmChildren.records.v1` | 每个孩子的诊断历史 | 账号云同步 |
| `*Diagnose.session.*` | 未完成诊断、目标、逐题答案、进度 | 新增同步，按孩子与学科隔离 |
| `cnmDiagnose.seen.v1` | 已见题目 | 新增同步或从答题事实派生 |
| `cnmTrack.v1` | 行为事件与待上报队列 | 已上传事实进入 `events`；本地只承担缓存/重试 |
| `cnmVideo.custom.v1` | 本机视频预览映射 | 不做用户同步；正式内容另走内容管理 |
| `cnmAuth.v1` | access/refresh token 与用户摘要 | **只存本地，永不同步** |
| `cnmDevice.v1` | 匿名设备 ID | 只存本地，上报时作为字段携带 |
| `cnmSync.meta.v1` | 本地更新时间、dirty/重试状态 | 只存本地 |
| `cnmFeature.remedy.v1`、PWA、探索深度等 | 设备/界面偏好 | 只存本地，除非以后明确做偏好同步 |
| `cnmStats.v1` | 旧版本地访问统计 | 不同步计数器，逐步由服务端事件替代 |

## 1. 全局数据契约（每个任务必读）

### 1.1 三种数据角色

1. **云端主档**：登录用户需要跨设备恢复的学习档案、孩子档案、权益和事实事件。
2. **本地缓存**：云端主档在本机的副本，支撑离线与快速启动；不是另一份互不相干的数据。
3. **设备私有数据**：token、设备 ID、同步游标、PWA/界面偏好，不进入云同步。

### 1.2 本地命名空间与云端逻辑键

D1 后，本地物理键必须区分匿名与账号：

```text
匿名：cnmAnon.<legacyKey>
账号：cnmUser.<userId>.<legacyKey>
```

- 云端 `sync_blobs` 已有 `user_id` 隔离，**云端逻辑键继续用 legacyKey**，不重复嵌入 userId。
- storage/sync adapter 负责“本地物理键 ↔ 云端逻辑键”映射；业务 store 不直接拼接用户 ID。
- 旧固定键只允许由迁移层读取；迁移完成后不得继续双写。
- `cnmAuth.v1`、`cnmDevice.v1`、`cnmSync.meta.v1` 不套用该同步命名空间。

### 1.3 孩子维度

D2 后，新产生的诊断、练习、复习、盲区数据必须携带：

```text
childId + subject
```

服务端通过认证确定 `userId`，客户端不得用请求里的 userId 越权写其他账号。云端数据至少能追溯到：

```text
user_id（表字段/认证）→ childId（JSON 或事实 payload）→ subject → topic/session/attempt
```

### 1.4 离线与合并原则

- 离线作答不得被登录、刷新或同步失败阻断。
- 当前状态快照可用 LWW；可追加的事实优先按稳定 ID 去重合并，不能简单整数组覆盖。
- `seen` 采用集合并集并设置上限；不能用整键 LWW 导致另一台设备的已见题目丢失。
- 同一活跃诊断 session 的答案按 `attemptId` 去重合并；不同 session 不拼成同一份答题记录。
- 同步时间继续使用客户端毫秒 `updatedAt`，服务端另记 `server_at`；服务端不信任客户端提供的 userId。

### 1.5 隐私与最小化

- 不同步 access token、refresh token 原文、同步游标和界面偏好。
- 学习事实默认记录题目/知识点 ID、结果和时间；**不默认上传学生自由文本答案**。
- 孩子只保留产品必要的昵称、年级、教材，不新增学校、生日等敏感字段。
- 埋点与日志不得记录 JWT、refresh token、管理密码或完整认证头。

### 1.6 每个任务的统一验证门

```bash
cd server && npm test && npm run build
cd web && npm run typecheck && npm test && npm run build
cd web && npx playwright test
```

- 连库集成测试必须使用真实 PostgreSQL，不得只用 mock 代替。
- 前端跨设备/离线验收可用 Playwright route mock 网络，但至少一个后端集成测试必须验证数据库隔离与持久化。
- 若全量 e2e 出现失败，必须区分本任务回归与已有时序波动；不能用“单测通过”替代失败说明。
- commit 只含本任务文件，不提交 `.env*`、`node_modules`、`dist`、真实用户数据或密钥。

---

## D0 ☐ 基线恢复：让现有五类同步和埋点真正可验证

**目标**：先证明当前实现的真实状态，修复开发库迁移落后，建立五类学习数据入云的基线证据；不在本任务扩展新数据类型。

**依赖**：T3.5、T3.6。

**写范围**：

- `server/src/db/migrations/`：仅当确认迁移执行机制有缺陷时修复；已发布 SQL 不改写。
- `server/src/db/migrate.ts`、`server/docker-compose.yml`：仅在迁移未自动执行时修改。
- `web/src/sync/`、`web/src/stores/{remediation,blindspots,children}.ts`、`web/src/children/legacy/children.js`：只修阻断现有五类同步的真实缺陷。
- `web/src/utils/track.ts`：只修阻断已登录上报的真实缺陷。
- `server/test/integration/`、`web/src/sync/__tests__/`、`web/e2e/`：新增 D0 专项测试。

**实施要求**：

1. 重建/重启本地 API，确认 `schema_migrations` 包含 `003_events_client_at.sql`，`events.client_at` 存在。
2. 对五类既有键逐项造一条非空数据，验证 `POST /sync` 后 `sync_blobs` 确有对应记录，而不是只返回 200。
3. 验证第二客户端 `GET /sync` 能读回相同逻辑数据；不同 user_id 读不到彼此数据。
4. 登录后产生一条事件，验证 `events` 有 `user_id/client_uid/name/payload/client_at`；重复 uid 不新增。
5. 记录迁移前匿名数据、未登录零请求、同步失败仍保留本地三个边界。

**验收**：

- 五类同步键都有真实数据库证据，不再以“当前为 0”收尾。
- 数据库迁移版本与服务启动流程一致， fresh database 与既有 database 都能执行。
- 离线/失败时本地数据不丢，恢复后补传成功。

**验证证据**：迁移列表、五类 `sync_blobs` 行数与键清单、事件去重查询、对应自动化测试结果。

---

## D1 ☐ 账号缓存隔离与匿名数据首次合并

**目标**：消除同一浏览器切换账号时 A 数据进入 B 账号的风险；匿名功能保持可用，首次登录合并行为可预测。

**依赖**：D0。

**写范围**：

- `web/src/utils/storage.ts`：新增命名空间/legacy 键迁移能力，保持旧调用可渐进迁移。
- `web/src/sync/`：本地物理键与云端逻辑键映射、账号切换、匿名首次合并。
- `web/src/stores/auth.ts`：登录、登出、账号切换时调用明确生命周期钩子。
- 五类已同步 store/legacy children：改为通过统一 storage adapter 读写。
- `web/src/stores/__tests__/`、`web/src/sync/__tests__/`、`web/e2e/`：账号隔离与合并测试。

**实施要求**：

1. 匿名数据使用 `cnmAnon.*`，登录后使用 `cnmUser.<userId>.*`；token 键保持设备私有。
2. 登录时先拉取目标账号云端主档，再按各键既有合并策略处理匿名数据；不得先整包覆盖云端。
3. 账号 A → 退出 → 账号 B：B 只能看到匿名公共空间与 B 自己的数据，不能看到 A 的命名空间。
4. 登出只清认证会话和启用状态，不把 A 的缓存暴露给匿名页或 B；是否保留 A 的加密/命名空间缓存可后续优化，本任务先保证隔离。
5. 匿名首次合并成功后标记迁移版本，刷新/重复登录不得重复制造记录。
6. 合并失败保留匿名原始数据，允许重试，不得因部分成功丢弃整个本地副本。

**验收**：

- 自动测试证明 A 的计划/档案不会出现在 B。
- 匿名完成诊断后登录，匿名数据与账号原数据按策略合并，刷新不重复。
- 未登录诊断、练习、档案流程零降级、零 `/sync` 请求。

---

## D2 ☐ 孩子维度数据归属与旧数据迁移

**目标**：所有新学习数据都归属于明确孩子；修复多学科、多孩子档案下诊断/练习/复习可能混用的问题。

**依赖**：D1。

**写范围**：

- `web/src/stores/{children,diagnose,remediation,blindspots}.ts`。
- `web/src/children/legacy/children.js` 与孩子选择/迁移提示所需页面组件。
- `web/src/engine/`：只在持久化结构需要 childId 时修改类型/适配层，不改判题算法。
- `web/src/sync/`、 `server/src/routes/sync.ts`：新逻辑键/结构校验。
- 对应 vitest、server integration、Playwright。

**实施要求**：

1. 新诊断 session、补救 plan、盲区条目和复习记录写入 `childId`；孩子档案 records 继续按 childId 关联。
2. 无当前孩子时沿用现有匿名单档案体验，但写入前必须采用明确的默认归属规则，不能随机选孩子。
3. 旧无 childId 数据：
   - 只有 1 个孩子时可迁移到该孩子并记录迁移版本；
   - 0 个或多个孩子时不得擅自全部归属某一个，提供选择/未分配状态；
   - `cnmChildren.records.v1` 已有孩子分组的保持原关联。
4. 删除孩子前必须说明其学习数据处理；本任务不隐式把记录转给另一个孩子。
5. 云端仍按 user_id 隔离，childId 不作为越权边界；服务端需拒绝结构非法或 childId 类型错误的 blob。

**验收**：

- 同一账号两个孩子分别诊断/练习，计划、盲区、历史与复习队列不混用。
- 切换孩子不会改写另一个孩子的进度；换设备后归属保持一致。
- 旧数据迁移可重复执行且不重复、不串孩子。

---

## D3 ☐ 诊断会话与已见题目跨设备同步

**目标**：一台设备做一半的诊断，另一台设备能按同一孩子、同学科继续；已见题目集合不丢失。

**依赖**：D2。

**写范围**：

- `web/src/stores/diagnose.ts`：所有 `persist()`、答案写入、清理和 `seen` 写入点接同步。
- `web/src/sync/{engine,merge}.ts`：诊断键白名单、拉取键枚举、合并策略。
- `server/src/routes/sync.ts`：对应云端逻辑键白名单与大小校验。
- `web/src/stores/__tests__/`、`web/src/sync/__tests__/`、`server/test/integration/sync.test.ts`、`web/e2e/`。

**数据契约**：

1. 统一新 session 逻辑键，包含 childId 与 subject；八学科旧 key 只由迁移层读取。
2. session 至少保存 `schemaVersion/sessionId/childId/subject/mode/targets/answers/seed/savedAt`，旧字段兼容见现有 `DiagnosticSavedSession`。
3. `seen` 按孩子与学科保存，集合并集合并；若改为由事实派生，必须保证离线时仍可重建，二选一，不维护两份互相打架的主档。
4. 同 sessionId 的答案按稳定 `attemptId` 去重合并；不同 sessionId 不得合并答案，活跃快照按明确时间策略选择。
5. 清除诊断是显式动作，不能被“远端没有这条键”误当成清除；删除语义若需要另加 tombstone。

**验收**：

- A 设备答 2 题，B 设备拉取后从同一进度继续，答案与目标一致。
- 两台设备分别见过的题目合并后不重复出题；离线恢复后仍成立。
- 两个孩子的同学科 session 完全隔离；旧八学科 key 能迁移。
- 大于 256KB 的异常会话有明确限制/降载策略，不静默截断答案。

---

## D4 ☐ 学习事实事件：保留可分析的答题与复习证据

**目标**：快照解决“现在是什么状态”，事实事件解决“发生过什么”；为学习分析、复测效果和以后详细报告保留可靠证据。

**依赖**：D2；可与 D3 并行规划，但合入顺序在 D3 后。

**写范围**：

- `web/src/utils/track.ts`：事件类型、payload 与本地重试。
- `web/src/stores/{diagnose,remediation}.ts`：只在最终判题/复测/复习结果确定后记录事实，避免重复发。
- `server/src/routes/track.ts`：事件白名单与 payload 校验。
- `server/src/db/migrations/`：只有 events 结构无法支撑查询需求时才新增迁移，不改旧迁移。
- `server/test/integration/track.test.ts`、前端 vitest/e2e。

**最小事实结构**：

```json
{
  "uid": "客户端稳定 attemptId",
  "name": "question_attempted | review_completed",
  "payload": {
    "childId": "c...",
    "subject": "math",
    "sessionId": "...",
    "topicId": "...",
    "questionId": "...",
    "verdict": "correct | wrong | skipped",
    "attempt": 1
  },
  "clientAt": "ISO-8601"
}
```

**实施要求**：

1. 只在引擎结果确定后写一次事实；React/Vue 重渲染、页面刷新、失败重试不得制造两条不同 uid 的事实。
2. 服务端继续按 `client_uid` 去重，校验 childId/subject/topicId/questionId/verdict 等字段，拒绝非法事件而非静默写成可用事实。
3. 默认不上传学生自由文本答案；若后续确需保存，另立隐私与字段契约。
4. 登录前事实是否上传遵循 D1 的匿名合并策略；未合并前仍只存本地。
5. `cnmStats.v1` 不同步；新分析需求优先查询事实事件，而非累积本地计数器。

**验收**：

- 同一作答离线重试多次，数据库只有一条；不同作答不会因题目相同被错误去重。
- 事件能通过 user_id + childId + sessionId 还原一次学习过程。
- 页面刷新、断网恢复、重新登录不重复写入。

---

## D5 ☐ 数据边界登记、保留策略与最终端到端验收

**目标**：把“哪些上云、哪些只留本地”变成可测试的工程约束，并完成全链路验收；本任务不扩展会员实际功能，也不把 T3.8 部署伪装成本任务成果。

**依赖**：D0–D4。

**写范围**：

- `web/src/sync/`：统一的 `DO_NOT_SYNC`/键分类注册与防回归测试。
- `docs/strategy/数据规格书-v1.md`：补充用户数据版本、归属与迁移规则。
- `server/README.md`：迁移、同步、事件和本地开发验证说明。
- `web/e2e/`、 `server/test/integration/`：最终跨设备、离线、隔离场景。

**必须登记为设备私有**：`cnmAuth.v1`、`cnmDevice.v1`、`cnmSync.meta.v1`、PWA 提示、探索深度、灰度开关。

**内容配置决策**：

- `cnmVideo.custom.v1` 继续只作本机预览，不进入用户云同步。
- 正式视频映射若需要后台维护，另立 CMS/内容发布任务；不得借本任务把预览配置上传到学习数据库。
- 题库、知识图谱等静态内容仍由数据包发布，不复制成每个用户一份数据库记录。

**最终验收矩阵**：

| 场景 | 必须结果 |
|---|---|
| 未登录 | 全部本地流程可用，零同步请求 |
| 匿名首次登录 | 按明确策略合并，重复登录不重复 |
| A → B 换账号 | 无任何 A 学习数据泄漏到 B |
| 同账号两个孩子 | 诊断、练习、盲区、复习、事件不串孩子 |
| A 设备 → B 设备 | 五类旧数据、诊断 session、seen 均可恢复 |
| 离线 → 恢复 | 本地继续可用，快照和事实补传且不重复 |
| 刷新/重试 | 不丢答案、不重复事实、不重复迁移 |
| 数据边界 | token、设备偏好、预览视频配置从不上云 |

**收尾**：更新任务完成记录、实际测试数量、数据库证据和仍未解决边界；生产域名与外部资质验收仍归 T3.8。

---

## 执行顺序与领取方式

```text
D0 基线恢复
  → D1 账号隔离
  → D2 孩子归属
  → D3 诊断同步
  → D4 学习事实
  → D5 数据边界与总验收
```

每次只领取一个，例如 `/goal D0`。不要以“代码已经有同步”跳过 D0，也不要在 D1/D2 未完成前扩大云端数据范围。
