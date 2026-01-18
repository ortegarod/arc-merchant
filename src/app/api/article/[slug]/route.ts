/**
 * x402-Protected Article Endpoint
 *
 * AI agents and web crawlers must pay to access article content.
 * Demonstrates micropayments for content creators.
 */

import { withX402 } from '@x402/next'
import { getArticleBySlug } from '@/data/articles'
import { ARC_CONTRACTS } from '@/lib/arc'
import { server, ARC_NETWORK, payToAddress } from '@/lib/x402'

export const dynamic = 'force-dynamic'

// Article handler - returns article content after payment
async function articleHandler(req: Request) {
  // Extract slug from URL path
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const slug = pathParts[pathParts.length - 1]

  const article = getArticleBySlug(slug)

  if (!article) {
    return new Response(
      JSON.stringify({ error: 'Article not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Payment verified by x402 middleware - return full article
  return new Response(
    JSON.stringify({
      slug: article.slug,
      title: article.title,
      description: article.description,
      author: article.author,
      publishedAt: article.publishedAt,
      content: article.content,
      tags: article.tags,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

// Wrap handler with x402 payment protection
export const GET = withX402(
  articleHandler,
  {
    accepts: [{
      scheme: 'exact' as const,
      network: ARC_NETWORK,
      payTo: payToAddress,
      price: '$0.01', // All articles same price for now
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
)
