import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client, Pool } = pg

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL
  ?? 'postgres://cnm:cnm_dev_pw@127.0.0.1:5433/cnm'
export const TEST_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://cnm:cnm_dev_pw@127.0.0.1:5433/cnm_test'

/**
 * 准备集成测试库：必要时创建 cnm_test 并应用全部迁移。
 * 返回 false 表示本地 compose 未启动（测试应跳过，而不是失败）。
 */
export async function ensureTestDatabase(): Promise<boolean> {
  process.env.DATABASE_URL = TEST_URL
  const admin = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 1500 })
  try {
    await admin.connect()
    const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname='cnm_test'")
    if (rows.length === 0) await admin.query('CREATE DATABASE cnm_test')
  } catch {
    return false
  } finally {
    await admin.end().catch(() => {})
  }

  const pool = new Pool({ connectionString: TEST_URL })
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'db', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [file])
    if (rowCount) continue
    await pool.query(readFileSync(path.join(dir, file), 'utf8'))
    await pool.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file])
  }
  await pool.end()
  return true
}

export async function truncateTables(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_URL })
  await pool.query(
    `TRUNCATE users, user_identities, entitlements, sync_blobs, events,
     sms_codes, rate_limits, refresh_tokens RESTART IDENTITY CASCADE`,
  )
  await pool.end()
}
