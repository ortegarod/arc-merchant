import { google } from '@ai-sdk/google'
import {
  convertToModelMessages,
  streamText,
  tool,
  UIMessage,
  validateUIMessages,
  InferUITools,
  UIDataTypes,
} from 'ai'
import { createPublicClient, http, formatUnits, isAddress } from 'viem'
import { z } from 'zod'
import { arcTestnet, ARC_CONTRACTS, ERC20_ABI } from '@/lib/arc'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

// Create a public client for reading from Arc
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
})

const getBalanceTool = tool({
  description: 'Get the USDC or EURC balance of an address on Arc',
  inputSchema: z.object({
    address: z.string().describe('The wallet address to check'),
    token: z.enum(['USDC', 'EURC']).default('USDC').describe('Which token to check'),
  }),
  async *execute({ address, token }) {
    yield { state: 'loading' as const }

    if (!isAddress(address)) {
      yield { state: 'error' as const, error: 'Invalid address format' }
      return
    }

    try {
      const tokenAddress = token === 'USDC' ? ARC_CONTRACTS.USDC : ARC_CONTRACTS.EURC

      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      })

      // Both USDC and EURC have 6 decimals
      const formatted = formatUnits(balance, 6)

      yield {
        state: 'ready' as const,
        address,
        token,
        balance: formatted,
      }
    } catch (error) {
      yield { state: 'error' as const, error: `Failed to fetch balance: ${error}` }
    }
  },
})

const prepareTransferTool = tool({
  description: 'Prepare a USDC transfer transaction. Returns the transaction details for the user to sign.',
  inputSchema: z.object({
    to: z.string().describe('Recipient address'),
    amount: z.string().describe('Amount to send (e.g., "10.50")'),
  }),
  async *execute({ to, amount }) {
    yield { state: 'loading' as const }

    if (!isAddress(to)) {
      yield { state: 'error' as const, error: 'Invalid recipient address' }
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      yield { state: 'error' as const, error: 'Invalid amount' }
      return
    }

    // Convert to 6 decimals (USDC)
    const amountInSmallestUnit = BigInt(Math.floor(parsedAmount * 1_000_000))

    yield {
      state: 'ready' as const,
      type: 'transfer',
      token: 'USDC',
      to,
      amount,
      amountRaw: amountInSmallestUnit.toString(),
      contractAddress: ARC_CONTRACTS.USDC,
    }
  },
})

const tools = {
  getBalance: getBalanceTool,
  prepareTransfer: prepareTransferTool,
} as const

export type ArcMoneyManagerMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>

export async function POST(req: Request) {
  const body = await req.json()
  const userAddress = body.userAddress || 'not connected'

  const messages = await validateUIMessages<ArcMoneyManagerMessage>({
    messages: body.messages,
    tools,
  })

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: `You are an AI money manager assistant on Arc blockchain. Arc uses USDC as its native gas token - all transactions are paid in USDC.

The user's wallet address is: ${userAddress}

You can help users:
- Check their USDC balance using the getBalance tool
- Check their EURC balance using the getBalance tool
- Prepare USDC transfers using the prepareTransfer tool (the user will sign and submit)
- Explain Arc blockchain and how USDC-native gas works

Be concise and helpful. When users want to send money, use the prepareTransfer tool to build the transaction details. The user will need to approve and sign it in their wallet.

Format currency amounts nicely (e.g., "125.50 USDC" not "125500000").`,
    messages: await convertToModelMessages(messages),
    tools,
  })

  return result.toUIMessageStreamResponse()
}
