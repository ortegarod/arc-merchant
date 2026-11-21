/**
 * Health check for monitoring.
 *
 * Reports whether the facilitator (which settles payments) and the optional
 * database answer. 200 when everything that is configured works, 503 otherwise.
 * Never returns internal addresses or error details.
 */

import { NextResponse } from 'next/server'
import { getDb, isDatabaseConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 3000

async function facilitatorUp(): Promise<boolean> {
  const url = (process.env.FACILITATOR_URL || 'http://localhost:4022').replace(/\/+$/, '')
  try {
    const res = await fetch(url + '/health', { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

async function databaseUp(): Promise<boolean | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const db = await getDb()
    if (!db) return false
    await Promise.race([
      db.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ])
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [facilitator, database] = await Promise.all([facilitatorUp(), databaseUp()])
  const ok = facilitator && database !== false
  return NextResponse.json(
    { ok, facilitator, database: database ?? 'not configured' },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  )
}
