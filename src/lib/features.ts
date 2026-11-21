/**
 * Feature flags read from the server environment.
 */

/**
 * The in-page buyer agent spends from this server's own Circle wallets, so it
 * suits local demos but not a public deployment. Set ENABLE_BUYER_AGENT=false
 * to turn off both the chat endpoint and the dashboard panel.
 */
export function isBuyerAgentEnabled(): boolean {
  return process.env.ENABLE_BUYER_AGENT !== 'false'
}
