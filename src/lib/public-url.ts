import type { NextRequest } from 'next/server'

/**
 * Public origin of this deployment.
 *
 * Behind a proxy (e.g. Railway) req.url is the internal address, so prefer
 * PUBLIC_BASE_URL, then the forwarded host, then the request itself.
 */
export function publicOrigin(req: NextRequest): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '')
  if (base) return base
  const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim()
  if (host) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https'
    return `${proto}://${host}`
  }
  return req.nextUrl.origin
}
