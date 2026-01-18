/**
 * Test the x402 UI flow end-to-end
 *
 * Mimics what the browser does:
 * 1. GET /api/premium -> 402
 * 2. Parse payment requirements
 * 3. Sign payment
 * 4. Retry with X-PAYMENT header
 */

import { createWalletClient, http, publicActions, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_CONTRACTS } from "../src/lib/arc";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_URL = "http://localhost:3002/api/premium";
const WALLET_KEY = process.env.ARC_WALLET_KEY;

if (!WALLET_KEY) {
  console.error("❌ ARC_WALLET_KEY required");
  process.exit(1);
}

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

const domain = {
  name: "USDC",
  version: "2",
  chainId: arcTestnet.id,
  verifyingContract: ARC_CONTRACTS.USDC,
};

async function main() {
  console.log("\n🧪 Testing x402 UI Flow\n");

  // Step 1: Initial request (should get 402)
  console.log("1️⃣  Making initial request to /api/premium...");
  const initialRes = await fetch(API_URL);

  if (initialRes.status !== 402) {
    console.error(`❌ Expected 402, got ${initialRes.status}`);
    process.exit(1);
  }

  console.log("✅ Got 402 Payment Required");

  // Step 2: Parse payment requirements
  const paymentRequiredHeader = initialRes.headers.get("payment-required");
  if (!paymentRequiredHeader) {
    console.error("❌ Missing payment-required header");
    process.exit(1);
  }

  console.log("\n2️⃣  Parsing payment requirements...");
  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString()
  );

  console.log(`   Price: ${paymentRequired.accepts[0].amount} (raw units)`);
  console.log(`   Pay to: ${paymentRequired.accepts[0].payTo}`);

  const requirements = paymentRequired.accepts[0];

  // Step 3: Sign payment
  console.log("\n3️⃣  Signing payment...");

  const account = privateKeyToAccount(WALLET_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  }).extend(publicActions);

  console.log(`   From: ${account.address}`);

  const amount = BigInt(requirements.amount);
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(0);
  const validBefore = BigInt(now + 3600);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  const signature = await client.signTypedData({
    domain,
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: account.address,
      to: requirements.payTo as `0x${string}`,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    },
  });

  console.log(`   Signature: ${signature.slice(0, 20)}...`);

  // Step 4: Build payment payload (matching x402 expected format)
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
  };

  // Step 5: Retry with payment (base64 encode the payload)
  console.log("\n4️⃣  Retrying with payment-signature header...");

  const paidRes = await fetch(API_URL, {
    headers: {
      "payment-signature": Buffer.from(JSON.stringify(paymentPayload)).toString("base64"),
    },
  });

  console.log(`   Status: ${paidRes.status}`);

  if (paidRes.ok) {
    const result = await paidRes.json();

    // Decode payment-response header (x402 v2 protocol)
    const paymentResponseHeader = paidRes.headers.get("payment-response");
    let tx: string | null = null;

    if (paymentResponseHeader) {
      const paymentResponse = JSON.parse(Buffer.from(paymentResponseHeader, "base64").toString());
      tx = paymentResponse.transaction;
    }

    console.log("\n✅ Payment successful!");
    console.log(`   Insight: "${result.insight}"`);
    if (tx) {
      console.log(`   TX: ${tx}`);
      console.log(`   View: https://testnet.arcscan.app/tx/${tx}`);
    }
  } else {
    const error = await paidRes.text();
    console.error(`\n❌ Payment failed: ${error}`);
  }
}

main().catch(console.error);
