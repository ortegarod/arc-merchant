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

function createHandler(article: Article) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Extract payer from payment header
    const paymentHeader = req.headers.get('payment-signature')
    let payer = 'unknown'
    if (paymentHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString())
        payer = decoded?.payload?.authorization?.from || 'unknown'
      } catch { /* ignore */ }
    }

    recordPayment({
      slug: article.slug,
      amount: article.priceUsd,
      txHash: null,
      payer,
      timestamp: Date.now(),
    }, article.title)

    return NextResponse.json(article)
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const article = getArticleBySlug(slug)

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
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
      description: article.title,
      mimeType: 'application/json',
    },
    server,
  )

  return handler(req)
}
