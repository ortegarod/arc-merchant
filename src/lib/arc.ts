import { defineChain } from 'viem'

/**
 * Arc network selection. ARC_NETWORK=testnet (default) or mainnet sets the
 * chain, RPC, explorer, Circle blockchain code and token addresses.
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

function selectNetwork(): ArcNetworkName {
  const v = (process.env.ARC_NETWORK || 'testnet').trim().toLowerCase()
  if (v === 'testnet' || v === 'mainnet') return v
  throw new Error(`ARC_NETWORK must be "testnet" or "mainnet", got "${v}"`)
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
