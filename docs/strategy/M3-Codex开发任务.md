# M3 Codex 开发任务书：账号、云同步、权益骨架

> 本文是 [M3工程方案](M3工程方案.md) 的工程落地层，与 [Codex开发目标](Codex开发目标.md) 中 M0/M1 同级。
>
> - 工程方案回答「用什么、接口长什么样」；本文回答「每个任务改哪些文件、怎么算做完、跑什么命令」。
> - **一次会话只领一个任务**，按编号顺序做；任务内写明的文件才能动。
> - 当前阶段**不接支付**；T3.0 已完成，从 T3.1 开始。

## 0. 全局约定（每次会话必读）

### 技术栈与目录

- 后端：`server/`，Node 20 + Express 4 + TypeScript(strict) + PostgreSQL 16，ESM（`"type":"module"`，import 路径写 `.js` 后缀，tsx 解析到 `.ts`）。
- 前端：`web/`，Vue3 + Pinia，已有 102 个 playwright e2e、44 个 vitest 不可破坏。
- 数据迁移：`server/src/db/migrations/NNN_xxx.sql`，文件名顺序执行一次，登记 `schema_migrations`；**已发布迁移不改写，只新增**。
- 外部能力走适配器（`src/adapters/`）：`mock`（开发/CI，零密钥）与 `tencent`（生产）；业务层只依赖 `adapters/types.ts`。
- 密钥只从环境变量读（见 `server/.env.example`），禁止写进代码或测试。

### 本地与测试环境

- `cd server && docker compose up -d --build` 起 API + PG（迁移自动执行）。
- 集成测试需要真实 PG：compose 额外把 PG 暴露到宿主 **127.0.0.1:5433**（避开本机 5432），测试用 `DATABASE_URL=postgres://cnm:cnm_dev_pw@127.0.0.1:5433/cnm_test`。
- 每个集成测试文件用独立事务或唯一数据前缀，结束清理；不依赖测试执行顺序。
- 纯逻辑（哈希、JWT、合并、校验）写不连库的单测；连库的放 `test/integration/`。

### 统一约定

- 响应信封：成功 `{...data}`；失败 `{ "error": { "code": string, "message": string } }`，HTTP 状态码语义化（400/401/403/404/409/429/500）。
- 时间：客户端用毫秒时间戳（number）；服务端落库 `TIMESTAMPTZ`。
- 手机号规范化：去空格/连字符，中国大陆 11 位 `^1\d{10}$`；非法返回 400 `invalid_phone`。
- 限流键写 `rate_limits`；写操作接口默认每 IP/账号有基本阈值，超限 429 `rate_limited`。
- 每个任务收尾必跑：后端 `npm test && npm run build`、前端改动则 `npm run typecheck && npm test`，并说明手工/自动验证证据。
- commit 只含本任务文件；不提交 `.env`、`node_modules`、`dist`。

### Token 策略（已定）

JWT(7天) + 刷新令牌：access token 无状态（`sub`=user_id，jose 签发）；refresh token 随机 32 字节存库（哈希后存，可旋转、可吊销）。会员过期/踢设备靠吊销 refresh 实现。

---

## T3.0 ✅ 服务骨架（已完成 2026-11-02）

Express+TS、PG 连接池与 7 张表迁移、mock 适配器、Dockerfile/compose、healthz、5 个单测。后续任务在其上扩展。

---

## T3.1 ✅ 账号基础设施：密码登录 + JWT + /me（已完成 2026-11-02）

**背景**：三种登录都归一到同一套 token 体系；先做不依赖外部服务的密码登录，打通 users 表、令牌中间件和当前用户接口。

**写范围（server/）**：

- `src/db/migrations/002_refresh_tokens.sql`（新增）：`refresh_tokens( token_hash TEXT PK, user_id BIGINT FK, user_agent TEXT, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at )`，索引 `(user_id)`。
- `src/services/crypto.ts`：scrypt 哈希/校验（`node:crypto`，参数固定写入结果串以便以后升级）、生成 token 的随机字节函数。
- `src/services/tokens.ts`：jose 签发/校验 access（7d，iss/aud 固定，读 `JWT_SECRET`），refresh 生成、哈希、落库、旋转（rotate 时旧 token `revoked_at` 置位）、吊销。
- `src/middleware/auth.ts`：解析 `Authorization: Bearer`，注入 `req.user = {id}`；`requireAuth` 守卫。
- `src/services/users.ts`：按手机号查/建用户、设置密码（已设置返回 409）、校验密码。
- `src/routes/auth.ts` + 在 `app.ts` 挂载 `/auth` 与 `/me`：
  - `POST /auth/password/login {account,password}` → `{accessToken, refreshToken, user}`，失败 401 `bad_credentials`，连续失败限流。
  - `POST /auth/refresh {refreshToken}` → 旋转出新令牌对。
  - `POST /auth/logout`（需登录）→ 吊销当前 refresh。
  - `POST /auth/password/set`（需登录）`{password}` → 设置/登录后补设密码。
  - `GET /me` → `{id, phone, nickname, entitlements:{member,expireAt,source}}`（无权益记录返回 member:false）。
- `src/middleware/validate.ts`：轻量请求体校验（手写或 zod，二选一；若引入 zod 写进 dependencies）。
- `test/crypto.test.ts`、`test/tokens.test.ts`（不连库）；`test/integration/password-auth.test.ts`（连 PG：注册设置密码→登录→/me→refresh 旋转→旧 refresh 失效→logout）。
- 集成测试环境：compose 增加仅宿主可见的 `127.0.0.1:5433:5432` 与一次性 `cnm_test` 库（在 README 写明 `createdb` 或 compose 初始化）。

**验收**：

- 错误密码 401；重复设密码 409；无 token 访问 /me 401；过期/伪造 access 401。
- refresh 旋转后旧 refresh 再用返回 401；logout 后 refresh 不可用。
- 密码不以明文/可逆形式落库；数据库里只见 scrypt 串。

**验证**：`docker compose up -d --build`；`DATABASE_URL=...5433/cnm_test npm test`；`npm run build`。

**依赖**：T3.0。

> **完成记录（2026-11-02）**：002_refresh_tokens 迁移；crypto(scrypt+随机盐+sha256)、tokens(jose HS256，access 7d 带 jti；refresh 30d 只存哈希、旋转即吊销)、rateLimit（固定窗口，登录 60s/IP 20 次）、validate 中间件、requireAuth、users 服务、/auth/password/login|refresh|logout、/auth/password/set、/me。17 个测试（4 套件：HTTP 骨架 5、crypto 4、JWT 2、密码认证集成 6）；无库环境集成套件自动 skip；docker compose 端到端验证登录→/me→旋转→旧 refresh 401 全通过。

---

## T3.2 ✅ 短信验证码登录（已完成 2026-11-02）

**背景**：手机号验证码是主登录方式，未注册自动建号；生产用腾讯云短信，开发/CI 固定码。

**写范围（server/）**：

- `src/adapters/types.ts`：确认 `SmsAdapter.sendCode(phone, code)`；新增 `src/adapters/tencent-sms.ts`：调用腾讯云 SMS（用 `TENCENT_SECRET_ID/KEY/SMS_SIGN_NAME/SMS_TEMPLATE_ID`），错误归一为 `sms_send_failed`。`adapters/index.ts` 按 `SMS_ADAPTER` 选择。
- `src/services/smsCodes.ts`：生成 6 位码（**非生产且 mock 模式固定 123456**，单测断言）、存 `sms_codes`（5 分钟过期、消费即置 `consumed`）、校验。
- `src/services/rateLimit.ts`：基于 `rate_limits` 的固定窗口；同号 60s 一次、每日 10 次，IP 维度兜底。
- 路由（并入 `auth.ts`）：
  - `POST /auth/sms/request {phone}`：限流 → 发码；mock 模式响应可带 `devCode:'123456'`（仅非 production），生产不返回码。
  - `POST /auth/sms/verify {phone, code}`：校验通过则查/建用户 → 发令牌对 + user；错误 400 `bad_code`、过期 `code_expired`。
  - `POST /auth/bind/phone`（需登录）`{phone, code}`：绑定/换绑；该手机已被占用返回 409 `phone_taken`。
- `test/integration/sms-auth.test.ts`：mock 模式请求→123456 登录成功→新用户自动建号；错码/过期/60s 内重复请求 429。
- `.env.example` 补充短信变量（已有占位，核对命名一致）。

**验收**：生产模式（`SMS_ADAPTER=tencent`）响应绝不回传验证码；mock 模式固定码；限流在库中有计数；手机号格式错误 400。

**验证**：同上；并临时用 `NODE_ENV=production SMS_ADAPTER=mock` 跑一次断言响应无 `devCode`。

**依赖**：T3.1。真实腾讯云联调等签名模板审核通过（T3.8），代码先合入。

> **完成记录（2026-11-02）**：`tencent-sms.ts` 适配器（腾讯云 SMS SDK，缺密钥 fail-fast，错误归一 `sms_send_failed`）；`smsCodes` 服务（非生产固定 123456、生产随机 6 位、5 分钟过期、一次性消费，bad_code/code_expired）；三级限流（同号 60s 1 次、日 10 次、IP 小时 30 次）；路由 `/auth/sms/request`（生产不回传验证码）、`/auth/sms/verify`（未注册自动建号，返回真实权益）、`/auth/bind/phone`（占用 409 phone_taken）；新增 TENCENT_SMS_APP_ID 配置。8 个短信集成测试；测试运行器改为串行（--test-concurrency=1）避免共享库 truncate 互相干扰，共 25 个测试；容器端到端验证请求→登录→错码→限流全通过。

---

## T3.3 ✅ 微信登录（开放平台扫码 + 服务号网页授权）（已完成 2026-11-02）

**背景**：PC 浏览器走开放平台「网站应用」扫码；微信内走服务号网页授权；靠 unionid 把两种 openid 归一到同一用户。审核件未到位前全程 mock。

**写范围（server/）**：

- `src/adapters/tencent-wechat.ts`：`exchangeOpenCode/exchangeMpCode`（HTTPS 调微信 code2session/userinfo，解析 openid/unionid）、`openAuthorizeUrl`；密钥读 `WECHAT_OPEN_*`/`WECHAT_MP_*`。
- `src/services/wechatAuth.ts`：
  - profile 有 unionid：先按 `(provider,openid)` 查身份，再按 unionid 找已有用户合并；无则建用户+身份。
  - 无 unionid：按 openid 独立建号；后续出现 unionid 时合并身份（写合并函数与单测）。
  - 幂等：重复登录不重复建用户/身份。
- 路由：
  - `GET /auth/wechat/url?redirect=<encoded>` → `{url, state}`（state 防 CSRF，存短期内存或签名 nonce）。
  - `POST /auth/wechat/callback {code, state}`（开放平台）→ 令牌对+user。
  - `GET/POST /auth/wechat/mp`（服务号回调，snsapi_userinfo）→ 同上。
- `test/integration/wechat-auth.test.ts`：用 mock code（`mock-open:<openid>:<unionid>` 约定）覆盖「首登建号、同 unionid 两入口归一、无 unionid 独立、重复登录幂等」。

**验收**：两个 provider 的同一 unionid 最终 `GET /me` 为同一 user_id；无 unionid 不错误合并；state 不匹配 400；微信侧错误归一为 400/502 不泄漏原始报文。

**验证**：`npm test`；真实微信联调在开放平台网站应用审核通过后（T3.8），用 CloudBase 默认域名先跑通回调白名单。

**依赖**：T3.1（复用令牌体系）。

> **完成记录（2026-11-02）**：`tencent-wechat.ts` 适配器（开放平台 qrconnect snsapi_login + 服务号 oauth2/authorize snsapi_userinfo，code 换 openid/unionid，错误归一 wechat_auth_failed/wechat_unavailable，缺密钥 fail-fast）；`oauthState.ts` 无状态 HMAC 签名 state（10 分钟有效，防 CSRF）；`wechatAuth` 服务实现身份已存在→补 unionid、有 unionid→跨 provider 合并身份、否则建新用户，全程幂等；路由 `GET /auth/wechat/url`、`POST /auth/wechat/callback`、`POST /auth/wechat/mp/url`、`GET /auth/wechat/mp`（支持微信内重定向回调），redirect 白名单校验。5 个集成测试覆盖首登、双入口 unionid 归一为同一用户、无 unionid 独立、重复登录幂等、state 篡改/非法 redirect 400；共 30 个测试。容器端到端验证两 openid 同属一个用户。真实微信联调待开放平台网站应用审核（T3.8）。

---

## T3.4 ✅ 前端账号层（已完成 2026-11-02）

**背景**：未登录时现有功能（诊断/补救/视频）完全不降级；登录后自动云同步。三种登录方式一个登录页。

**写范围（web/）**：

- `src/api/client.ts`：fetch 封装（baseURL 来自 `VITE_API_BASE_URL`，默认空=同源；自动带 access、401 时用 refresh 重试一次、再失败清会话）。
- `src/stores/auth.ts`：令牌存取（localStorage 版本化键 `cnmAuth.v1`）、`me`、登录动作（sms/password/wechat）、登出；计算属性 `isLoggedIn`、`entitlements`。
- `src/pages/LoginPage.vue` + `/login` 路由：手机号+验证码（60s 倒计时）、账号密码、微信扫码（非微信环境显示二维码/跳转授权 URL；微信内显示「微信一键登录」走 MP）。开发环境提示固定码 123456（`import.meta.env.DEV`）。
- 顶栏：未登录显示「登录」，已登录显示昵称/手机脱敏与退出（`DefaultLayout.vue`）。
- 路由：`/login?next=<path>`，登录成功回跳；需要登录的设置页加守卫，公开页不拦截。
- `src/pages/AccountPage.vue`（账号设置，骨架）：显示手机/微信绑定状态（T3.2 的 bind 在这提供入口按钮，可下一任务接全）、退出登录。
- 单元/组件测试：store 的令牌持久化与 401 刷新流程（mock fetch）；e2e：用 MSW 或指向本地 API 的方式跑「验证码登录→顶栏变已登录→刷新保持→退出」。若 e2e 起后端成本高，先做 vitest 全 mock + 一个手工验证清单，并在任务说明里标注。

**验收**：未登录走诊断/补救/报告全流程无任何拦截；登录后刷新仍登录；access 过期能透明刷新一次；退出后本地令牌清除。

**验证**：`npm run typecheck && npm test`；新增登录 e2e（或说明替代证据）；现有 102 个 e2e 全绿（未登录行为必须与现状一致）。

**依赖**：T3.1–T3.3 的接口可联调；也可先按契约用 mock 并行开发，接口就绪后切换。

> **完成记录（2026-11-02）**：`src/api/client.ts`（VITE_API_BASE_URL、Bearer、401 自动 refresh 重放一次、错误信封 ApiError）；`src/stores/auth.ts`（`cnmAuth.v1` 持久化、短信/密码/微信登录、logout、fetchMe、脱敏手机号、会员派生状态）；`/login`（短信+密码双 Tab、60s 倒计时、UA 检测微信环境显示一键登录/扫码、DEV 显示固定码）、`/login/callback/:provider`、`/account`；顶栏登录/账号入口（窄屏可见）。5 个 store 单测（持久化、后端错误、refresh 重放、refresh 失败清会话、logout）+ 5 个 e2e（用 Playwright route mock API，不依赖后端部署：未登录公开诊断不拦截、验证码登录与刷新保持、错误不跳转、微信回调、缺参失败页）。最终 vitest 49、playwright 107 全绿；未配置 API 时不会发起任何账号请求，M0/M1 纯本地流程零回归。`web/.env.example` 说明 VITE_API_BASE_URL。

---

## T3.5 ✅ 云同步引擎（已完成 2026-11-02）

**背景**：把补救计划、盲区、孩子档案、shortfall 在多设备间同步；本地仍是缓存，离线可答题，联网后合并，冲突按 `updated_at` 最后写入获胜，埋点只追加去重。

**写范围（server/）**：

- `GET /sync?keys=a,b`（需登录）：返回 `{items:[{key,data,updatedAt}]}`，无记录的键不返回。
- `POST /sync`（需登录）：`{items:[{key,data,updatedAt}]}`，逐键 `INSERT ... ON CONFLICT (user_id,key) DO UPDATE ... WHERE EXCLUDED.updated_at > sync_blobs.updated_at RETURNING`；返回每个键最终的 `{key,updatedAt}`，让客户端知道谁赢。
- 校验：key 白名单（只允许 5 类已知前缀）、单条 data 大小上限（如 256KB）、updatedAt 为有限数字；越界 400。
- `test/integration/sync.test.ts`：双客户端 last-write-wins、旧时间戳不覆盖新数据、白名单外键 400、隔离不同用户。

**写范围（web/）**：

- `src/sync/engine.ts`：纯函数 `mergeLocal(remote, local)`（按 updatedAt 取新）、待推送队列、防抖（写后 2s）、启动拉取、登录后全量同步、`online/offline` 事件。
- 接入现有 store：`remediation.ts`/`blindspots.ts`/`children.ts`/shortfall 的持久化点加「写本地→标记 dirty→防抖推送」；拉取合并后回写本地并刷新响应式状态（沿用 computed 依赖，避免 M1 遇到过的"computed 不追踪依赖"问题）。
- 冲突策略严格按工程方案表：计划/shortfall 整键 LWW；blindspots/children 条目级合并（带条目 updatedAt）；events 只追加。
- `src/sync/__tests__`：merge 纯函数覆盖「远端新/本地新/相等/离线积压」。

**验收**：A 设备做诊断+补救到复测通过，B 设备登录同账号刷新看到一致计划、复习到期与孩子档案（自动化或手工录屏证据）；断网全程可答题，恢复后数据不丢不重复；未登录不发任何 /sync 请求。

**验证**：后端集成测试 + 前端 vitest；现有本地功能在「无 API 地址」（未配置后端）时行为与现在完全一致。

**依赖**：T3.4。

> **完成记录（2026-11-02）**：后端 `GET/POST /sync`（键白名单、单条 256KB、毫秒 updatedAt、逐键 LWW，`changed` 回执）；前端 `src/sync/merge.ts` 五类策略（计划 LWW、shortfall 并集、盲区条目合并、孩子档案按 id、记录按 key 去重）；`src/sync/engine.ts`（登录后 pull 合并并广播、写入防抖 2s、失败保留 dirty、online/可见时重试、未登录零请求）；remediation/blindspots/legacy children 的写入点全部接 `__cnmSyncDirty` 钩子；远端合并后计划 store 重新载入。修了一个真实缺陷：新设备本地无计划时 `allKnownKeys` 不请求任何 `cnmRemedy.plan.*`，第二台设备永远拉不到云端计划——改为按全部学科生成键。测试：后端 sync 集成 6 个（LWW/白名单/超大/用户隔离），前端 merge 6 个 + engine 5 个 + sync e2e 4 个（未登录零请求、新设备拉取、防抖推送、断网重试）；最终 vitest 60、playwright 111、server 36 全绿。

---

## T3.6 ✅ 埋点上报（已完成 2026-11-02）

**写范围（server/）**：`POST /track`（登录带 user；未登录也允许，带匿名设备 id）：批量 `{events:[{uid,name,payload,clientAt}]}`，按 `client_uid` 唯一去重插入 `events`，超限丢弃并 202。

**写范围（web/）**：`utils/track.ts` 增加 transport：缓冲上报（登录后每 20s 或页面隐藏时 flush），失败保留本地；未登录仍只存本地。新增匿名设备 id（`cnmDevice.v1`）。

**验收**：重复 uid 不产生两条；离线产生的事件联网后补报；T3.4 之前已有事件结构不变（七事件 + video_open）。

**验证**：集成测试去重；vitest 验证 flush/重试；typecheck。

**依赖**：T3.4（用户态），但匿名上报不依赖登录，可与 T3.5 并行。

> **完成记录（2026-11-02）**：后端 `POST /track` 支持可选登录与匿名 `deviceId`，批量校验七类既有事件及 `video_open`/`paywall_view`，按 `client_uid` 唯一去重；新增 `client_at` 增量迁移，单批最多 100 条，超限/无效项丢弃并返回 202。前端 `track.ts` 保持 `cnmTrack.v1` 本地结构，新增持久化 `cnmDevice.v1`，登录后每 20 秒、页面隐藏时上报，失败保留并监听 `online` 补报，未登录零请求；兼容旧事件补 `uid`。验证：server 40 个测试（含真实 PG 匿名上报、重复 uid 去重、无效项与超限）+ build 全绿；web typecheck + vitest 64 全绿；新增 2 个 Playwright 覆盖登录批量上报与断网补报，均通过。

---

## T3.7 ✅ 权益骨架（已完成 2026-11-02，不接支付）

**写范围（server/）**：`GET /me` 的 entitlements 由真实记录提供；新增**带 Basic Auth 的内部管理接口**（独立强密码环境变量）`POST /admin/users/:phone/entitlements {member,expireAt,source}` 用于手工开通；写审计日志（console 或简易表）。

**写范围（web/）**：

- `src/stores/entitlements.ts`：从 auth.me 派生 `isMember`，提供 `hasFeature(key)`，feature 键与规划 §5.1 对齐（unlimited_practice、ai_explain、report_detail、multi_child 等）。
- 付费点 UI：免费用户到点显示「会员功能，即将开放」弹层，**无任何支付按钮**；记录 `paywall_view` 埋点（本地先记，T3.6 后自动上报）。
- 手工置 member:true 的账号看到会员内容；免费账号看到拦截。

**验收**：未开通账号每个付费点都被拦截且文案统一；开通后（重新拉 /me）解锁；全站 grep 不到支付/价格/下单字样。

**验证**：集成测试管理接口需鉴权、开通后 /me 变化；前端 e2e 用 mock me 验证两态。

**依赖**：T3.4；拦截点可先在前端用本地 mock 权益开发，再接 /me。

> **完成记录（2026-11-02）**：后端新增独立 Basic Auth 管理中间件与 `POST /admin/users/:phone/entitlements`，支持 upsert、撤销、过期时间与 `entitlement_admin_update` 审计日志；`/me` 继续读取真实权益记录，过期会员自动按免费处理。`ADMIN_USERNAME`/`ADMIN_PASSWORD` 已加入环境模板和 compose，README 提供手工开通示例。前端新增 `entitlements` store（五个 §5.1 feature 键、会员/过期派生、统一 `requestFeature`、刷新 `/me`）与全局 `PaywallDialog`；账号页提供五个功能入口，免费用户统一看到「会员功能，即将开放」并记录 `paywall_view`，会员可查看内容，无交易按钮。验证：server 44 个测试 + build 全绿；web typecheck、build、eslint、vitest 68 全绿；新增 3 个 e2e 覆盖免费全入口拦截/埋点、会员全入口解锁、重新拉 `/me` 后解锁，均通过；全量 e2e 115/116 后，唯一 service-worker 注册捕获用例独立重跑 2/2 通过（并行时序波动，非本任务回归）；`web/src` 无支付/价格/下单文案。

---

## T3.8 部署与生产验收

**前置（负责人/外部，审核有周期，尽早办）**：腾讯云新增备案接入（api.zyxw.cn）、短信签名模板、微信开放平台网站应用认证并联姻服务号、CloudBase 与 TencentDB 开通——清单见工程方案第七节。

**写范围**：

- `server/cloudbaserc.json`（或对应配置）与部署说明：CloudBase 云托管服务（镜像从现有 Dockerfile 构建）、环境变量/密钥管理、同 VPC 的 TencentDB PostgreSQL、最小副本与并发、日志。
- 数据库：生产库执行迁移、每日自动备份策略、连接只走内网、应用账号最小权限。
- 前端：`VITE_API_BASE_URL=https://api.zyxw.cn` 的生产构建；产物发布到现有主站服务器（www.zyxw.cn，非腾讯云），CORS 收敛为具体来源白名单（替换 T3.0 的 `*`）。
- HTTPS/域名：api.zyxw.cn 接 CloudBase 网关与证书；备案接入通过前用默认域名联调。
- `.env.production` 模板（不含真值）与密钥交接清单；回滚方法（镜像版本回退 + 迁移向下兼容）。

**生产验收清单（逐条要有证据）**：

1. `https://api.zyxw.cn/healthz` 返回 db:up；三种登录在生产各成功一次（短信真实收到、PC 扫码、微信内授权）。
2. 同账号两设备同步通过（T3.5 验收在生产复现一次）。
3. 断网答题→恢复补报、同步无丢失。
4. 免费/会员两态在生产手工切换验证。
5. 未备案完成前，主站功能不依赖 api 域名（未配置 API 时纯本地可用）。
6. 密钥不在仓库、不在日志；错误响应不回显堆栈/SQL。

**依赖**：T3.1–T3.7 全部完成且外部资质就绪。

---

## 建议顺序与并行关系

```
T3.1 ─→ T3.2 ─┐
       T3.3 ──┴→ T3.4 ─→ T3.5 ─→ T3.7 ─→ T3.8
                     └→ T3.6（可与 T3.5 并行）
```

每个任务合并前更新本文勾选状态与 M3工程方案；发现契约需要变更，先改工程方案再写代码，不允许在任务里私改接口形状。
