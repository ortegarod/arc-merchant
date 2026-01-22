#!/usr/bin/env tsx
/**
 * Arc Payment Agent CLI
 *
 * Usage:
 *   npx tsx scripts/run-agent.ts "Create a wallet for my-agent"
 *   npx tsx scripts/run-agent.ts "List all wallets and show their balances"
 *   npx tsx scripts/run-agent.ts "Pay for content at http://localhost:3000/api/article/premium-guide"
 */

import { runAgent } from '../src/agents/vercel-agent.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const prompt = process.argv.slice(2).join(' ');

  if (!prompt) {
    console.log('Usage: npx tsx scripts/run-agent.ts "<your prompt>"');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/run-agent.ts "Create a wallet for test-agent"');
    console.log('  npx tsx scripts/run-agent.ts "List all my wallets"');
    console.log('  npx tsx scripts/run-agent.ts "Check balance for wallet <id>"');
    console.log('  npx tsx scripts/run-agent.ts "Request testnet tokens for 0x..."');
    process.exit(1);
  }

  console.log('🤖 Arc Payment Agent\n');
  console.log(`Prompt: ${prompt}\n`);
  console.log('─'.repeat(50));

  try {
    const result = await runAgent(prompt);

    console.log('\n📝 Response:\n');
    console.log(result.text);

    if (result.toolResults && result.toolResults.length > 0) {
      console.log('\n🔧 Tool Results:\n');
      for (const toolResult of result.toolResults) {
        console.log(`  ${toolResult.toolName}:`);
        console.log(`  ${JSON.stringify(toolResult.output, null, 2).split('\n').join('\n  ')}`);
      }
    }

    console.log('\n📊 Usage:');
    console.log(`  Input tokens:  ${result.usage?.inputTokens ?? 'N/A'}`);
    console.log(`  Output tokens: ${result.usage?.outputTokens ?? 'N/A'}`);
    console.log(`  Total steps:   ${result.steps?.length}`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
