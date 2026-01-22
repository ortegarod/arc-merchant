/**
 * Google GenAI Agent
 *
 * Uses Google's official @google/genai SDK directly.
 * Supports latest models like gemini-3-flash-preview.
 *
 * Usage:
 *   import { runGoogleAgent } from './google-genai-agent';
 *   const result = await runGoogleAgent("Pay for the article");
 */

import { GoogleGenAI } from '@google/genai';
import { googleGenaiTools, executeTool } from '../tools/adapters/google-genai.js';

// Initialize client (uses GEMINI_API_KEY env var)
const ai = new GoogleGenAI({});

export interface GoogleAgentConfig {
  model?: string;
  maxTurns?: number;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI agent with autonomous payment capabilities on the Arc blockchain.

You can:
- Create and manage Circle Developer-Controlled Wallets
- Check wallet balances (USDC, EURC)
- Request testnet tokens from the faucet
- Transfer USDC to other addresses
- Pay for paywalled content using the x402 protocol

When asked to pay for content, use arc_pay_for_content with the wallet_id and URL.
Always confirm payment amounts before executing transfers.`;

/**
 * Run an agent using Google's official GenAI SDK
 * Supports gemini-3-flash-preview and other latest models
 */
export async function runGoogleAgent(
  prompt: string,
  config: GoogleAgentConfig = {}
) {
  const {
    model = 'gemini-3-flash-preview',
    maxTurns = 10,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = config;

  // Build contents array for multi-turn conversation
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    { role: 'user', parts: [{ text: prompt }] },
  ];

  let finalText = '';
  const toolResults: Array<{ name: string; result: unknown }> = [];

  // Agent loop
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: googleGenaiTools }],
      },
    });

    // Check for function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0];
      const name = functionCall.name;
      const args = functionCall.args;

      if (!name) {
        throw new Error('Function call missing name');
      }

      console.log(`🔧 Calling: ${name}`);

      // Execute via adapter
      const toolResponse = await executeTool(name, args || {});
      toolResults.push({ name, result: toolResponse });

      // Build function response part
      const functionResponsePart = {
        name: functionCall.name,
        response: { result: toolResponse },
      };

      // Get the raw model parts to preserve thoughtSignature (required for Gemini 3)
      const modelParts = response.candidates?.[0]?.content?.parts || [{ functionCall }];

      // Append model's function call to history (with thoughtSignature preserved)
      contents.push({
        role: 'model',
        parts: modelParts as Array<Record<string, unknown>>,
      });

      // Append function response to history
      contents.push({
        role: 'user',
        parts: [{ functionResponse: functionResponsePart }],
      });
    } else {
      // No more function calls - we have the final response
      finalText = response.text || '';
      break;
    }
  }

  return {
    text: finalText,
    toolResults,
    model,
  };
}

// Re-export tools for convenience
export { googleGenaiTools, executeTool } from '../tools/adapters/google-genai.js';
export { arcTools } from '../tools/core.js';
