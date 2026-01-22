#!/usr/bin/env tsx
/**
 * Google GenAI Agent CLI
 *
 * Uses Google's official @google/genai SDK with gemini-3-flash-preview
 *
 * Usage:
 *   npx tsx scripts/run-google-agent.ts "Create a wallet for my-agent"
 *   npx tsx scripts/run-google-agent.ts "List all wallets and show their balances"
 */

import { runGoogleAgent } from '../src/agents/google-agent.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const prompt = process.argv.slice(2).join(' ');

  if (!prompt) {
    console.log('Usage: npx tsx scripts/run-google-agent.ts "<your prompt>"');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/run-google-agent.ts "Create a wallet for test-agent"');
    console.log('  npx tsx scripts/run-google-agent.ts "List all my wallets"');
    process.exit(1);
  }

  console.log('🤖 Google GenAI Agent (gemini-3-flash-preview)\n');
  console.log(`Prompt: ${prompt}\n`);
  console.log('─'.repeat(50));

  try {
    const result = await runGoogleAgent(prompt);

    console.log('\n📝 Response:\n');
    console.log(result.text);

    if (result.toolResults && result.toolResults.length > 0) {
      console.log('\n🔧 Tool Results:\n');
      for (const toolResult of result.toolResults) {
        console.log(`  ${toolResult.name}:`);
        console.log(`  ${JSON.stringify(toolResult.result, null, 2).split('\n').join('\n  ')}`);
      }
    }

    console.log('\n📊 Model:', result.model);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
