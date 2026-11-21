/**
 * x402-Protected Article Endpoint
 */

import { withX402 } from '@x402/next'
import { NextRequest, NextResponse } from 'next/server'
import { getArticleBySlug, Article } from '@/data/articles'
import { ARC_CONTRACTS } from '@/lib/arc'
import { server, ARC_NETWORK, getPayToAddress } from '@/lib/x402'
import { recordPayment } from '@/lib/stats'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ slug: string }> }

// Behind a proxy (e.g. Railway) req.url is the internal address, so build the
// public URL for the x402 resource from PUBLIC_BASE_URL or forwarded headers.
function publicResourceUrl(req: NextRequest): string {
  const path = req.nextUrl.pathname
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '')
  if (base) return base + path
  const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim()
  if (host) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https'
    return `${proto}://${host}${path}`
  }
  return req.nextUrl.origin + path
}

function createHandler(article: Article) {
  return async (): Promise<NextResponse> => {
    return NextResponse.json(article)
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const article = getArticleBySlug(slug)

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // Extract payer from payment header (before x402 processes it)
  const paymentHeader = req.headers.get('payment-signature')
  let payer = 'unknown'
  if (paymentHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
      payer = decoded?.payload?.authorization?.from || 'unknown'
    } catch { /* ignore */ }
  }

  const handler = withX402(
    createHandler(article),
    {
      accepts: [{
        scheme: 'exact' as const,
        network: ARC_NETWORK,
        payTo: await getPayToAddress(),
        price: `$${article.priceUsd}`,
        extra: {
          name: 'USDC',
          version: '2',
          asset: ARC_CONTRACTS.USDC,
        },
      }],
      resource: publicResourceUrl(req),
      description: article.title,
      mimeType: 'application/json',
    },
    server,
  )

  const response = await handler(req)

  // If payment was made, extract txHash and record it
  if (response.status === 200 && paymentHeader) {
    const paymentResponseHeader = response.headers.get('payment-response')
    let txHash: string | null = null

    if (paymentResponseHeader) {
      try {
        const paymentResponse = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString())
        txHash = paymentResponse.transaction || null
      } catch { /* ignore */ }
    }

    await recordPayment({
      slug: article.slug,
      amount: article.priceUsd,
      txHash,
      payer,
      timestamp: Date.now(),
      network: ARC_NETWORK,
    }, article.title)
  }

  return response
}
