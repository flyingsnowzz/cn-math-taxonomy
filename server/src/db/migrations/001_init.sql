-- M3 初始结构：账户多身份、权益、用户数据同步、埋点、验证码与限流。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone         VARCHAR(20) UNIQUE,
  password_hash TEXT,
  nickname      VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 一个用户可拥有多种登录身份（手机号在 users 表；微信等第三方在此）
CREATE TABLE IF NOT EXISTS user_identities (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     VARCHAR(20) NOT NULL,            -- wechat_open / wechat_mp
  provider_uid VARCHAR(80) NOT NULL,            -- openid
  unionid      VARCHAR(80),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_unionid ON user_identities(unionid);

CREATE TABLE IF NOT EXISTS entitlements (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  member     BOOLEAN NOT NULL DEFAULT false,
  expire_at  TIMESTAMPTZ,
  source     VARCHAR(40) NOT NULL DEFAULT 'manual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每个本地存储键一行；data 为该键完整 JSON，按 updated_at 做最后写入获胜
CREATE TABLE IF NOT EXISTS sync_blobs (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        VARCHAR(120) NOT NULL,
  data       JSONB NOT NULL,
  updated_at BIGINT NOT NULL,                  -- 客户端毫秒时间戳
  server_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  client_uid VARCHAR(80),                       -- 客户端去重 id
  name       VARCHAR(40) NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_client_uid ON events(client_uid) WHERE client_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS sms_codes (
  phone      VARCHAR(20) PRIMARY KEY,
  code       VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 简单固定窗口限流（key 如 sms:13800000000）
CREATE TABLE IF NOT EXISTS rate_limits (
  key          VARCHAR(120) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INTEGER NOT NULL DEFAULT 1
);
