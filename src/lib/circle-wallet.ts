/**
 * Circle Developer-Controlled Wallets SDK Integration
 *
 * Creates and manages wallets for AI agents to autonomously
 * pay for content via x402 micropayments on Arc blockchain.
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey || !entitySecret) {
  throw new Error('Missing Circle credentials: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET required');
}

// Initialize Circle client
export const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey,
  entitySecret,
});

/**
 * Create or get existing wallet for an AI agent
 *
 * Checks if a wallet already exists for this agent before creating a new one.
 */
export async function createAgentWallet(agentId: string) {
  // Check if wallet already exists on ARC-TESTNET
  const existingWallets = await listWallets();
  const arcWallet = existingWallets.find(
    (w: any) => w.blockchain === 'ARC-TESTNET' && w.accountType === 'EOA'
  );

  if (arcWallet) {
    console.log(`Using existing wallet for ${agentId}`);
    console.log(`   Address: ${arcWallet.address}`);
    console.log(`   Wallet ID: ${arcWallet.id}`);
    return {
      id: arcWallet.id,
      address: arcWallet.address as `0x${string}`,
      blockchain: arcWallet.blockchain,
    };
  }

  // No existing wallet - create new one
  // Step 1: Create wallet set
  let walletSetId: string;

  try {
    const walletSetResponse = await circleClient.createWalletSet({
      name: `${agentId}-walletset`,
    });

    if (!walletSetResponse.data?.walletSet?.id) {
      throw new Error('Failed to create wallet set');
    }

    walletSetId = walletSetResponse.data.walletSet.id;
    console.log(`Created wallet set: ${walletSetId}`);
  } catch (error: any) {
    throw new Error(`Failed to create wallet set: ${error.message}`);
  }

  // Step 2: Create wallet in the set
  const response = await circleClient.createWallets({
    accountType: 'EOA', // Externally Owned Account (no deployment needed)
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
  });

  if (!response.data?.wallets?.[0]) {
    throw new Error('Failed to create wallet');
  }

  const wallet = response.data.wallets[0];

  console.log(`✅ Created wallet for agent ${agentId}`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Wallet ID: ${wallet.id}`);

  return {
    id: wallet.id,
    address: wallet.address as `0x${string}`,
    blockchain: wallet.blockchain,
  };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(walletId: string) {
  const response = await circleClient.getWalletTokenBalance({
    id: walletId,
  });

  return response.data?.tokenBalances || [];
}

/**
 * Sign an EIP-3009 authorization for x402 payment
 *
 * This allows the AI agent to authorize USDC transfers
 * without holding the private key directly.
 */
export async function signPaymentAuthorization(
  walletId: string,
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint,
  validAfter: bigint,
  validBefore: bigint,
  nonce: `0x${string}`,
  usdcContract: `0x${string}`,
) {
  // Build EIP-712 typed data for TransferWithAuthorization
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    domain: {
      name: 'USDC',
      version: '2',
      chainId: 5042002, // Arc testnet
      verifyingContract: usdcContract,
    },
    message: {
      from,
      to,
      value: value.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    },
  };

  // Sign via Circle SDK
  try {
    const response = await circleClient.signTypedData({
      walletId,
      data: JSON.stringify(typedData),
    });

    if (!response.data?.signature) {
      throw new Error('Failed to sign payment authorization');
    }

    return response.data.signature as `0x${string}`;
  } catch (error: any) {
    console.error('Circle signTypedData error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

/**
 * List all wallets for debugging
 */
export async function listWallets() {
  const response = await circleClient.listWallets({});
  return response.data?.wallets || [];
}
