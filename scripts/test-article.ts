/**
 * Test article x402 paywall from CLI
 *
 * Tests the full payment flow:
 * 1. GET article -> 402
 * 2. Sign payment
 * 3. Retry with payment -> article content
 */

import { createWalletClient, http, publicActions, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../src/lib/arc";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_URL = "http://localhost:3002/api/article/arc-blockchain-guide";
const DEMO_KEY = process.env.NEXT_PUBLIC_ARC_WALLET_KEY;

if (!DEMO_KEY) {
  console.error("❌ NEXT_PUBLIC_ARC_WALLET_KEY not set");
  process.exit(1);
}

// EIP-3009 types
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

// EIP-712 domain
const domain = {
  name: "USDC",
  version: "2",
  chainId: arcTestnet.id,
  verifyingContract: "0x3600000000000000000000000000000000000000" as `0x${string}`,
};

async function testArticlePayment() {
  console.log("🧪 Testing article x402 payment...\n");

  // Step 1: Initial request (should return 402)
  console.log("1️⃣ Making initial request...");
  const initialRes = await fetch(API_URL);
  console.log(`   Status: ${initialRes.status}`);

  if (initialRes.status !== 402) {
    console.error("❌ Expected 402, got", initialRes.status);
    const text = await initialRes.text();
    console.log(text);
    return;
  }

  // Step 2: Extract payment requirements
  console.log("\n2️⃣ Extracting payment requirements...");
  const paymentRequiredHeader = initialRes.headers.get("payment-required");
  if (!paymentRequiredHeader) {
    console.error("❌ Missing payment-required header");
    return;
  }

  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString()
  );
  console.log("   Resource:", paymentRequired.resource);

  const accepts = paymentRequired.accepts;
  if (!accepts || accepts.length === 0) {
    console.error("❌ No payment options available");
    return;
  }

  const requirements = accepts[0];
  console.log("   Network:", requirements.network);
  console.log("   Pay to:", requirements.payTo);
  console.log("   Price:", requirements.price || requirements.maxAmountRequired);

  // Step 3: Sign payment
  console.log("\n3️⃣ Signing payment...");
  const account = privateKeyToAccount(DEMO_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  }).extend(publicActions);

  console.log("   From:", account.address);

  const priceStr = requirements.maxAmountRequired || requirements.price || "0.01";
  const priceNum = parseFloat(priceStr.replace("$", ""));
  const amount = BigInt(Math.floor(priceNum * 1_000_000)); // 6 decimals

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

  console.log("   ✓ Signature:", signature.slice(0, 20) + "...");

  // Step 4: Build payment payload
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

  // Step 5: Retry with payment
  console.log("\n4️⃣ Retrying with payment signature...");
  const paidRes = await fetch(API_URL, {
    headers: {
      "payment-signature": Buffer.from(JSON.stringify(paymentPayload)).toString(
        "base64"
      ),
    },
  });

  console.log(`   Status: ${paidRes.status}`);

  // Decode payment response
  const paymentResponseHeader = paidRes.headers.get("payment-response");
  let tx: string | null = null;

  if (paymentResponseHeader) {
    const paymentResponse = JSON.parse(
      Buffer.from(paymentResponseHeader, "base64").toString()
    );
    tx = paymentResponse.transaction;
  }

  if (paidRes.ok) {
    const article = await paidRes.json();
    console.log("\n✅ Payment successful!\n");
    console.log("📰 Article:", article.title);
    console.log("👤 Author:", article.author);
    console.log("📅 Published:", article.publishedAt);
    console.log("\n📄 Content:");
    console.log(article.content);

    if (tx) {
      console.log("\n💸 Transaction:", tx);
      console.log("🔗 View on Arcscan:");
      console.log(`   https://testnet.arcscan.app/tx/${tx}`);
    }
  } else {
    const error = await paidRes.text();
    console.error("\n❌ Payment failed:", error);
  }
}

testArticlePayment().catch(console.error);
