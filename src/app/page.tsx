'use client'

import { useEffect, useState } from 'react'
import { getAllArticles } from '@/data/articles'

interface Payment {
  slug: string
  amount: number
  txHash: string | null
  payer: string
  timestamp: number
}

interface ArticleStats {
  slug: string
  title: string
  views: number
  revenue: number
}

interface MerchantWallet {
  id: string
  address: string
}

interface Stats {
  totalRevenue: number
  totalPayments: number
  recentPayments: Payment[]
  articleStats: ArticleStats[]
  merchantWallet: MerchantWallet | null
  onChainBalance: string | null
}

export default function MerchantDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const articles = getAllArticles()

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Poll every 3 seconds
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  const formatBalance = (balance: string | null) => {
    if (!balance) return '0.00'
    const num = parseFloat(balance)
    return num.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 p-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-blue-400">Arc</span> Merchant Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Real-time payment tracking for x402 paywalled content
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
            {lastUpdate && (
              <p className="text-xs text-zinc-600 mt-1">
                Updated {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin text-4xl">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Merchant Wallet Info */}
            {stats?.merchantWallet && (
              <div className="rounded-xl bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Merchant Wallet (Circle)</p>
                    <a
                                      href={`https://testnet.arcscan.app/address/${stats.merchantWallet.address}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-300 hover:text-blue-200 font-mono"
                                    >
                                      {stats.merchantWallet.address}
                                    </a>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-400 mb-1">On-Chain Balance</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${formatBalance(stats.onChainBalance)} <span className="text-sm font-normal text-zinc-500">USDC</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!stats?.merchantWallet && (
              <div className="rounded-xl bg-yellow-900/20 border border-yellow-800/50 p-6">
                <p className="text-yellow-400 font-medium">No merchant wallet configured</p>
                <p className="text-sm text-zinc-400 mt-1">
                  Create a wallet using <code className="bg-zinc-800 px-1 rounded">arc_create_wallet</code> MCP tool
                </p>
              </div>
            )}

            {/* Articles Table */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                    <th className="px-6 py-4 font-medium">Article</th>
                    <th className="px-6 py-4 font-medium">Endpoint</th>
                    <th className="px-6 py-4 font-medium text-right">Price</th>
                    <th className="px-6 py-4 font-medium text-right">Sales</th>
                    <th className="px-6 py-4 font-medium text-right">Revenue</th>
                    <th className="px-6 py-4 font-medium text-right">Last Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {articles
                    .map((article) => {
                      const articleStat = stats?.articleStats.find(s => s.slug === article.slug)
                      const lastPayment = stats?.recentPayments.find(p => p.slug === article.slug)
                      return {
                        ...article,
                        sales: articleStat?.views || 0,
                        revenue: articleStat?.revenue || 0,
                        lastSale: lastPayment?.timestamp || null,
                      }
                    })
                    .sort((a, b) => b.sales - a.sales)
                    .map((article) => (
                      <tr key={article.slug} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-6 py-4">
                          <p className="font-medium">{article.title}</p>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-sm text-zinc-400">/{article.slug}</code>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-green-400">${article.priceUsd}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={article.sales > 0 ? 'text-blue-400' : 'text-zinc-600'}>
                            {article.sales}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={article.revenue > 0 ? 'text-green-400' : 'text-zinc-600'}>
                            ${article.revenue.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-zinc-500">
                          {article.lastSale ? formatTime(article.lastSale) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Recent Payments */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
              {stats?.recentPayments && stats.recentPayments.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentPayments.map((payment, idx) => {
                    const articleStat = stats.articleStats.find(a => a.slug === payment.slug)
                    const title = articleStat?.title || payment.slug
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{title}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            {payment.txHash ? (
                              <a
                                href={`https://testnet.arcscan.app/tx/${payment.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 font-mono"
                              >
                                {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-6)}
                              </a>
                            ) : (
                              <span className="font-mono">pending</span>
                            )}
                            <span>•</span>
                            <span>{formatTime(payment.timestamp)}</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-green-400 font-medium">
                            +${payment.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-600">
                  <p className="text-4xl mb-2">💳</p>
                  <p>No payments yet</p>
                  <p className="text-sm mt-1">
                    Waiting for AI agents to access content...
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 p-4 mt-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-zinc-600">
          Built for Circle/Arc Agentic Commerce Hackathon
        </div>
      </footer>
    </div>
  )
}
