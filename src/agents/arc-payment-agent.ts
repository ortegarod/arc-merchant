/**
 * Arc Payment Agent
 *
 * AI agent with autonomous payment capabilities using Circle
 * Developer-Controlled Wallets on Arc blockchain.
 *
 * Built with Vercel AI SDK + Google Gemini
 *
 * Usage:
 *   import { runAgent } from './arc-payment-agent';
 *   const result = await runAgent("Create a wallet and check its balance");
 */

import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { toHex } from 'viem';
import {
  createAgentWallet,
  getWalletBalance,
  listWallets,
  getWallet,
  requestTestnetTokens,
  transferUSDC,
  signPaymentAuthorization,
  circleClient,
} from '../lib/circle-wallet.js';
import { ARC_CONTRACTS } from '../lib/arc.js';

// Tool definitions
const arcTools = {
  arc_create_wallet: tool({
    description:
      'Create or get existing Circle Developer-Controlled Wallet for an AI agent on Arc blockchain. Returns wallet ID and address.',
    inputSchema: z.object({
      agent_id: z.string().describe('Unique identifier for the AI agent (e.g., "research-bot-1")'),
    }),
    execute: async ({ agent_id }) => {
      const wallet = await createAgentWallet(agent_id);
      return {
        success: true,
        wallet_id: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        message: `Wallet ready for ${agent_id}`,
      };
    },
  }),

  arc_get_balance: tool({
    description: 'Get USDC and EURC token balances for a Circle wallet on Arc blockchain.',
    inputSchema: z.object({
      wallet_id: z.string().describe('Circle wallet ID (returned from arc_create_wallet)'),
    }),
    execute: async ({ wallet_id }) => {
      const balances = await getWalletBalance(wallet_id);
      const formatted = balances.map((b: any) => ({
        token: b.token?.symbol || 'Unknown',
        amount: b.amount || '0',
      }));
      return {
        success: true,
        wallet_id,
        balances: formatted,
      };
    },
  }),

  arc_list_wallets: tool({
    description: 'List all Circle wallets. Shows wallet IDs, addresses, and blockchains.',
    inputSchema: z.object({}),
    execute: async () => {
      const wallets = await listWallets();
      return {
        success: true,
        count: wallets.length,
        wallets: wallets.map((w: any) => ({
          id: w.id,
          address: w.address,
          blockchain: w.blockchain,
          state: w.state,
          accountType: w.accountType,
        })),
      };
    },
  }),

  arc_get_wallet: tool({
    description: 'Get details for a specific Circle wallet by ID.',
    inputSchema: z.object({
      wallet_id: z.string().describe('Circle wallet ID'),
    }),
    execute: async ({ wallet_id }) => {
      const wallet = await getWallet(wallet_id);
      if (!wallet) {
        return { success: false, error: `Wallet ${wallet_id} not found` };
      }
      return {
        success: true,
        wallet: {
          id: wallet.id,
          address: wallet.address,
          blockchain: wallet.blockchain,
          state: wallet.state,
          createDate: wallet.createDate,
        },
      };
    },
  }),

  arc_request_testnet_tokens: tool({
    description:
      'Request testnet tokens (USDC, EURC, native) from Circle faucet. Funds your wallet directly.',
    inputSchema: z.object({
      address: z.string().describe('Wallet address to fund (0x...)'),
      usdc: z.boolean().default(true).describe('Request USDC tokens'),
      eurc: z.boolean().default(false).describe('Request EURC tokens'),
      native: z.boolean().default(false).describe('Request native tokens'),
    }),
    execute: async ({ address, usdc, eurc, native }) => {
      await requestTestnetTokens(address, { usdc, eurc, native });
      const tokensRequested = [];
      if (usdc) tokensRequested.push('USDC');
      if (eurc) tokensRequested.push('EURC');
      if (native) tokensRequested.push('native');
      return {
        success: true,
        address,
        tokens_requested: tokensRequested,
        message: `Testnet tokens requested for ${address}. May take a moment to arrive.`,
      };
    },
  }),

  arc_transfer: tool({
    description:
      'Transfer USDC to another address on Arc blockchain. This is a direct on-chain transfer.',
    inputSchema: z.object({
      from_address: z.string().describe('Sender wallet address (0x...)'),
      to_address: z.string().describe('Recipient address (0x...)'),
      amount: z.string().describe('Amount to send in USDC (e.g., "1.50")'),
    }),
    execute: async ({ from_address, to_address, amount }) => {
      const result = await transferUSDC(from_address, to_address, amount);
      return {
        success: true,
        from: from_address,
        to: to_address,
        amount: `${amount} USDC`,
        transaction_id: result?.id,
        state: result?.state,
        message: `Transfer initiated. Transaction ID: ${result?.id}`,
      };
    },
  }),

  arc_get_transaction: tool({
    description: 'Get transaction details and explorer link for an Arc blockchain transaction.',
    inputSchema: z.object({
      tx_hash: z.string().describe('Transaction hash (0x...)'),
    }),
    execute: async ({ tx_hash }) => {
      return {
        success: true,
        transaction: tx_hash,
        explorer_url: `https://testnet.arcscan.app/tx/${tx_hash}`,
        message: 'View transaction details on Arc Explorer',
      };
    },
  }),

  arc_pay_for_content: tool({
    description:
      'Autonomously pay for paywalled content using x402 protocol. Handles the full payment flow: request content, receive 402 Payment Required, sign payment via Circle SDK, retry with payment signature, return content.',
    inputSchema: z.object({
      wallet_id: z.string().describe('Circle wallet ID to pay from'),
      url: z.string().describe('URL of the paywalled resource'),
      max_price: z.string().default('1.00').describe('Maximum price willing to pay in USDC (e.g., "0.01")'),
    }),
    execute: async ({ wallet_id, url, max_price }) => {
      const maxPriceUSDC = parseFloat(max_price || '1.00');

      // Get wallet info
      const walletsResponse = await circleClient.listWallets({});
      const wallet = walletsResponse.data?.wallets?.find((w: any) => w.id === wallet_id);
      if (!wallet) {
        return { success: false, error: `Wallet ${wallet_id} not found` };
      }

      // Initial request (expect 402)
      const initialRes = await fetch(url);
      if (initialRes.status !== 402) {
        const content = await initialRes.text();
        return {
          success: true,
          paid: false,
          content,
          message: 'Resource was not paywalled - no payment needed',
        };
      }

      // Extract payment requirements
      const paymentRequiredHeader = initialRes.headers.get('payment-required');
      if (!paymentRequiredHeader) {
        return { success: false, error: 'Missing payment-required header' };
      }

      const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString());
      const accepts = paymentRequired.accepts;
      if (!accepts || accepts.length === 0) {
        return { success: false, error: 'No payment options available' };
      }

      const requirements = accepts[0];

      // Calculate amount
      let amount: bigint;
      if (requirements.amount) {
        amount = BigInt(requirements.amount);
      } else {
        const priceStr = requirements.maxAmountRequired || requirements.price || '$0.01';
        const priceNum = parseFloat(priceStr.replace('$', ''));
        if (priceNum > maxPriceUSDC) {
          return {
            success: false,
            error: `Price ${priceNum} USDC exceeds max_price ${maxPriceUSDC} USDC`,
          };
        }
        amount = BigInt(Math.floor(priceNum * 1_000_000));
      }

      // Prepare authorization
      const now = Math.floor(Date.now() / 1000);
      const validAfter = BigInt(0);
      const validBefore = BigInt(now + 3600);
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
      const usdcContract = (requirements.asset || ARC_CONTRACTS.USDC) as `0x${string}`;

      // Sign via Circle SDK
      const signature = await signPaymentAuthorization(
        wallet_id,
        wallet.address as `0x${string}`,
        requirements.payTo as `0x${string}`,
        amount,
        validAfter,
        validBefore,
        nonce,
        usdcContract
      );

      // Build payment payload
      const paymentPayload = {
        x402Version: 2,
        resource: paymentRequired.resource,
        accepted: requirements,
        payload: {
          signature,
          authorization: {
            from: wallet.address,
            to: requirements.payTo,
            value: amount.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      };

      // Retry with payment
      const paidRes = await fetch(url, {
        headers: {
          'payment-signature': Buffer.from(JSON.stringify(paymentPayload)).toString('base64'),
        },
      });

      // Extract transaction hash
      const paymentResponseHeader = paidRes.headers.get('payment-response');
      let txHash: string | null = null;
      if (paymentResponseHeader) {
        const paymentResponse = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString());
        txHash = paymentResponse.transaction;
      }

      if (!paidRes.ok) {
        const errorText = await paidRes.text();
        return { success: false, error: `Payment failed: ${paidRes.status} - ${errorText}` };
      }

      const content = await paidRes.text();
      const priceUSDC = Number(amount) / 1_000_000;

      return {
        success: true,
        paid: true,
        price_usdc: priceUSDC,
        transaction: txHash,
        explorer_url: txHash ? `https://testnet.arcscan.app/tx/${txHash}` : null,
        content: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
        full_content_length: content.length,
      };
    },
  }),
};

// Agent configuration
export interface AgentConfig {
  model?: string;
  maxSteps?: number;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI agent with autonomous payment capabilities on the Arc blockchain.

You can:
- Create and manage Circle Developer-Controlled Wallets
- Check wallet balances (USDC, EURC)
- Request testnet tokens from the faucet
- Transfer USDC to other addresses
- Pay for paywalled content using the x402 protocol

When asked to pay for content, use arc_pay_for_content with the wallet_id and URL.
Always confirm payment amounts before executing transfers.`;

/**
 * Run the Arc Payment Agent
 *
 * @param prompt - User message/instruction
 * @param config - Optional agent configuration
 * @returns Agent response text and tool results
 */
export async function runAgent(prompt: string, config: AgentConfig = {}) {
  const {
    model = 'gemini-2.0-flash',
    maxSteps = 10,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = config;

  const result = await generateText({
    model: google(model),
    tools: arcTools,
    stopWhen: stepCountIs(maxSteps),
    system: systemPrompt,
    prompt,
  });

  return {
    text: result.text,
    toolResults: result.toolResults,
    steps: result.steps,
    usage: result.usage,
  };
}

/**
 * Stream the Arc Payment Agent response
 *
 * @param prompt - User message/instruction
 * @param config - Optional agent configuration
 */
export async function streamAgent(prompt: string, config: AgentConfig = {}) {
  const { streamText } = await import('ai');

  const {
    model = 'gemini-2.0-flash',
    maxSteps = 10,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = config;

  return streamText({
    model: google(model),
    tools: arcTools,
    stopWhen: stepCountIs(maxSteps),
    system: systemPrompt,
    prompt,
  });
}

// Export tools for custom agent implementations
export { arcTools };
