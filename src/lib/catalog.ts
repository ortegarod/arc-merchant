/**
 * Machine-readable list of the paid resources, for agent discovery.
 * Shared by /api/catalog (JSON) and /llms.txt (text).
 */

import { getAllArticles } from '@/data/articles'
import { ARC_CONTRACTS } from '@/lib/arc'
import { ARC_NETWORK, getPayToAddress } from '@/lib/x402'

export interface CatalogResource {
  url: string
  method: 'GET'
  title: string
  description: string
  priceUsd: number
  /** Amount in the asset's smallest unit (USDC has 6 decimals). */
  amount: string
  mimeType: string
}

export interface Catalog {
  name: string
  description: string
  x402Version: 2
  scheme: 'exact'
  network: string
  asset: string
  currency: 'USDC'
  payTo: string | null
  resources: CatalogResource[]
}

export async function buildCatalog(origin: string): Promise<Catalog> {
  let payTo: string | null = null
  try {
    payTo = await getPayToAddress()
  } catch {
    // Wallet lookup failed; the 402 response of each resource still carries payTo.
  }
  return {
    name: 'Arc Merchant',
    description: 'Articles about Arc, x402 and Circle, sold per article in USDC over x402.',
    x402Version: 2,
    scheme: 'exact',
    network: ARC_NETWORK,
    asset: ARC_CONTRACTS.USDC,
    currency: 'USDC',
    payTo,
    resources: getAllArticles().map((a) => ({
      url: `${origin}/api/article/${a.slug}`,
      method: 'GET',
      title: a.title,
      description: a.description,
      priceUsd: a.priceUsd,
      amount: Math.round(a.priceUsd * 1_000_000).toString(),
      mimeType: 'application/json',
    })),
  }
}
