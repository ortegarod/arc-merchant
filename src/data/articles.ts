/**
 * Article data for x402 paywall demo
 * AI agents and web crawlers must pay to access article content
 */

export interface Article {
  slug: string
  title: string
  description: string
  price: string // USD price (e.g., "$0.01")
  author: string
  publishedAt: string
  content: string // Markdown content
  tags: string[]
}

export const articles: Article[] = [
  {
    slug: 'arc-blockchain-guide',
    title: 'The Complete Guide to Arc Blockchain',
    description: 'Everything you need to know about Circle\'s Arc L1 blockchain',
    price: '$0.01',
    author: 'Arc Research Team',
    publishedAt: '2026-01-15',
    tags: ['arc', 'blockchain', 'circle'],
    content: `# The Complete Guide to Arc Blockchain

[Placeholder content - add your article here]

Arc is Circle's native blockchain with USDC as the gas token...
`,
  },
  {
    slug: 'x402-micropayments',
    title: 'x402: The Future of Web Micropayments',
    description: 'How x402 enables seamless micropayments for AI agents and content creators',
    price: '$0.01',
    author: 'x402 Protocol Team',
    publishedAt: '2026-01-16',
    tags: ['x402', 'payments', 'web3'],
    content: `# x402: The Future of Web Micropayments

[Placeholder content - add your article here]

The x402 protocol enables gasless micropayments...
`,
  },
  {
    slug: 'circle-gateway-guide',
    title: 'Circle Gateway: Unified USDC Across Chains',
    description: 'Learn how Circle Gateway provides instant cross-chain USDC transfers',
    price: '$0.01',
    author: 'Circle Developer Relations',
    publishedAt: '2026-01-17',
    tags: ['circle', 'gateway', 'usdc'],
    content: `# Circle Gateway: Unified USDC Across Chains

[Placeholder content - add your article here]

Circle Gateway enables unified USDC balance across multiple chains...
`,
  },
]

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(article => article.slug === slug)
}

export function getAllArticles(): Article[] {
  return articles
}
