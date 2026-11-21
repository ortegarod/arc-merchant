/**
 * Admin authorization for endpoints that change stored stats.
 *
 * Disabled unless ADMIN_TOKEN is set: without it, admin endpoints answer 404
 * as if they did not exist. With it, callers must send
 * `Authorization: Bearer <ADMIN_TOKEN>`.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

/** Returns an error response if the request is not authorized, otherwise null. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const header = req.headers.get('authorization') ?? ''
  const supplied = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const a = Buffer.from(supplied)
  const b = Buffer.from(token)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
