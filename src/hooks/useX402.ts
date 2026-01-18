'use client'

/**
 * x402 Payment Hook for Arc
 *
 * Handles the full x402 payment flow:
 * 1. Make request to protected endpoint
 * 2. If 402, extract payment requirements
 * 3. Sign payment authorization
 * 4. Retry request with payment header
 */

import { useState, useCallback } from 'react'
import { createWalletClient, http, publicActions, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet, ARC_CONTRACTS } from '@/lib/arc'

// Demo wallet key - in production, use Privy/wagmi wallet connection
const DEMO_WALLET_KEY = process.env.NEXT_PUBLIC_ARC_WALLET_KEY

// EIP-3009 types for signing
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

// EIP-712 domain for Arc USDC
const domain = {
  name: 'USDC',
  version: '2',
  chainId: arcTestnet.id,
  verifyingContract: ARC_CONTRACTS.USDC,
}

export interface PaymentRequirements {
  scheme: string
  network: string
  asset: string
  payTo: string
  maxAmountRequired: string
  extra?: {
    name?: string
    version?: string
  }
}

export interface X402Response<T> {
  success: boolean
  data?: T
  error?: string
  paymentTx?: string
}

export function useX402() {
  const [isPaying, setIsPaying] = useState(false)
  const [lastPaymentTx, setLastPaymentTx] = useState<string | null>(null)

  /**
   * Make a paid request to an x402-protected endpoint
   */
  const paidFetch = useCallback(async <T>(
    url: string,
    options?: RequestInit
  ): Promise<X402Response<T>> => {
    setIsPaying(true)
    setLastPaymentTx(null)

    try {
      // Step 1: Make initial request
      const initialResponse = await fetch(url, options)

      // If not 402, return the response directly
      if (initialResponse.status !== 402) {
        if (initialResponse.ok) {
          const data = await initialResponse.json()
          return { success: true, data }
        } else {
          const error = await initialResponse.text()
          return { success: false, error }
        }
      }

      // Step 2: Extract payment requirements from 402 response
      const paymentRequiredHeader = initialResponse.headers.get('payment-required')
      if (!paymentRequiredHeader) {
        return { success: false, error: 'Missing payment-required header' }
      }

      // Decode base64 header
      const paymentRequired = JSON.parse(atob(paymentRequiredHeader))
      console.log('Payment required:', paymentRequired)

      // Get the payment requirements (accepts array)
      const accepts = paymentRequired.accepts
      if (!accepts || accepts.length === 0) {
        return { success: false, error: 'No payment options available' }
      }

      // Select first option (Arc USDC)
      const requirements: PaymentRequirements = accepts[0]

      // Step 3: Sign the payment
      if (!DEMO_WALLET_KEY) {
        return { success: false, error: 'No wallet configured (set NEXT_PUBLIC_ARC_WALLET_KEY in .env.local)' }
      }

      const account = privateKeyToAccount(DEMO_WALLET_KEY as `0x${string}`)
      const client = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http(),
      }).extend(publicActions)

      // Parse amount (remove $ prefix if present, convert to 6 decimals)
      const priceStr = requirements.maxAmountRequired || '0.01'
      const priceNum = parseFloat(priceStr.replace('$', ''))
      const amount = BigInt(Math.floor(priceNum * 1_000_000)) // 6 decimals

      const now = Math.floor(Date.now() / 1000)
      const validAfter = BigInt(0)
      const validBefore = BigInt(now + 3600) // 1 hour
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))

      console.log('Signing payment:', {
        from: account.address,
        to: requirements.payTo,
        amount: amount.toString(),
      })

      const signature = await client.signTypedData({
        domain,
        types: authorizationTypes,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: account.address,
          to: requirements.payTo as `0x${string}`,
          value: amount,
          validAfter,
          validBefore,
          nonce,
        },
      })

      // Step 4: Build payment payload (must match x402 expected format)
      const paymentPayload = {
        x402Version: 2,
        resource: paymentRequired.resource,
        accepted: requirements,
        payload: {
          signature,
          authorization: {
            from: account.address,
            to: requirements.payTo,
            value: amount.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      }

      // Step 5: Retry request with payment header (base64 encode the payload)
      const paidResponse = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'payment-signature': btoa(JSON.stringify(paymentPayload)),
        },
      })

      // Decode settlement response (x402 v2 uses payment-response header)
      const paymentResponseHeader = paidResponse.headers.get('payment-response')
      let settleTx: string | null = null

      if (paymentResponseHeader) {
        try {
          const paymentResponse = JSON.parse(atob(paymentResponseHeader))
          settleTx = paymentResponse.transaction
          if (settleTx) {
            setLastPaymentTx(settleTx)
            console.log('💸 Payment settled:', settleTx)
          }
        } catch (error) {
          console.error('Failed to decode payment-response header:', error)
        }
      }

      if (paidResponse.ok) {
        const data = await paidResponse.json()
        return { success: true, data, paymentTx: settleTx || undefined }
      } else {
        const error = await paidResponse.text()
        return { success: false, error }
      }
    } catch (error) {
      console.error('x402 payment error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      }
    } finally {
      setIsPaying(false)
    }
  }, [])

  return {
    paidFetch,
    isPaying,
    lastPaymentTx,
  }
}
