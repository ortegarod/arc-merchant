/**
 * Makes one real x402 purchase against a running store, paid from BUYER_WALLET_ID,
 * and prints the settlement transaction.
 *
 *   npx tsx scripts/test-purchase.ts <paywalled-url> [--mainnet]
 *
 * Needs CIRCLE_API_KEY (with Wallets write), CIRCLE_ENTITY_SECRET and BUYER_WALLET_ID.
 * A mainnet key spends real USDC, so it is refused unless --mainnet is passed.
 */
import { arcTools } from '../src/tools/core'
import { ARC } from '../src/lib/arc'

async function main() {
  const url = process.argv[2]
  const walletId = process.env.BUYER_WALLET_ID
  if (!url || !walletId) throw new Error('usage: BUYER_WALLET_ID=... npx tsx scripts/test-purchase.ts <paywalled-url> [--mainnet]')
  if (!ARC.isTestnet && !process.argv.includes('--mainnet')) {
    throw new Error('CIRCLE_API_KEY is a mainnet key: this would spend real USDC. Pass --mainnet if that is intended.')
  }
  const out = (await arcTools.arc_pay_for_content.execute({ wallet_id: walletId, url, max_price: '0.05' })) as {
    success: boolean; paid?: boolean; transaction?: string | null; explorer_url?: string | null; error?: string
  }
  console.log(JSON.stringify({ network: ARC.caip2, success: out.success, paid: out.paid, tx: out.transaction, explorer: out.explorer_url, error: out.error }))
  if (!out.success || !out.paid || !out.transaction) process.exit(1)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
