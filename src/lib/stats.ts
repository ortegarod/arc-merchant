/**
 * Stats tracking for the merchant dashboard
 *
 * Tracks payments processed through x402 paywalled articles. History is kept
 * in Postgres when DATABASE_URL is set (see db.ts), so it survives restarts and
 * redeploys; otherwise it is kept in memory and lasts while the server runs.
 * The Circle balance cache is always in memory.
 */

import { getDb } from './db'

export interface Payment {
  slug: string;
  amount: number; // in USDC
  txHash: string | null;
  payer: string;
  timestamp: number;
  network?: string; // CAIP-2 id, e.g. eip155:5042002
}

export interface ArticleStats {
  slug: string;
  title: string;
  views: number; // paid views
  revenue: number;
  lastSale: number | null;
}

export interface Stats {
  totalRevenue: number;
  totalPayments: number;
  recentPayments: Payment[];
  articleStats: ArticleStats[];
  /** False when the database could not be read; the numbers are then empty. */
  historyAvailable: boolean;
}

const RECENT_PAYMENTS_LIMIT = 10;
const MEMORY_PAYMENTS_LIMIT = 50;
const DEFAULT_NETWORK = 'eip155:5042002';

interface StatsStore {
  payments: Payment[];
  articleStats: Map<string, ArticleStats>;
  totalRevenue: number;
  totalPayments: number;
  // Balance + wallet cache (fetched together)
  cachedBalance: string | null;
  cachedWalletId: string | null;
  cachedWalletAddress: string | null;
  balanceCacheTime: number;
  balanceNeedsRefresh: boolean;
  // Failure backoff (prevents retry storms hammering Circle's API, e.g. after a rate limit)
  balanceLastErrorTime: number;
  balanceErrorBackoffMs: number;
}

// Extend globalThis to persist store across Next.js hot reloads
declare global {
  var statsStore: StatsStore | undefined;
}

// Use globalThis to persist across module reloads in development
const store: StatsStore = globalThis.statsStore || {
  payments: [],
  articleStats: new Map(),
  totalRevenue: 0,
  totalPayments: 0,
  cachedBalance: null,
  cachedWalletId: null,
  cachedWalletAddress: null,
  balanceCacheTime: 0,
  balanceNeedsRefresh: true,
  balanceLastErrorTime: 0,
  balanceErrorBackoffMs: 0,
};

// Save reference to globalThis so it persists
globalThis.statsStore = store;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Record a successful payment.
 * Never throws: the buyer has already paid, so a storage failure is logged
 * rather than turned into an error response.
 */
export async function recordPayment(payment: Payment, articleTitle: string): Promise<void> {
  store.balanceNeedsRefresh = true;

  try {
    const db = await getDb();
    if (db) {
      await db.query(
        `INSERT INTO payments (tx_hash, slug, title, amount_usdc, payer, network, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
         ON CONFLICT (tx_hash) DO NOTHING`,
        [payment.txHash, payment.slug, articleTitle, payment.amount, payment.payer,
          payment.network ?? DEFAULT_NETWORK, payment.timestamp]
      );
      return;
    }
  } catch (err) {
    console.error('Failed to store payment:', errorMessage(err));
    return;
  }

  // In-memory history: skip a payment already recorded for the same transaction
  if (payment.txHash && store.payments.some((p) => p.txHash === payment.txHash)) return;

  store.payments.unshift(payment);
  if (store.payments.length > MEMORY_PAYMENTS_LIMIT) {
    store.payments.pop();
  }
  store.totalPayments++;
  store.totalRevenue += payment.amount;

  const existing = store.articleStats.get(payment.slug);
  if (existing) {
    existing.views++;
    existing.revenue += payment.amount;
    existing.lastSale = payment.timestamp;
  } else {
    store.articleStats.set(payment.slug, {
      slug: payment.slug,
      title: articleTitle,
      views: 1,
      revenue: payment.amount,
      lastSale: payment.timestamp,
    });
  }
}

/**
 * Get all stats for the dashboard
 */
export async function getStats(): Promise<Stats> {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('Failed to open database:', errorMessage(err));
    return emptyStats();
  }

  if (!db) {
    return {
      totalRevenue: store.totalRevenue,
      totalPayments: store.totalPayments,
      recentPayments: store.payments.slice(0, RECENT_PAYMENTS_LIMIT),
      articleStats: Array.from(store.articleStats.values()).sort(
        (a, b) => b.revenue - a.revenue
      ),
      historyAvailable: true,
    };
  }

  try {
    const [totals, recent, perArticle] = await Promise.all([
      db.query<{ count: string; revenue: string }>(
        'SELECT count(*) AS count, coalesce(sum(amount_usdc), 0) AS revenue FROM payments'
      ),
      db.query<{ slug: string; amount: string; tx_hash: string | null; payer: string; network: string; ts: string }>(
        `SELECT slug, amount_usdc AS amount, tx_hash, payer, network,
                (extract(epoch FROM created_at) * 1000)::bigint AS ts
         FROM payments ORDER BY created_at DESC, id DESC LIMIT $1`,
        [RECENT_PAYMENTS_LIMIT]
      ),
      db.query<{ slug: string; title: string; views: string; revenue: string; last_sale: string }>(
        `SELECT slug, (array_agg(title ORDER BY created_at DESC))[1] AS title,
                count(*) AS views, sum(amount_usdc) AS revenue,
                (extract(epoch FROM max(created_at)) * 1000)::bigint AS last_sale
         FROM payments GROUP BY slug ORDER BY sum(amount_usdc) DESC`
      ),
    ]);

    return {
      totalRevenue: Number(totals.rows[0].revenue),
      totalPayments: Number(totals.rows[0].count),
      recentPayments: recent.rows.map((r) => ({
        slug: r.slug,
        amount: Number(r.amount),
        txHash: r.tx_hash,
        payer: r.payer,
        network: r.network,
        timestamp: Number(r.ts),
      })),
      articleStats: perArticle.rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        views: Number(r.views),
        revenue: Number(r.revenue),
        lastSale: Number(r.last_sale),
      })),
      historyAvailable: true,
    };
  } catch (err) {
    console.error('Failed to read stats:', errorMessage(err));
    return emptyStats();
  }
}

function emptyStats(): Stats {
  return { totalRevenue: 0, totalPayments: 0, recentPayments: [], articleStats: [], historyAvailable: false };
}

/**
 * Reset stats, including stored history (admin only, see /api/stats/reset)
 */
export async function resetStats(): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.query('TRUNCATE payments');
  }
  store.payments = [];
  store.articleStats.clear();
  store.totalRevenue = 0;
  store.totalPayments = 0;
  store.cachedBalance = null;
  store.cachedWalletId = null;
  store.cachedWalletAddress = null;
  store.balanceCacheTime = 0;
  store.balanceNeedsRefresh = true;
  store.balanceLastErrorTime = 0;
  store.balanceErrorBackoffMs = 0;
}

// Balance cache TTL: 30 seconds
const BALANCE_CACHE_TTL = 30 * 1000;

// Failure backoff: start at 30s, double each consecutive failure, cap at 5 min.
// Without this, a single Circle API error (e.g. a rate limit) causes every
// subsequent poll to immediately retry and fail again forever.
const BALANCE_ERROR_BACKOFF_BASE_MS = 30 * 1000;
const BALANCE_ERROR_BACKOFF_MAX_MS = 5 * 60 * 1000;

/**
 * Check if balance needs to be refreshed
 * Returns true if:
 * - A payment was just recorded (balanceNeedsRefresh flag)
 * - Cache is older than TTL
 * - No cached value
 * ...but never before the current error backoff window has elapsed, if the
 * last attempt failed.
 */
export function shouldRefreshBalance(): boolean {
  if (store.balanceLastErrorTime > 0) {
    const sinceError = Date.now() - store.balanceLastErrorTime;
    if (sinceError < store.balanceErrorBackoffMs) return false;
  }
  if (store.balanceNeedsRefresh) return true;
  if (!store.cachedBalance) return true;
  if (Date.now() - store.balanceCacheTime > BALANCE_CACHE_TTL) return true;
  return false;
}

/**
 * Record a failed Circle API call. Doubles the backoff window each
 * consecutive failure (capped) so repeated errors don't turn into a
 * retry storm against Circle's API.
 */
export function recordBalanceFetchError(retryAfterMs?: number) {
  store.balanceLastErrorTime = Date.now();
  const nextBackoff = store.balanceErrorBackoffMs > 0
    ? store.balanceErrorBackoffMs * 2
    : BALANCE_ERROR_BACKOFF_BASE_MS;
  store.balanceErrorBackoffMs = Math.min(
    Math.max(nextBackoff, retryAfterMs ?? 0),
    BALANCE_ERROR_BACKOFF_MAX_MS
  );
}

/**
 * Get cached balance (may be stale)
 */
export function getCachedBalance(): string | null {
  return store.cachedBalance;
}

/**
 * Update the cached balance and wallet
 */
export function setCachedBalance(balance: string, walletId: string, walletAddress: string) {
  store.cachedBalance = balance;
  store.cachedWalletId = walletId;
  store.cachedWalletAddress = walletAddress;
  store.balanceCacheTime = Date.now();
  store.balanceNeedsRefresh = false;
  // Success clears any error backoff
  store.balanceLastErrorTime = 0;
  store.balanceErrorBackoffMs = 0;
}

/**
 * Get cached wallet (may be null if never fetched)
 */
export function getCachedWallet(): { id: string; address: string } | null {
  if (store.cachedWalletId && store.cachedWalletAddress) {
    return { id: store.cachedWalletId, address: store.cachedWalletAddress };
  }
  return null;
}

/**
 * Update a payment's transaction hash
 * Called after settlement when the txHash becomes available
 */
export async function updatePaymentTxHash(slug: string, payer: string, txHash: string): Promise<boolean> {
  const db = await getDb();
  if (db) {
    // Most recent payment matching slug and payer that has no txHash yet
    const { rowCount } = await db.query(
      `UPDATE payments SET tx_hash = $3
       WHERE id = (
         SELECT id FROM payments
         WHERE slug = $1 AND lower(payer) = lower($2) AND tx_hash IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 1
       )`,
      [slug, payer, txHash]
    );
    return (rowCount ?? 0) > 0;
  }

  const payment = store.payments.find(
    p => p.slug === slug && p.payer.toLowerCase() === payer.toLowerCase() && !p.txHash
  );

  if (payment) {
    payment.txHash = txHash;
    return true;
  }
  return false;
}
