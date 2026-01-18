/**
 * Stats API endpoint for merchant dashboard
 *
 * Returns payment statistics for the dashboard to display.
 * Includes actual on-chain balance from Circle SDK.
 */

import { NextResponse } from 'next/server'
import { getStats, shouldRefreshBalance, getCachedBalance, setCachedBalance, getCachedWallet } from '@/lib/stats'
import { getMerchantWallet, getWalletBalance } from '@/lib/circle-wallet'

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
      const usdcBalance = balances.find((b: any) =>
        b.token?.symbol?.includes('USDC') || b.token?.includes('USDC')
      );
      onChainBalance = usdcBalance?.amount || '0';

      // Store both wallet and balance
      setCachedBalance(onChainBalance, wallet.id, wallet.address);
      merchantWallet = { id: wallet.id, address: wallet.address };
      console.log(`📊 Balance updated: $${onChainBalance}`);
    } catch (error) {
      console.error('Failed to get merchant wallet:', error);
    }
  }

  return NextResponse.json({
    ...stats,
    merchantWallet,
    onChainBalance,
  })
}
