import './env'
import { defineChain } from 'viem'

/**
 * Arc network selection. The Circle API key decides it: TEST_API_KEY:… runs on
 * Arc testnet, LIVE_API_KEY:… on Arc mainnet. Circle keys only work on their own
 * network, so a separate network switch could only ever disagree with the key.
 * No key means testnet (nothing can be signed without one anyway).
 * This sets the chain, RPC, explorer, Circle blockchain code and token addresses.
 * Values from https://docs.arc.io/arc/references/rpc-endpoints and contract-addresses.
 */
const NETWORKS = {
  testnet: {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
    circleBlockchain: 'ARC-TESTNET',
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    isTestnet: true,
  },
  mainnet: {
    chainId: 5042,
    name: 'Arc',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    circleBlockchain: 'ARC',
    eurc: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    isTestnet: false,
  },
} as const

export type ArcNetworkName = keyof typeof NETWORKS

export function networkForKey(apiKey: string | undefined): ArcNetworkName {
  const key = (apiKey || '').trim()
  if (!key || key.startsWith('TEST_API_KEY:')) return 'testnet'
  if (key.startsWith('LIVE_API_KEY:')) return 'mainnet'
  throw new Error('CIRCLE_API_KEY must start with TEST_API_KEY: (testnet) or LIVE_API_KEY: (mainnet)')
}

function selectNetwork(): ArcNetworkName {
  if (process.env.ARC_NETWORK) {
    throw new Error('ARC_NETWORK is no longer used: the Circle API key picks the network (TEST_ = testnet, LIVE_ = mainnet). Remove it.')
  }
  return networkForKey(process.env.CIRCLE_API_KEY)
}

export const ARC_NETWORK_NAME: ArcNetworkName = selectNetwork()
const net = NETWORKS[ARC_NETWORK_NAME]

export const ARC = {
  ...net,
  rpcUrl: process.env.ARC_RPC_URL || net.rpcUrl,
  /** CAIP-2 id used by x402, e.g. eip155:5042002. */
  caip2: `eip155:${net.chainId}` as const,
}

export const explorerTxUrl = (hash: string) => `${ARC.explorerUrl}/tx/${hash}`
export const explorerAddressUrl = (address: string) => `${ARC.explorerUrl}/address/${address}`

export const arcChain = defineChain({
  id: ARC.chainId,
  name: ARC.name,
  nativeCurrency: {
    decimals: 18,  // Native USDC gas uses 18 decimals
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: [ARC.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: ARC.explorerUrl,
    },
  },
  testnet: ARC.isTestnet,
})

// Contract addresses on the selected Arc network
export const ARC_CONTRACTS = {
  // USDC ERC-20 interface (6 decimals), same address on both networks - for transfers, approvals, x402
  USDC: '0x3600000000000000000000000000000000000000' as const,
  USDC_DECIMALS: 6,
  // Euro stablecoin (6 decimals)
  EURC: ARC.eurc,
  EURC_DECIMALS: 6,
  // Permit2 for signature-based approvals (canonical address)
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const,
}

// ERC20 ABI for balance/transfer
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
