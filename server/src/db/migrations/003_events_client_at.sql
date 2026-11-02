-- 埋点补客户端时间列（已有表的增量迁移）
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_at TIMESTAMPTZ;
