import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

/** 单例连接池；测试中可通过 setPool 注入。 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  }
  return pool
}

export function setPool(next: pg.Pool | null): void {
  pool = next
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
