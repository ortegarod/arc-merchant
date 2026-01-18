/**
 * Test x402 payment on Arc
 *
 * This script:
 * 1. Signs an EIP-3009 payment authorization
 * 2. Sends it to the facilitator for verification
 * 3. Settles the payment on-chain
 */

import { createWalletClient, http, publicActions, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_CONTRACTS } from "../src/lib/arc";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4022";
const PAYER_KEY = process.env.ARC_WALLET_KEY;

if (!PAYER_KEY) {
  console.error("❌ ARC_WALLET_KEY required in .env.local");
  process.exit(1);
}

// Default receiver is the same wallet (self-payment for testing)
const payerAccount = privateKeyToAccount(PAYER_KEY as `0x${string}`);
const RECEIVER = process.env.RECEIVER_ADDRESS || payerAccount.address;

// EIP-3009 types for signing
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

async function main() {
  console.log("\n🧪 x402 Payment Test on Arc\n");

  // Setup payer wallet
  const payerAccount = privateKeyToAccount(PAYER_KEY as `0x${string}`);
  const client = createWalletClient({
    account: payerAccount,
    chain: arcTestnet,
    transport: http(),
  }).extend(publicActions);

  console.log(`📤 Payer:    ${payerAccount.address}`);
  console.log(`📥 Receiver: ${RECEIVER}`);

  // Check balance
  const balance = await client.getBalance({ address: payerAccount.address });
  console.log(`💰 Balance:  ${Number(balance) / 1e18} USDC (native)\n`);

  // Payment amount: 0.01 USDC (6 decimals for ERC-20 interface)
  const amount = 10000n; // 0.01 USDC
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0n;
  const validBefore = BigInt(now + 3600); // 1 hour from now

  // Random nonce
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  console.log(`💵 Amount: ${Number(amount) / 1e6} USDC`);

  // EIP-712 domain for Arc USDC
  const domain = {
    name: "USDC",
    version: "2",
    chainId: arcTestnet.id,
    verifyingContract: ARC_CONTRACTS.USDC,
  };

  // Sign EIP-3009 authorization
  console.log("\n✍️  Signing payment authorization...");

  const signature = await client.signTypedData({
    domain,
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: payerAccount.address,
      to: RECEIVER as `0x${string}`,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    },
  });

  console.log(`   Signature: ${signature.slice(0, 20)}...`);

  // Build payment payload (x402 format)
  const paymentPayload = {
    x402Version: 2,
    resource: {
      url: "http://localhost:3000/api/test",
      description: "Test payment",
      mimeType: "application/json",
    },
    accepted: {
      scheme: "exact",
      network: "eip155:5042002",
      asset: ARC_CONTRACTS.USDC,
      amount: amount.toString(),
      payTo: RECEIVER,
      maxTimeoutSeconds: 3600,
      extra: {
        name: "USDC",
        version: "2",
      },
    },
    payload: {
      signature,
      authorization: {
        from: payerAccount.address,
        to: RECEIVER,
        value: amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  const paymentRequirements = paymentPayload.accepted;

  // Step 1: Verify with facilitator
  console.log("\n📡 Verifying with facilitator...");

  try {
    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload, paymentRequirements }),
    });

    const verifyResult = await verifyRes.json();
    console.log(`   Valid: ${verifyResult.isValid}`);

    if (!verifyResult.isValid) {
      console.error(`❌ Verification failed: ${verifyResult.invalidReason}`);
      process.exit(1);
    }

    // Step 2: Settle payment
    console.log("\n💸 Settling payment on-chain...");

    const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload, paymentRequirements }),
    });

    const settleResult = await settleRes.json();

    if (settleResult.success) {
      console.log(`\n✅ Payment successful!`);
      console.log(`   TX: ${settleResult.transaction}`);
      console.log(`   View: https://testnet.arcscan.app/tx/${settleResult.transaction}`);
    } else {
      console.error(`❌ Settlement failed: ${settleResult.errorReason}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    console.error("\nMake sure the facilitator is running: npm run facilitator");
  }
}

main();
