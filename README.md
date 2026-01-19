# Arc Merchant

Merchant infrastructure for autonomous AI agent payments on Arc blockchain.

## What This Is

A **seller-side platform** where content creators get paid in USDC when AI agents access paywalled content via the x402 protocol.

```
┌─────────────────────────────────────────────────────────────┐
│              AI Agent (e.g., Claude Code)                   │
│              with Circle wallet + MCP tools                 │
└─────────────────────────────┬───────────────────────────────┘
                              │ x402 payment ($0.01 USDC)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Arc Merchant                           │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │  x402 Paywall API   │───▶│   Merchant Dashboard       │  │
│  │  /api/article/:slug │    │   - Real-time payments     │  │
│  └─────────────────────┘    │   - Revenue tracking       │  │
│                             │   - On-chain balance       │  │
│                             └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Arc Blockchain                         │
│              USDC settlement  •  Circle Wallets             │
└─────────────────────────────────────────────────────────────┘
```

**The buyer side** (autonomous AI agent) is handled by Claude Code with the `arc-agent-payments` MCP server—it manages wallets and signs x402 payments.

**The seller side** (this project) provides paywalled content endpoints and a real-time dashboard showing payments as they arrive.

---

## How It Works

1. **Content behind x402 paywall** — Articles at `/api/article/:slug` require payment
2. **AI agent requests content** — Gets HTTP 402 Payment Required with price
3. **Agent pays via Circle wallet** — Signs x402 payment, sends USDC
4. **Facilitator settles on-chain** — Verifies signature, submits to Arc
5. **Content delivered** — Agent receives the article
6. **Dashboard updates** — Merchant sees payment in real-time

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Get Circle API credentials

1. Go to [Circle Developer Console](https://console.circle.com)
2. Create an API Key
3. Add to `.env.local`:

```bash
CIRCLE_API_KEY=your_api_key_here
```

### 3. Set up Circle Entity Secret (one-time)

```bash
npm run setup-circle
```

This generates and registers your Entity Secret with Circle.

### 4. Configure facilitator wallet

Add a test wallet private key for the facilitator (settles payments on-chain):

```bash
# .env.local
ARC_WALLET_KEY=0x...  # Test wallet private key
```

### 5. Run both servers

```bash
# Terminal 1: Facilitator (settles payments)
npm run facilitator

# Terminal 2: Next.js (dashboard + paywall)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the merchant dashboard.

### 6. Test a payment

In Claude Code with the `arc-agent-payments` MCP server:

```
"Pay for http://localhost:3000/api/article/arc-blockchain-guide"
```

Watch the dashboard update in real-time.

---

## Project Structure

```
arc-merchant/
├── src/app/
│   ├── page.tsx                  # Merchant dashboard
│   └── api/
│       ├── article/[slug]/       # x402-protected content
│       └── stats/                # Dashboard data
├── src/lib/
│   ├── arc.ts                    # Arc chain config
│   ├── circle-wallet.ts          # Circle SDK
│   ├── x402.ts                   # x402 facilitator
│   └── stats.ts                  # Payment tracking
├── src/servers/
│   ├── facilitator.ts            # Payment settlement server
│   └── mcp.ts                    # MCP server for AI agents
└── scripts/
    └── setup-circle.ts           # Circle wallet setup
```

---

## MCP Tools (Buyer Side)

The `arc-agent-payments` MCP server provides these tools to AI agents:

| Tool | Description |
|------|-------------|
| `arc_create_wallet` | Create/get Circle wallet for an agent |
| `arc_get_balance` | Check USDC/EURC balances |
| `arc_pay_for_content` | Pay for x402 paywalled content |
| `arc_transfer` | Direct USDC transfer |
| `arc_request_testnet_tokens` | Fund wallet from Circle faucet |

Add to Claude Code:

```bash
claude mcp add arc-mcp-server -- npm run mcp
```

---

## Tech Stack

- **Arc** — Circle's L1 blockchain with native USDC gas
- **Circle Developer-Controlled Wallets** — Secure wallet infrastructure
- **x402** — Web-native micropayment protocol (HTTP 402)
- **Next.js** — Dashboard and API
- **USDC** — Stablecoin payments

---

**Built for the Agentic Commerce on Arc Hackathon** (January 2026)
