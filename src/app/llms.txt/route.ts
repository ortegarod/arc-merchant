/**
 * GET /llms.txt: plain-text guide for AI agents (https://llmstxt.org).
 */

import { NextRequest } from 'next/server'
import { buildCatalog } from '@/lib/catalog'
import { publicOrigin } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req)
  const c = await buildCatalog(origin)
  const lines = [
    `# ${c.name}`,
    '',
    `> ${c.description}`,
    '',
    'Each article is paid per request with x402 (version 2, `exact` scheme). Request the URL,',
    'read the base64 `PAYMENT-REQUIRED` header from the 402 response, sign an EIP-3009',
    '`TransferWithAuthorization` for the amount, and retry with a `PAYMENT-SIGNATURE` header.',
    '',
    `- Network: ${c.network} (Arc testnet)`,
    `- Asset: USDC at ${c.asset} (6 decimals)`,
    ...(c.payTo ? [`- Pay to: ${c.payTo}`] : []),
    `- Machine-readable catalog: ${origin}/api/catalog`,
    '',
    '## Articles',
    '',
    ...c.resources.map((r) => `- [${r.title}](${r.url}): ${r.description}. $${r.priceUsd} USDC`),
    '',
  ]
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
}
