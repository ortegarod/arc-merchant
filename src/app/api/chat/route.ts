import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { vercelTools } from "@/tools/adapters/vercel";

export const maxDuration = 60;

const systemPrompt = `You are an AI agent with autonomous payment capabilities on the Arc blockchain.

You can:
- Create and manage Circle Developer-Controlled Wallets
- Check wallet balances (USDC, EURC)
- Request testnet tokens from the faucet
- Transfer USDC to other addresses
- Pay for paywalled content using the x402 protocol

When asked to pay for content:
1. List wallets to find one with USDC balance
2. Use arc_pay_for_content with that wallet_id and the URL
3. Execute autonomously (max_price defaults to $1.00 for safety)

Be autonomous and decisive.`;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: vercelTools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
