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
  /** 3-5 most informative sentences from the article body (extractive, not AI-written) */
  key_points: string[] | null
  word_count: number | null
  details_status: 'pending' | 'ok' | 'failed'
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

/** The Feed and Briefing group the 7 topics into 3 */
export type NewsGroup = 'tech' | 'economy' | 'world'
export const GROUPS: Record<NewsGroup, { label: string; short: string; color: string; topics: NewsTopic[] }> = {
  tech: { label: 'Tech & AI', short: 'Tech', color: '#5B4BA6', topics: ['ai', 'robotics', 'semiconductors'] },
  economy: { label: 'Economy & Markets', short: 'Economy', color: '#B07A1F', topics: ['central_banks', 'energy'] },
  world: { label: 'Geopolitics & Trade', short: 'World', color: '#9A3B2E', topics: ['geopolitics', 'trade'] },
}
export const GROUP_ORDER = Object.keys(GROUPS) as NewsGroup[]
export const inGroup = (a: NewsArticle, g: NewsGroup) => a.topics.some((t) => GROUPS[g].topics.includes(t))

/** About 220 words a minute */
export const readMinutes = (words: number | null) => (words ? Math.max(1, Math.round(words / 220)) : null)

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

/** Feed text should already be plain, but never render stray markup like <p> if a source slips some through */
export const plainText = (s: string | null | undefined) =>
  (s ?? '').replace(/<[^>]+>/g, ' ').replace(/&lt;\/?[a-z][^&]*&gt;/gi, ' ').replace(/\s+/g, ' ').trim()
