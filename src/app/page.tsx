'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useMemo } from 'react'
import { useX402 } from '@/hooks/useX402'
import { getAllArticles, type Article } from '@/data/articles'

interface PremiumInsight {
  success: boolean
  payer: string
  insight: string
  timestamp: string
  message: string
}

export default function Home() {
  // In production, this would come from wallet connection (Privy, etc.)
  const [userAddress, setUserAddress] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [inputText, setInputText] = useState('')

  // x402 payment state
  const { paidFetch, isPaying, lastPaymentTx } = useX402()
  const [premiumInsight, setPremiumInsight] = useState<PremiumInsight | null>(null)
  const [premiumError, setPremiumError] = useState<string | null>(null)

  // Article paywall state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [articleContent, setArticleContent] = useState<string | null>(null)
  const [articleError, setArticleError] = useState<string | null>(null)
  const [isLoadingArticle, setIsLoadingArticle] = useState(false)
  const allArticles = getAllArticles()

  // Create transport with userAddress in body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: { userAddress },
      }),
    [userAddress],
  )

  const { messages, sendMessage, status } = useChat({
    transport,
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Simulate wallet connection (replace with Privy later)
  const connectWallet = async () => {
    // For demo, derive address from the env wallet key that's actually signing
    // This makes the UI consistent - the displayed address is the one that pays
    try {
      const { privateKeyToAccount } = await import('viem/accounts')
      const DEMO_KEY = process.env.NEXT_PUBLIC_ARC_WALLET_KEY
      if (DEMO_KEY) {
        const account = privateKeyToAccount(DEMO_KEY as `0x${string}`)
        setUserAddress(account.address)
      } else {
        // Fallback if env key not set
        setUserAddress('0x897F9dDD37f929F874B3c3FaD3F0682ff561c0D7')
      }
    } catch {
      setUserAddress('0x897F9dDD37f929F874B3c3FaD3F0682ff561c0D7')
    }
    setIsConnected(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isLoading) return
    sendMessage({ text: inputText })
    setInputText('')
  }

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion })
  }

  // Handle premium insight purchase (x402 flow)
  const handleGetPremiumInsight = async () => {
    setPremiumInsight(null)
    setPremiumError(null)

    const result = await paidFetch<PremiumInsight>('/api/premium')

    if (result.success && result.data) {
      setPremiumInsight(result.data)
    } else {
      setPremiumError(result.error || 'Payment failed')
    }
  }

  // Handle article access (x402 paywall)
  const handleReadArticle = async (article: Article) => {
    setSelectedArticle(article)
    setArticleContent(null)
    setArticleError(null)
    setIsLoadingArticle(true)

    const result = await paidFetch<Article>(`/api/article/${article.slug}`)

    setIsLoadingArticle(false)

    if (result.success && result.data) {
      setArticleContent(result.data.content)
    } else {
      setArticleError(result.error || 'Payment failed')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderToolPart = (part: any, idx: number) => {
    // Tool parts have type like 'tool-getBalance', 'tool-prepareTransfer'
    if (part.state === 'loading') {
      return (
        <div key={idx} className="mt-2 rounded bg-zinc-900 p-2 text-xs">
          <span className="animate-pulse">Loading...</span>
        </div>
      )
    }

    if (part.state === 'error') {
      return (
        <div key={idx} className="mt-2 rounded bg-red-900/50 p-2 text-xs text-red-300">
          Error: {part.error}
        </div>
      )
    }

    if (part.state === 'ready') {
      // Balance result
      if (part.balance !== undefined) {
        return (
          <div key={idx} className="mt-2 rounded bg-green-900/30 p-3 text-sm">
            <div className="text-green-400 font-medium">
              {part.balance} {part.token}
            </div>
          </div>
        )
      }
      // Transfer prepared
      if (part.to !== undefined && part.amount !== undefined) {
        return (
          <div key={idx} className="mt-2 rounded bg-blue-900/30 p-3 text-sm">
            <div className="text-blue-400 font-medium mb-1">Transfer Ready</div>
            <div className="text-zinc-300">
              Send {part.amount} USDC to {part.to?.slice(0, 8)}...
            </div>
            <button className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700">
              Sign Transaction
            </button>
          </div>
        )
      }
    }

    // Fallback for unknown tool state
    return (
      <div key={idx} className="mt-2 rounded bg-zinc-900 p-2 text-xs font-mono">
        <pre className="overflow-x-auto">
          {JSON.stringify(part, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-blue-400">Arc</span> Money Manager
          </h1>
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="font-mono text-sm text-zinc-400">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4">
          {!isConnected ? (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-6 text-6xl">💰</div>
              <h2 className="mb-2 text-2xl font-bold">Welcome to Arc Money Manager</h2>
              <p className="mb-6 text-zinc-400">
                Manage your USDC on Arc blockchain with AI assistance.
                <br />
                Connect your wallet to get started.
              </p>
              <button
                onClick={connectWallet}
                className="rounded-lg bg-blue-600 px-6 py-3 font-medium hover:bg-blue-700"
              >
                Connect Wallet
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-6 text-6xl">🤖</div>
              <h2 className="mb-2 text-2xl font-bold">How can I help?</h2>
              <p className="mb-6 text-zinc-400">
                Ask me about your balance, send USDC, or learn about Arc.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "What's my USDC balance?",
                  "Send 1 USDC to vitalik.eth",
                  "What is Arc blockchain?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* x402 Premium Insight Card */}
              <div className="mt-8 rounded-xl border border-purple-500/30 bg-purple-900/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✨</span>
                  <h3 className="text-lg font-semibold text-purple-300">Premium Insight</h3>
                  <span className="ml-auto rounded-full bg-purple-600/50 px-2 py-0.5 text-xs">
                    0.01 USDC
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  Get an exclusive AI-powered insight about Arc blockchain.
                  Payment via x402 protocol - gasless, instant access.
                </p>

                {premiumError && (
                  <div className="mb-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">
                    {premiumError}
                  </div>
                )}

                {premiumInsight && (
                  <div className="mb-4 rounded-lg bg-green-900/30 p-4">
                    <p className="text-green-300 font-medium mb-2">
                      &quot;{premiumInsight.insight}&quot;
                    </p>
                    <p className="text-xs text-zinc-500">
                      {premiumInsight.message}
                    </p>
                    {lastPaymentTx && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${lastPaymentTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300"
                      >
                        View transaction →
                      </a>
                    )}
                  </div>
                )}

                <button
                  onClick={handleGetPremiumInsight}
                  disabled={isPaying}
                  className="w-full rounded-lg bg-purple-600 py-3 font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPaying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Signing payment...
                    </span>
                  ) : (
                    'Get Insight (Pay 0.01 USDC)'
                  )}
                </button>
              </div>

              {/* x402 Paywalled Articles */}
              <div className="mt-8">
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2">📰 Premium Articles</h3>
                  <p className="text-sm text-zinc-400">
                    AI agents and web crawlers must pay to access content
                  </p>
                </div>

                <div className="space-y-4">
                  {allArticles.map((article) => (
                    <div
                      key={article.slug}
                      className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg mb-1">{article.title}</h4>
                          <p className="text-sm text-zinc-400 mb-2">{article.description}</p>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{article.author}</span>
                            <span>•</span>
                            <span>{article.publishedAt}</span>
                          </div>
                        </div>
                        <span className="rounded-full bg-blue-600/50 px-3 py-1 text-sm font-medium whitespace-nowrap ml-4">
                          {article.price}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {article.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {selectedArticle?.slug === article.slug && articleContent && (
                        <div className="mb-4 rounded-lg bg-zinc-900 p-4">
                          <div className="prose prose-invert prose-sm max-w-none">
                            <div className="whitespace-pre-wrap text-zinc-300">
                              {articleContent}
                            </div>
                          </div>
                          {lastPaymentTx && (
                            <a
                              href={`https://testnet.arcscan.app/tx/${lastPaymentTx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300"
                            >
                              View payment transaction →
                            </a>
                          )}
                        </div>
                      )}

                      {selectedArticle?.slug === article.slug && articleError && (
                        <div className="mb-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">
                          {articleError}
                        </div>
                      )}

                      <button
                        onClick={() => handleReadArticle(article)}
                        disabled={isPaying || isLoadingArticle}
                        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingArticle && selectedArticle?.slug === article.slug ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Processing payment...
                          </span>
                        ) : selectedArticle?.slug === article.slug && articleContent ? (
                          'Read Again (Pay 0.01 USDC)'
                        ) : (
                          'Read Article (Pay 0.01 USDC)'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-32">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-100'
                    }`}
                  >
                    {message.parts.map((part, idx) => {
                      if (part.type === 'text') {
                        return (
                          <div key={idx} className="whitespace-pre-wrap">
                            {part.text}
                          </div>
                        )
                      }
                      // Handle tool parts (type starts with 'tool-')
                      if (part.type.startsWith('tool-')) {
                        return renderToolPart(part, idx)
                      }
                      return null
                    })}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-800 px-4 py-3">
                    <div className="flex gap-1">
                      <span className="animate-bounce">●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                      <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      {isConnected && (
        <div className="border-t border-zinc-800 p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about your balance, send USDC, or get help..."
                disabled={status !== 'ready'}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
