// News tool: types, topic meta and small helpers.

export type NewsTopic = 'ai' | 'robotics' | 'geopolitics' | 'central_banks' | 'energy' | 'trade' | 'semiconductors'

export interface NewsArticle {
  id: number
  url: string
  title: string
  summary: string | null
  source: string
  image_url: string | null
  published_at: string
  topics: NewsTopic[]
  market_score: number
  saved: boolean
  fetched_at: string
}

export const TOPICS: Record<NewsTopic, { label: string; short: string; color: string }> = {
  ai: { label: 'AI', short: 'AI', color: '#5B4BA6' },
  robotics: { label: 'Robotics', short: 'Robotics', color: '#2F7A8C' },
  geopolitics: { label: 'Geopolitics', short: 'Geopolitics', color: '#9A3B2E' },
  central_banks: { label: 'Central banks & rates', short: 'Rates', color: '#2B3A7A' },
  energy: { label: 'Energy & commodities', short: 'Energy', color: '#B07A1F' },
  trade: { label: 'Trade & tariffs', short: 'Trade', color: '#3F6E5A' },
  semiconductors: { label: 'Semiconductors', short: 'Chips', color: '#6B7A99' },
}
export const TOPIC_ORDER = Object.keys(TOPICS) as NewsTopic[]

/** Stories that mention several market-moving terms (inflation, tariffs, yields, oil prices...) */
export const HIGH_IMPACT = 3
export const isHighImpact = (a: NewsArticle) => a.market_score >= HIGH_IMPACT

export function timeAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

export const within = (iso: string, hours: number, now = Date.now()) => now - new Date(iso).getTime() <= hours * 3600e3

export const SOURCES = [
  'BBC', 'The Guardian', 'CNBC', 'Al Jazeera', 'TechCrunch', 'MIT Technology Review',
  'IEEE Spectrum', 'Federal Reserve', 'ECB', 'OilPrice.com', 'Antara',
]
