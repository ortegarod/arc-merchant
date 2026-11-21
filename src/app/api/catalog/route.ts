/**
 * GET /api/catalog: the paid resources, their prices and payment details as JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildCatalog } from '@/lib/catalog'
import { publicOrigin } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const catalog = await buildCatalog(publicOrigin(req))
  return NextResponse.json(catalog, { headers: { 'cache-control': 'public, max-age=300' } })
}
