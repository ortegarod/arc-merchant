/**
 * Optional Postgres storage for payment history.
 *
 * Enabled only when DATABASE_URL is set. Without it the app keeps history in
 * memory, as before, and loses it on restart.
 *
 * Schema changes are append-only migrations below, applied once each, in
 * order, the first time the database is used (or with `npm run db:migrate`).
 */

import { Pool } from 'pg'

interface Migration {
  id: number
  name: string
  sql: string
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'create payments',
    // Only data that is already public on-chain is stored. No IP addresses,
    // user agents, request headers or chat content.
    sql: `
      CREATE TABLE payments (
        id          BIGSERIAL PRIMARY KEY,
        -- Settlement transaction. Unique so a retried record is stored once.
        -- NULL until known; Postgres allows any number of NULLs in a UNIQUE column.
        tx_hash     TEXT UNIQUE,
        slug        TEXT NOT NULL,
        title       TEXT NOT NULL,
        amount_usdc NUMERIC(18, 6) NOT NULL,
        -- Payer wallet address. The API only ever returns a shortened form.
        payer       TEXT NOT NULL,
        -- CAIP-2 network id, e.g. eip155:5042002 for Arc testnet.
        network     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX payments_created_at_idx ON payments (created_at DESC);
      CREATE INDEX payments_slug_idx ON payments (slug);
    `,
  },
]

// Arbitrary constant so concurrent instances never run migrations at once.
const MIGRATION_LOCK_ID = 4_020_402

declare global {
  var dbPool: Pool | undefined
  var dbReady: Promise<Pool> | undefined
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  })
  // An idle client losing its connection must not crash the server.
  pool.on('error', (err) => console.error('Postgres pool error:', err.message))
  return pool
}

/** Applies any migrations not yet recorded in schema_migrations. */
export async function migrate(pool: Pool): Promise<number> {
  const client = await pool.connect()
  let applied = 0
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         INT PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    const { rows } = await client.query<{ id: number }>('SELECT id FROM schema_migrations')
    const done = new Set(rows.map((r) => r.id))
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue
      await client.query(m.sql)
      await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [m.id, m.name])
      applied++
    }
    await client.query('COMMIT')
    return applied
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * Returns a ready-to-use pool, or null when no database is configured.
 * Migrations run on first use; a failed attempt is retried on the next call.
 */
export async function getDb(): Promise<Pool | null> {
  if (!isDatabaseConfigured()) return null
  if (!globalThis.dbReady) {
    const pool = globalThis.dbPool ?? createPool()
    globalThis.dbPool = pool
    globalThis.dbReady = migrate(pool)
      .then((n) => {
        if (n > 0) console.log(`🗄️  Applied ${n} database migration(s)`)
        return pool
      })
      .catch((err) => {
        globalThis.dbReady = undefined
        throw err
      })
  }
  return globalThis.dbReady
}
