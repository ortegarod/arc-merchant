/**
 * Stats API endpoint for merchant dashboard
 *
 * Returns payment statistics for the dashboard to display.
 * Includes actual on-chain balance from Circle SDK.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStats, shouldRefreshBalance, getCachedBalance, setCachedBalance, getCachedWallet, updatePaymentTxHash, recordBalanceFetchError } from '@/lib/stats'
import { getMerchantWallet, getWalletBalance } from '@/lib/circle-wallet'
import { asApiError } from '@/lib/errors'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stats = getStats()

  // Use cached values
  let merchantWallet = getCachedWallet();
  let onChainBalance = getCachedBalance();

  // Only hit Circle API when we need to refresh
  if (shouldRefreshBalance()) {
    try {
      console.log(`📊 Refreshing from Circle API...`);
      const wallet = await getMerchantWallet();
      const balances = await getWalletBalance(wallet.id);

      // Token can be 'USDC' or 'USDC-TESTNET' depending on network
      const usdcBalance = balances.find((b: { token?: { symbol?: string } | string }) =>
        typeof b.token === 'string' ? b.token.includes('USDC') : !!b.token?.symbol?.includes('USDC')
      );
      onChainBalance = usdcBalance?.amount || '0';

      // Store both wallet and balance
      setCachedBalance(onChainBalance, wallet.id, wallet.address);
      merchantWallet = { id: wallet.id, address: wallet.address };
      console.log(`📊 Balance updated: $${onChainBalance}`);
    } catch (e) {
      const error = asApiError(e);
      // Respect Circle/Cloudflare's Retry-After hint when present so we don't
      // hammer the API again before it's actually willing to answer.
      const retryAfterSec = (error.response?.data as { retry_after?: unknown } | undefined)?.retry_after;
      const retryAfterMs = typeof retryAfterSec === 'number' ? retryAfterSec * 1000 : undefined;
      recordBalanceFetchError(retryAfterMs);
      const status = error.response?.status;
      console.error(`Failed to get merchant wallet (status ${status ?? 'unknown'}), backing off:`, error.message);
    }
  }

  return NextResponse.json({
    ...stats,
    merchantWallet,
    onChainBalance,
  })
}

/**
 * POST /api/stats - Update payment with transaction hash
 *
 * For recording a txHash that settled after the paid response was sent.
 * Requires `Authorization: Bearer <ADMIN_TOKEN>`; disabled (404) when ADMIN_TOKEN is unset.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { slug, payer, txHash } = await req.json()

    if (!slug || !payer || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, payer, txHash' },
        { status: 400 }
      )
    }

    const updated = updatePaymentTxHash(slug, payer, txHash)

    if (updated) {
      console.log(`📊 Updated txHash for ${slug}: ${txHash}`)
      return NextResponse.json({ success: true, txHash })
    } else {
      return NextResponse.json(
        { error: 'No matching payment found to update' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Failed to update txHash:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction hash' },
      { status: 500 }
    )
  }
}
