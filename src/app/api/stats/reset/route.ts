/**
 * Reset stats API endpoint
 *
 * POST /api/stats/reset - Clears all payment statistics.
 * Requires `Authorization: Bearer <ADMIN_TOKEN>`; disabled (404) when ADMIN_TOKEN is unset.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resetStats } from '@/lib/stats'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  resetStats()
  return NextResponse.json({ success: true, message: 'Stats reset' })
}
