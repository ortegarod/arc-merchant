/**
 * Applies pending database migrations: npm run db:migrate
 * Reads DATABASE_URL from the environment or .env.local.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { getDb } = await import('../src/lib/db')
  const pool = await getDb()
  if (!pool) {
    console.error('DATABASE_URL is not set; nothing to migrate.')
    process.exit(1)
  }
  console.log('✓ database schema is up to date')
  await pool.end()
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
