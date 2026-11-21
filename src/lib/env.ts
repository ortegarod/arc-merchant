/**
 * Loads .env.local before any module reads process.env. Imported first by
 * arc.ts, so the network is chosen from the same values the Circle client uses.
 * Variables already set (Railway, the shell) win over the file.
 */
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local'), quiet: true })
