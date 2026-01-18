#!/usr/bin/env node
/**
 * Arc Agent Payments MCP Server
 *
 * Enables AI assistants to autonomously pay for content using Circle
 * Developer-Controlled Wallets on Arc blockchain.
 *
 * Tools provided:
 * - arc_create_wallet: Create or get Circle wallet for AI agent
 * - arc_get_balance: Check USDC/EURC balance
 * - arc_pay_for_content: Pay for paywalled resources via x402
 * - arc_get_transaction: View transaction details on Arc
 * - arc_list_wallets: List all Circle wallets
 * - arc_get_wallet: Get details for a specific wallet
 * - arc_request_testnet_tokens: Fund wallet from Circle faucet
 * - arc_transfer: Direct USDC transfer to another address
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { toHex } from 'viem';
import {
  createAgentWallet,
  getWalletBalance,
  signPaymentAuthorization,
  listWallets,
  getWallet,
  requestTestnetTokens,
  transferUSDC,
} from '../lib/circle-wallet.js';
import { ARC_CONTRACTS } from '../lib/arc.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// MCP Server
const server = new Server(
  {
    name: 'arc-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'arc_create_wallet',
    description:
      'Create or get existing Circle Developer-Controlled Wallet for an AI agent on Arc blockchain. Returns wallet ID and address. The wallet is managed by Circle infrastructure - no private keys exposed.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Unique identifier for the AI agent (e.g., "research-bot-1")',
        },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'arc_get_balance',
    description:
      'Get USDC and EURC token balances for a Circle wallet on Arc blockchain.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: {
          type: 'string',
          description: 'Circle wallet ID (returned from arc_create_wallet)',
        },
      },
      required: ['wallet_id'],
    },
  },
  {
    name: 'arc_pay_for_content',
    description:
      'Autonomously pay for paywalled content using x402 protocol. Handles the full payment flow: request content, receive 402 Payment Required, sign payment via Circle SDK, retry with payment signature, return content. Returns both the content and transaction hash.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: {
          type: 'string',
          description: 'Circle wallet ID to pay from',
        },
        url: {
          type: 'string',
          description: 'URL of the paywalled resource',
        },
        max_price: {
          type: 'string',
          description: 'Maximum price willing to pay in USDC (e.g., "0.01")',
          default: '1.00',
        },
      },
      required: ['wallet_id', 'url'],
    },
  },
  {
    name: 'arc_get_transaction',
    description:
      'Get transaction details and explorer link for an Arc blockchain transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        tx_hash: {
          type: 'string',
          description: 'Transaction hash (0x...)',
        },
      },
      required: ['tx_hash'],
    },
  },
  {
    name: 'arc_list_wallets',
    description:
      'List all Circle wallets. Shows wallet IDs, addresses, and blockchains for all wallets in your account.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'arc_get_wallet',
    description:
      'Get details for a specific Circle wallet by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: {
          type: 'string',
          description: 'Circle wallet ID',
        },
      },
      required: ['wallet_id'],
    },
  },
  {
    name: 'arc_request_testnet_tokens',
    description:
      'Request testnet tokens (USDC, EURC, native) from Circle faucet. Funds your wallet directly without leaving Claude Code.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address to fund (0x...)',
        },
        usdc: {
          type: 'boolean',
          description: 'Request USDC tokens (default: true)',
          default: true,
        },
        eurc: {
          type: 'boolean',
          description: 'Request EURC tokens (default: false)',
          default: false,
        },
        native: {
          type: 'boolean',
          description: 'Request native tokens (default: false)',
          default: false,
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'arc_transfer',
    description:
      'Transfer USDC to another address on Arc blockchain. This is a direct on-chain transfer (not x402 payment).',
    inputSchema: {
      type: 'object',
      properties: {
        from_address: {
          type: 'string',
          description: 'Sender wallet address (0x...)',
        },
        to_address: {
          type: 'string',
          description: 'Recipient address (0x...)',
        },
        amount: {
          type: 'string',
          description: 'Amount to send in USDC (e.g., "1.50")',
        },
      },
      required: ['from_address', 'to_address', 'amount'],
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'arc_create_wallet': {
        const { agent_id } = args as { agent_id: string };

        const wallet = await createAgentWallet(agent_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                wallet_id: wallet.id,
                address: wallet.address,
                blockchain: wallet.blockchain,
                message: `Wallet ready for ${agent_id}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_get_balance': {
        const { wallet_id } = args as { wallet_id: string };

        const balances = await getWalletBalance(wallet_id);

        // Format balances for readability
        // Note: Circle SDK returns amount already in human-readable format
        const formatted = balances.map((b: any) => ({
          token: b.token?.symbol || 'Unknown',
          amount: b.amount || '0',
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                wallet_id,
                balances: formatted,
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_pay_for_content': {
        const { wallet_id, url, max_price } = args as {
          wallet_id: string;
          url: string;
          max_price?: string;
        };

        const maxPriceUSDC = parseFloat(max_price || '1.00');

        // Step 1: Get wallet info
        const wallets = await import('../lib/circle-wallet.js').then(m => m.circleClient.listWallets({}));
        const wallet = wallets.data?.wallets?.find((w: any) => w.id === wallet_id);

        if (!wallet) {
          throw new Error(`Wallet ${wallet_id} not found`);
        }

        // Step 2: Initial request (expect 402)
        const initialRes = await fetch(url);

        if (initialRes.status !== 402) {
          // Not a paywalled resource - return content directly
          const content = await initialRes.text();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  paid: false,
                  content,
                  message: 'Resource was not paywalled - no payment needed',
                }, null, 2),
              },
            ],
          };
        }

        // Step 3: Extract payment requirements
        const paymentRequiredHeader = initialRes.headers.get('payment-required');
        if (!paymentRequiredHeader) {
          throw new Error('Missing payment-required header');
        }

        const paymentRequired = JSON.parse(
          Buffer.from(paymentRequiredHeader, 'base64').toString()
        );

        const accepts = paymentRequired.accepts;
        if (!accepts || accepts.length === 0) {
          throw new Error('No payment options available');
        }

        const requirements = accepts[0];

        // Step 4: Calculate amount
        let amount: bigint;
        if (requirements.amount) {
          amount = BigInt(requirements.amount);
        } else {
          const priceStr = requirements.maxAmountRequired || requirements.price || '$0.01';
          const priceNum = parseFloat(priceStr.replace('$', ''));

          // Check against max price
          if (priceNum > maxPriceUSDC) {
            throw new Error(
              `Price ${priceNum} USDC exceeds max_price ${maxPriceUSDC} USDC`
            );
          }

          amount = BigInt(Math.floor(priceNum * 1_000_000)); // 6 decimals for USDC
        }

        // Step 5: Prepare authorization
        const now = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(0);
        const validBefore = BigInt(now + 3600); // 1 hour validity
        const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

        const usdcContract = (requirements.asset || ARC_CONTRACTS.USDC) as `0x${string}`;

        // Step 6: Sign via Circle SDK
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

        // Step 7: Build payment payload
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

        // Step 8: Retry with payment
        const paidRes = await fetch(url, {
          headers: {
            'payment-signature': Buffer.from(JSON.stringify(paymentPayload)).toString('base64'),
          },
        });

        // Step 9: Extract transaction hash
        const paymentResponseHeader = paidRes.headers.get('payment-response');
        let txHash: string | null = null;

        if (paymentResponseHeader) {
          const paymentResponse = JSON.parse(
            Buffer.from(paymentResponseHeader, 'base64').toString()
          );
          txHash = paymentResponse.transaction;
        }

        if (!paidRes.ok) {
          const errorText = await paidRes.text();
          throw new Error(`Payment failed: ${paidRes.status} - ${errorText}`);
        }

        // Step 10: Return content and transaction details
        const content = await paidRes.text();
        const priceUSDC = Number(amount) / 1_000_000;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                paid: true,
                price_usdc: priceUSDC,
                transaction: txHash,
                explorer_url: txHash ? `https://testnet.arcscan.app/tx/${txHash}` : null,
                content: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
                full_content_length: content.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_get_transaction': {
        const { tx_hash } = args as { tx_hash: string };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                transaction: tx_hash,
                explorer_url: `https://testnet.arcscan.app/tx/${tx_hash}`,
                message: 'View transaction details on Arc Explorer',
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_list_wallets': {
        const wallets = await listWallets();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: wallets.length,
                wallets: wallets.map((w: any) => ({
                  id: w.id,
                  address: w.address,
                  blockchain: w.blockchain,
                  state: w.state,
                  accountType: w.accountType,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_get_wallet': {
        const { wallet_id } = args as { wallet_id: string };

        const wallet = await getWallet(wallet_id);

        if (!wallet) {
          throw new Error(`Wallet ${wallet_id} not found`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                wallet: {
                  id: wallet.id,
                  address: wallet.address,
                  blockchain: wallet.blockchain,
                  state: wallet.state,
                  createDate: wallet.createDate,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_request_testnet_tokens': {
        const { address, usdc, eurc, native } = args as {
          address: string;
          usdc?: boolean;
          eurc?: boolean;
          native?: boolean;
        };

        await requestTestnetTokens(address, {
          usdc: usdc ?? true,
          eurc: eurc ?? false,
          native: native ?? false,
        });

        const tokensRequested = [];
        if (usdc ?? true) tokensRequested.push('USDC');
        if (eurc) tokensRequested.push('EURC');
        if (native) tokensRequested.push('native');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                address,
                tokens_requested: tokensRequested,
                message: `Testnet tokens requested for ${address}. May take a moment to arrive.`,
              }, null, 2),
            },
          ],
        };
      }

      case 'arc_transfer': {
        const { from_address, to_address, amount } = args as {
          from_address: string;
          to_address: string;
          amount: string;
        };

        const result = await transferUSDC(from_address, to_address, amount);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                from: from_address,
                to: to_address,
                amount: `${amount} USDC`,
                transaction_id: result?.id,
                state: result?.state,
                message: `Transfer initiated. Transaction ID: ${result?.id}`,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Arc Agent Payments MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
