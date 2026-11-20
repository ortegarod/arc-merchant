/**
 * Official Circle Entity Secret Setup
 *
 * Uses Circle SDK to:
 * 1. Generate a 32-byte Entity Secret
 * 2. Encrypt and register it with Circle
 * 3. Download recovery file
 *
 * Run once to set up Circle Developer-Controlled Wallets.
 */

import { asApiError } from '../src/lib/errors';
import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function setupCircle() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY not found in .env.local. Add your Circle API key first.')
  }
  console.log('🔐 Circle Developer-Controlled Wallets Setup\n');

  // Step 1: Generate Entity Secret (SDK's generateEntitySecret only prints, doesn't return)
  console.log('1️⃣ Generating 32-byte Entity Secret...\n');
  const crypto = await import('crypto');
  const entitySecret = crypto.randomBytes(32).toString('hex');

  console.log('✅ Entity Secret generated:');
  console.log(`   ${entitySecret}\n`);

  // Step 2: Register with Circle (SDK encrypts and registers automatically)
  console.log('2️⃣ Registering Entity Secret with Circle...\n');

  try {
    const response = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      recoveryFileDownloadPath: resolve(__dirname, '..'),
    });

    console.log('✅ Entity Secret registered successfully!\n');
    console.log('📄 Recovery file saved to: arc-merchant/\n');

    // Step 3: Save to .env.local
    console.log('3️⃣ Updating .env.local...\n');
    const envPath = resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');

    if (envContent.includes('CIRCLE_ENTITY_SECRET=')) {
      // Replace existing
      const updatedContent = envContent.replace(
        /CIRCLE_ENTITY_SECRET=.*/,
        `CIRCLE_ENTITY_SECRET=${entitySecret}`
      );
      fs.writeFileSync(envPath, updatedContent);
      console.log('✅ Updated existing CIRCLE_ENTITY_SECRET in .env.local\n');
    } else {
      // Append new
      fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);
      console.log('✅ Added CIRCLE_ENTITY_SECRET to .env.local\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⚠️  IMPORTANT: Backup your Entity Secret and recovery file!');
    console.log('   - Entity Secret is in .env.local');
    console.log('   - Recovery file is in arc-merchant/');
    console.log('   - Store both in a secure location\n');

    console.log('📝 Next steps:');
    console.log('   npx tsx scripts/test-article-circle.ts');

  } catch (e) {
    const error = asApiError(e);
    console.error('❌ Registration failed:', error.message);
    if (error.response?.data) {
      console.error('Circle error:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nYou can still use the Entity Secret manually:');
    console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}`);
    process.exit(1);
  }
}

setupCircle();
