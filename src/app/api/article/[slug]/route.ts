/**
 * x402-Protected Article Endpoint
 *
 * AI agents and web crawlers must pay to access article content.
 * Demonstrates micropayments for content creators.
 */

import { withX402 } from '@x402/next'
import { NextRequest, NextResponse } from 'next/server'
import { getArticleBySlug } from '@/data/articles'
import { ARC_CONTRACTS } from '@/lib/arc'
import { server, ARC_NETWORK, getPayToAddress } from '@/lib/x402'
import { recordPayment } from '@/lib/stats'

export const dynamic = 'force-dynamic'

// Article handler - returns article content after payment
async function articleHandler(req: NextRequest): Promise<NextResponse> {
  // Extract slug from URL path
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const slug = pathParts[pathParts.length - 1]

  const article = getArticleBySlug(slug)

  if (!article) {
    return NextResponse.json(
      { error: 'Article not found' },
      { status: 404 }
    )
  }

  // Payment verified by x402 middleware - record stats
  // Extract payment info from headers
  let txHash: string | null = null
  let payer = 'unknown'

  // Get payer address from the payment-signature header (sent by client)
  const paymentSignature = req.headers.get('payment-signature')
  if (paymentSignature) {
    try {
      const parsed = JSON.parse(Buffer.from(paymentSignature, 'base64').toString())
      payer = parsed.payload?.authorization?.from || 'unknown'
    } catch {
      // Payment info not available
    }
  }

  // Get transaction hash from x-payment-response header (set by x402 middleware after settlement)
  const paymentResponse = req.headers.get('x-payment-response')
  if (paymentResponse) {
    try {
      const parsed = JSON.parse(Buffer.from(paymentResponse, 'base64').toString())
      txHash = parsed.transaction || null
    } catch {
      // Transaction hash not available
    }
  }

  recordPayment({
    slug,
    amount: 0.01, // $0.01 per article
    txHash,
    payer,
    timestamp: Date.now(),
  }, article.title)

  // Return full article
  return NextResponse.json({
    slug: article.slug,
    title: article.title,
    description: article.description,
    author: article.author,
    publishedAt: article.publishedAt,
    content: article.content,
    tags: article.tags,
  })
}

// Dynamic x402 wrapper - fetches merchant address from Circle on each request
export async function GET(req: NextRequest) {
  const payToAddress = await getPayToAddress();

  const wrappedHandler = withX402(
    articleHandler,
    {
      accepts: [{
        scheme: 'exact' as const,
        network: ARC_NETWORK,
        payTo: payToAddress,
        price: '$0.01',
        extra: {
          name: 'USDC',
          version: '2',
          asset: ARC_CONTRACTS.USDC,
        },
      }],
      description: 'Article content (paid access)',
      mimeType: 'application/json',
    },
    server,
  );

  return wrappedHandler(req);
}
