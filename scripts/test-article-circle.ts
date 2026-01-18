/**
 * Test article x402 paywall with Circle Developer-Controlled Wallets
 *
 * Demonstrates AI agents autonomously paying for content using
 * Circle-managed wallets on Arc blockchain.
 */

import { toHex } from "viem";
import {
  createAgentWallet,
  signPaymentAuthorization,
  getWalletBalance,
} from "../src/lib/circle-wallet";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_URL = "http://localhost:3002/api/article/arc-blockchain-guide";

async function testArticlePaymentWithCircle() {
  console.log("🧪 Testing article x402 payment with Circle Wallets...\n");

  // Step 1: Get or create Circle wallet (will reuse existing)
  console.log("1️⃣ Setting up Circle wallet for AI agent...");
  const wallet = await createAgentWallet("ai-agent-x402");
  console.log(`   ✓ Wallet ID: ${wallet.id}`);
  console.log(`   ✓ Address: ${wallet.address}`);

  // Check balance
  const balances = await getWalletBalance(wallet.id);
  console.log(`   ✓ Balances:`, balances.length > 0 ? balances : "No tokens yet");

  // Step 2: Initial request (should return 402)
  console.log("\n2️⃣ Making initial request...");
  const initialRes = await fetch(API_URL);
  console.log(`   Status: ${initialRes.status}`);

  if (initialRes.status !== 402) {
    console.error("❌ Expected 402, got", initialRes.status);
    const text = await initialRes.text();
    console.log(text);
    return;
  }

  // Step 3: Extract payment requirements
  console.log("\n3️⃣ Extracting payment requirements...");
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
  console.log("   Amount:", requirements.amount || requirements.price || requirements.maxAmountRequired);

  // Step 4: Calculate amount and prepare authorization
  console.log("\n4️⃣ Preparing payment authorization...");
  console.log("   From (Circle wallet):", wallet.address);

  // Handle amount - check if it's already in raw units
  let amount: bigint;
  if (requirements.amount) {
    // Amount already in raw units (e.g., "10000" = 0.01 USDC)
    amount = BigInt(requirements.amount);
  } else {
    // Parse from price string (e.g., "$0.01")
    const priceStr = requirements.maxAmountRequired || requirements.price || "$0.01";
    const priceNum = parseFloat(priceStr.replace("$", ""));
    amount = BigInt(Math.floor(priceNum * 1_000_000)); // 6 decimals for USDC
  }

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(0);
  const validBefore = BigInt(now + 3600);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  console.log("   Amount (raw):", amount.toString());

  // Step 5: Sign via Circle SDK
  console.log("\n5️⃣ Signing payment with Circle SDK...");
  const usdcContract = requirements.asset as `0x${string}`;

  const signature = await signPaymentAuthorization(
    wallet.id,
    wallet.address,
    requirements.payTo as `0x${string}`,
    amount,
    validAfter,
    validBefore,
    nonce,
    usdcContract,
  );

  console.log("   ✓ Signature:", signature.slice(0, 20) + "...");

  // Step 6: Build payment payload
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

  // Step 7: Retry with payment
  console.log("\n6️⃣ Retrying with Circle-signed payment...");
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
    console.log("\n✅ Payment successful via Circle Wallet!\n");
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

    console.log("\n🎉 This payment was signed by Circle's infrastructure!");
    console.log("   AI agents can now autonomously pay for content");
    console.log("   using Circle Developer-Controlled Wallets.");
  } else {
    const errorText = await paidRes.text();
    console.error("\n❌ Payment failed");
    console.error("   Status:", paidRes.status);
    console.error("   Body:", errorText);
    console.error("   Headers:", Object.fromEntries(paidRes.headers.entries()));
  }
}

testArticlePaymentWithCircle().catch(console.error);
