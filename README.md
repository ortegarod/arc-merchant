# Arc Money Manager

**Circle Developer-Controlled Wallets × x402 Micropayments**

A demonstration of AI agents autonomously paying for content using Circle's wallet infrastructure on Arc blockchain.

## What We Built

**The Problem:** AI agents need to pay for API access and content, but exposing private keys to AI is a security risk.

**The Solution:** Circle Developer-Controlled Wallets enables AI agents to autonomously sign payment authorizations through Circle's secure infrastructure - no private keys in AI code.

### Key Features

- 🤖 **AI Agent Payments** - Agents pay for content without holding private keys
- 🔐 **Circle Infrastructure** - Signatures generated via Circle's Developer-Controlled Wallets SDK
- 💸 **x402 Protocol** - HTTP 402 Payment Required standard for micropayments
- ⚡ **Gasless Transfers** - EIP-3009 USDC authorizations on Arc blockchain
- 🎯 **Instant Settlement** - Arc's sub-second finality

### What Makes This Different

Traditional approach: AI agent holds private key → **SECURITY RISK**

Our approach: AI agent calls Circle SDK → Circle signs → **SECURE**

## 🚀 MCP Server Usage

After completing setup below, use this project as an MCP server to let AI assistants autonomously make payments.

### Available Tools

| Tool | Description |
|------|-------------|
| `arc_create_wallet` | Create or get existing Circle wallet for an AI agent |
| `arc_get_balance` | Check USDC/EURC token balances |
| `arc_list_wallets` | List all Circle wallets in your account |
| `arc_get_wallet` | Get details for a specific wallet |
| `arc_request_testnet_tokens` | Fund wallet from Circle faucet (no website needed) |
| `arc_transfer` | Direct USDC transfer to another address |
| `arc_pay_for_content` | Pay for paywalled content via x402 protocol |
| `arc_get_transaction` | Get transaction details and explorer link |

See **Step 6** in Setup for detailed instructions.

## Tech Stack

- **Arc Testnet** - Circle's L1 blockchain with USDC as native gas
- **x402 Protocol** - HTTP 402 Payment Required standard
- **Next.js 16** - React framework with App Router
- **Viem** - Ethereum library for wallet interactions
- **Gemini AI** - Optional chat interface with blockchain tools

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get Circle API credentials

1. Go to [Circle Developer Console](https://console.circle.com)
2. Create an API Key
3. Save your email (required for hackathon submission)

### 3. Set up Circle Entity Secret (one-time)

```bash
# Add CIRCLE_API_KEY to .env.local first
npm run setup-circle
```

This script:
- Generates a secure 32-byte Entity Secret
- Registers it with Circle's infrastructure
- Downloads recovery file
- Updates `.env.local` automatically

### 4. Configure `.env.local`

The setup script already added your Circle credentials. Additional optional variables:

```bash
# Required (already set by setup script)
CIRCLE_API_KEY=your_api_key_here
CIRCLE_ENTITY_SECRET=auto_generated_by_setup_script

# Required for facilitator (payment settlement)
ARC_WALLET_KEY=0x...  # Your test wallet private key

# Optional - customize ports/URLs
PORT=4022  # Facilitator port (default: 4022)
FACILITATOR_URL=http://localhost:4022  # Default works for local dev

# Optional: Gemini API for web UI chat
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### 5. Create and fund your Circle wallet

**Important**: The MCP tools automatically reuse existing Circle wallets. When you call `arc_create_wallet`, it:
- Checks if you already have an Arc wallet
- Returns the existing wallet if found
- Only creates a new one if none exists

To get your wallet address and fund it:

```bash
# Add MCP server (see step 6 below)
claude mcp add arc-mcp-server -- npm run mcp

# In a Claude Code session, ask:
# "Create a wallet for my-agent and request testnet tokens"
```

The `arc_request_testnet_tokens` tool funds your wallet directly from Circle's faucet - no need to visit a website.

### 6. Add MCP Server to Claude Code

```bash
# Register the MCP server
claude mcp add arc-mcp-server -- npm run mcp
```

This makes the payment tools available in Claude Code sessions. Start a new session and try:
- "Create a wallet and request testnet tokens"
- "Check my balance"
- "Pay for http://localhost:3000/api/article/arc-blockchain-guide"

## Running

**Both servers must be running** for the full demo:

```bash
# Terminal 1: Start facilitator (REQUIRED - settles payments on-chain)
npm run facilitator
# Runs on http://localhost:4022

# Terminal 2: Start Next.js dev server (REQUIRED - serves paywalled content)
npm run dev
# Runs on http://localhost:3000 (or next available port if 3000 is busy)

# Terminal 3 (optional): Test with standalone script
npm run test-article-circle
```

**Why both are required:**
- **Facilitator** (port 4022): Verifies payment signatures and submits transactions to Arc blockchain
- **Dev server**: Hosts paywalled article endpoints that return 402 Payment Required

Without the facilitator, payments can't settle. Without the dev server, there's no paywalled content to pay for.

## How It Works

1. AI agent requests paywalled content → receives 402 Payment Required
2. AI calls Circle SDK to sign payment authorization (EIP-712)
3. Circle infrastructure signs (no private key in AI code)
4. AI retries request with payment signature
5. Facilitator verifies & settles on Arc blockchain
6. AI receives content + transaction hash

**Key Innovation**: AI agents never hold private keys - Circle's infrastructure handles all signing securely.

**Example transaction**: [View on Arcscan](https://testnet.arcscan.app/tx/0xac81709470c4c5e5ed9a7a9c206b10da24a472a90f093dc4ca69f3794a4a5628)

## Key Files

- [src/servers/mcp.ts](src/servers/mcp.ts) - MCP server (main demo)
- [src/lib/circle-wallet.ts](src/lib/circle-wallet.ts) - Circle SDK integration
- [scripts/test-article-circle.ts](scripts/test-article-circle.ts) - AI agent test script
- [src/servers/facilitator.ts](src/servers/facilitator.ts) - Payment verification & settlement
- [src/app/api/article/[slug]/route.ts](src/app/api/article/[slug]/route.ts) - x402 paywall endpoint

---

Built for **Circle/Arc Agentic Commerce Hackathon** (January 2026)
