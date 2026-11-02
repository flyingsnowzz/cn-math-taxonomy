# cnm-server（账号 / 云同步 API）

Express 4 + TypeScript + PostgreSQL 16，容器化部署到腾讯云 CloudBase 云托管。
设计与接口契约见 [../docs/strategy/M3工程方案.md](../docs/strategy/M3工程方案.md)。

## 本地开发（不需要任何云密钥）

```bash
cp .env.example .env
docker compose up -d --build   # 起 PostgreSQL + API（自动跑迁移）
curl http://127.0.0.1:8787/healthz
```

不用 docker 时：本机起 Postgres 后 `npm run migrate && npm run dev`。
短信/微信默认 mock 模式，开发验证码固定 123456；腾讯适配器已就绪（`SMS_ADAPTER=tencent`、`WECHAT_ADAPTER=tencent`），缺密钥启动即报错。微信 mock code 约定：`mock-open:<openid>[:<unionid>]` / `mock-mp:<openid>[:<unionid>]`。

## 测试

```bash
docker compose up -d --build   # 起 PG（宿主 127.0.0.1:5433）+ API
npm test                       # 单测 + 集成测试（44 个）
npm run build                  # tsc 类型检查与产物
```

- 集成测试自动建 `cnm_test` 库并应用迁移；连不上测试库时集成套件自动 skip，单测照跑；测试串行执行避免共享库干扰（共 44 个）。
- 测试库连接可用 `TEST_DATABASE_URL` / `TEST_DATABASE_ADMIN_URL` 覆盖。
- 宿主 5432 被占用时 compose 只把 PG 映射到 127.0.0.1:5433，不影响本机已有 Postgres。

## 目录

```
src/
  config.ts          环境变量配置
  app.ts             Express 装配（CORS、JSON、错误处理）
  index.ts           启动入口
  routes/            路由（health、auth 密码登录/refresh/logout/me、sms 验证码请求/校验/绑机、wechat 扫码/服务号授权、sync 云同步、track 埋点上报、admin 手工权益）；前端 T3.4–T3.7 已按契约接入
  middleware/        认证守卫、请求体校验、错误处理
  services/          纯业务逻辑
  adapters/          外部服务（sms/wechat），mock ↔ tencent 可替换
  middleware/        错误处理等
  db/                连接池与 SQL 迁移（migrations/*.sql 按文件名顺序执行一次）
test/                node:test
```

迁移：新增 `src/db/migrations/NNN_xxx.sql`，启动时自动应用并登记到 `schema_migrations`。

## 手工开通会员

管理接口使用独立 Basic Auth。设置至少 16 位的 `ADMIN_PASSWORD`（可选 `ADMIN_USERNAME`，默认 `admin`）后：

```bash
curl -u "admin:${ADMIN_PASSWORD}" \
  -H 'content-type: application/json' \
  -d '{"member":true,"expireAt":"2027-12-31T23:59:59Z","source":"manual"}' \
  http://127.0.0.1:8787/admin/users/13800000000/entitlements
```

成功后可重新请求 `GET /me` 查看权益；将 `member` 设为 `false` 可撤销。每次变更写 `entitlement_admin_update` 审计日志，不记录管理密码。
