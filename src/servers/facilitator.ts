/**
 * Arc x402 Facilitator Server
 *
 * Based on x402 example: x402/examples/typescript/facilitator
 * Verifies and settles x402 payments on Arc testnet.
 */

import { x402Facilitator } from "@x402/core/facilitator";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import dotenv from "dotenv";
import express from "express";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../lib/arc";

dotenv.config({ path: ".env.local" });

const PORT = process.env.PORT || "4022";
const ARC_NETWORK = "eip155:5042002";

if (!process.env.ARC_WALLET_KEY) {
  console.error("❌ ARC_WALLET_KEY environment variable is required");
  process.exit(1);
}

// Initialize account from private key
const account = privateKeyToAccount(process.env.ARC_WALLET_KEY as `0x${string}`);
console.log(`🔑 Facilitator wallet: ${account.address}`);

// Create viem client
const viemClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(),
}).extend(publicActions);

// Create EVM signer
const evmSigner = toFacilitatorEvmSigner({
  getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
  address: account.address,
  readContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) =>
    viemClient.readContract({
      ...args,
      args: args.args || [],
    }),
  verifyTypedData: (args: {
    address: `0x${string}`;
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
    signature: `0x${string}`;
  }) => viemClient.verifyTypedData(args as any),
  writeContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) =>
    viemClient.writeContract({
      ...args,
      args: args.args || [],
    }),
  sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
    viemClient.sendTransaction(args),
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
    viemClient.waitForTransactionReceipt(args),
});

// Initialize facilitator with hooks
const facilitator = new x402Facilitator()
  .onBeforeVerify(async (context) => {
    console.log("📝 Verifying payment...", context);
  })
  .onAfterVerify(async (context) => {
    console.log("✅ Verified", context);
  })
  .onVerifyFailure(async (context) => {
    console.log("❌ Verify failed", context);
  })
  .onBeforeSettle(async (context) => {
    console.log("💸 Settling...", context);
  })
  .onAfterSettle(async (context) => {
    console.log("✅ Settled", context);
  })
  .onSettleFailure(async (context) => {
    console.log("❌ Settle failed", context);
  });

// Register Arc network
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: ARC_NETWORK,
  deployERC4337WithEIP6492: false,
});

console.log(`📡 Registered network: ${ARC_NETWORK}`);

// Express app
const app = express();
app.use(express.json());

// POST /verify
app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const response: VerifyResponse = await facilitator.verify(
      paymentPayload,
      paymentRequirements
    );
    res.json(response);
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /settle
app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const response: SettleResponse = await facilitator.settle(
      paymentPayload as PaymentPayload,
      paymentRequirements as PaymentRequirements
    );
    res.json(response);
  } catch (error) {
    console.error("Settle error:", error);

    if (error instanceof Error && error.message.includes("Settlement aborted:")) {
      return res.json({
        success: false,
        errorReason: error.message.replace("Settlement aborted: ", ""),
        network: req.body?.paymentPayload?.network || "unknown",
      } as SettleResponse);
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /supported
app.get("/supported", async (req, res) => {
  try {
    const response = facilitator.getSupported();
    res.json(response);
  } catch (error) {
    console.error("Supported error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", network: ARC_NETWORK, wallet: account.address });
});

// Start server
app.listen(parseInt(PORT), () => {
  console.log(`\n🚀 Arc x402 Facilitator running on http://localhost:${PORT}`);
  console.log(`   Network: ${ARC_NETWORK} (Arc Testnet)`);
  console.log(`   Wallet: ${account.address}`);
  console.log(`   Endpoints: POST /verify, POST /settle, GET /supported, GET /health\n`);
});
