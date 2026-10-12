// Edge Function: fetch-news
// Pulls free RSS/Atom feeds, tags each story with topics by keyword, scores how market-moving it is,
// and upserts into public.news_articles. Called on a schedule (pg_cron) and by the app's refresh button.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { summarizeUrl } from './summarize.ts'

type Topic = 'ai' | 'robotics' | 'geopolitics' | 'central_banks' | 'energy' | 'trade' | 'semiconductors'

// `topics` = topics implied by the feed itself (a robotics feed is about robotics)
const FEEDS: { url: string; source: string; topics: Topic[] }[] = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC', topics: [] },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC', topics: [] },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC', topics: [] },
  { url: 'https://www.theguardian.com/uk/business/rss', source: 'The Guardian', topics: [] },
  { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian', topics: [] },
  { url: 'https://www.theguardian.com/uk/technology/rss', source: 'The Guardian', topics: [] },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC', topics: [] },
  { url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', source: 'CNBC', topics: [] },
  { url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html', source: 'CNBC', topics: [] },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', topics: [] },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch', topics: ['ai'] },
  { url: 'https://techcrunch.com/category/robotics/feed/', source: 'TechCrunch', topics: ['robotics'] },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', source: 'MIT Technology Review', topics: ['ai'] },
  { url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', source: 'IEEE Spectrum', topics: ['robotics'] },
  { url: 'https://spectrum.ieee.org/feeds/topic/semiconductors.rss', source: 'IEEE Spectrum', topics: ['semiconductors'] },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'Federal Reserve', topics: ['central_banks'] },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ECB', topics: ['central_banks'] },
  { url: 'https://oilprice.com/rss/main', source: 'OilPrice.com', topics: ['energy'] },
  { url: 'https://en.antaranews.com/rss/news.xml', source: 'Antara', topics: [] },
]

// Case-insensitive unless noted. Word boundaries avoid "said" matching "AI".
const TOPIC_RULES: Record<Topic, RegExp[]> = {
  ai: [/\bAI\b/, /\bA\.I\.|artificial intelligence|machine learning|large language model|\bLLMs?\b|generative/i, /\b(OpenAI|ChatGPT|Anthropic|DeepMind|chatbots?|Copilot|xAI|Mistral AI)\b/i],
  robotics: [/\brobot(s|ic|ics|axis?)?\b|humanoid|cobots?|\bautomation\b|autonomous (vehicle|driving|truck)|self-driving|\bdrones?\b|Boston Dynamics|Optimus/i],
  geopolitics: [/\bsanctions?\b|\bwar\b|ceasefire|invasion|\bNATO\b|missiles?|military|diplomat(ic|s)?|\bsummit\b|South China Sea|\bBRICS\b|\bG7\b|\bG20\b|geopolitic/i, /\b(Ukraine|Russia|Taiwan|Iran|Israel|Gaza|North Korea|Red Sea)\b/],
  central_banks: [/central bank|Federal Reserve|\bECB\b|Bank of (England|Japan|Indonesia|Canada)|\bPBOC\b|interest rates?|rate (cut|hike|rise)s?|monetary policy|\binflation\b|bond yields?|Treasury yields?|Powell|Lagarde/i, /\bFed\b/],
  energy: [/\boil\b|\bcrude\b|\bBrent\b|\bOPEC\+?|natural gas|\bLNG\b|\bcoal\b|\bnickel\b|\bcopper\b|\blithium\b|commodit(y|ies)|gold price|energy prices?|palm oil|electricity prices?/i],
  trade: [/tariffs?|trade (war|deal|talks|deficit|surplus|tensions)|export (controls?|bans?|curbs?)|import (duties|bans?)|supply chains?|\bWTO\b|customs duties|anti-dumping|protectionis/i],
  semiconductors: [/semiconductors?|\bchips?\b|chipmakers?|\bTSMC\b|\bNvidia\b|\bASML\b|SK Hynix|Samsung Electronics|foundr(y|ies)|\bwafers?\b|\bHBM\b|\bQualcomm\b|\bIntel\b|\bAMD\b/i],
}

// Terms that tend to move markets or the wider economy
const MARKET_TERMS =
  /\b(inflation|recession|GDP|stocks?|shares|markets?|investors?|prices?|tariffs?|interest rates?|yields?|currenc(y|ies)|rupiah|dollar|economy|economic|earnings|supply chains?|sanctions|debt|IMF|World Bank|exports?|imports?|growth|unemployment|jobs report|bonds?)\b/gi

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ') // feeds like The Guardian send escaped HTML (&lt;p&gt;)
    .replace(/\s+/g, ' ')
    .trim()

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1]

function parseFeed(xml: string) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  return blocks.map((b) => {
    const link =
      decode(tag(b, 'link') ?? '') ||
      b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1] ||
      b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      decode(tag(b, 'guid') ?? '')
    const image =
      b.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)?.[1] ||
      b.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1] ||
      null
    return {
      title: decode(tag(b, 'title') ?? ''),
      url: link.trim(),
      summary: decode(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content') ?? '').slice(0, 400),
      date: tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated') ?? tag(b, 'dc:date'),
      image,
    }
  })
}

const hits = (r: RegExp, s: string) => (s.match(new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g')) ?? []).length

/** A topic counts when the headline mentions it, or the summary mentions it at least twice (one passing word is noise) */
function classify(title: string, summary: string, implied: Topic[]): Topic[] {
  const found = new Set<Topic>(implied)
  for (const [topic, rules] of Object.entries(TOPIC_RULES) as [Topic, RegExp[]][]) {
    const score = rules.reduce((s, r) => s + 2 * hits(r, title) + hits(r, summary), 0)
    if (score >= 2) found.add(topic)
  }
  return [...found]
}

// Event promos and ads that ride along in publisher feeds
const PROMO = /TechCrunch (Disrupt|Sessions|events?)|\b(exhibit|tickets?|webinar|sponsored|register now|early.?bird)\b/i

/** Summarise pending stories, a few at a time (each needs its own page fetch) */
async function summarizePending(db: SupabaseClient, limit: number) {
  const { data: pending } = await db
    .from('news_articles')
    .select('id, url, title')
    .eq('details_status', 'pending')
    .order('published_at', { ascending: false })
    .limit(limit)
  let ok = 0
  const queue = [...(pending ?? [])]
  const worker = async () => {
    for (let a = queue.shift(); a; a = queue.shift()) {
      const s = await summarizeUrl(a.url, a.title).catch(() => null)
      await db.from('news_articles').update(s ? { ...s, details_status: 'ok' } : { details_status: 'failed' }).eq('id', a.id)
      if (s) ok++
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return { summarized: ok, attempted: pending?.length ?? 0 }
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))

  // On-demand: summarise one story the user just opened (no feed fetch, no throttle)
  if (body?.article_id) {
    const { data: a } = await db.from('news_articles').select('id, url, title, details_status, brief').eq('id', body.article_id).single()
    if (!a) return Response.json({ error: 'not found' }, { status: 404 })
    // Also redo stories summarised before the paragraph brief existed
    if (a.details_status === 'pending' || (a.details_status === 'ok' && !a.brief)) {
      const s = await summarizeUrl(a.url, a.title).catch(() => null)
      await db.from('news_articles').update(s ? { ...s, details_status: 'ok' } : { details_status: 'failed' }).eq('id', a.id)
    }
    const { data: updated } = await db.from('news_articles').select('id, key_points, brief, word_count, details_status').eq('id', a.id).single()
    return Response.json(updated)
  }

  // Throttle: anyone holding the public key can call this, so skip if we fetched in the last 10 minutes
  const { data: last } = await db.from('news_articles').select('fetched_at').order('fetched_at', { ascending: false }).limit(1)
  if (last?.[0] && Date.now() - new Date(last[0].fetched_at).getTime() < 10 * 60 * 1000) {
    return Response.json({ skipped: 'fetched less than 10 minutes ago', ...(await summarizePending(db, 60)) })
  }

  const cutoff = Date.now() - 14 * 864e5
  const report: Record<string, number | string> = {}
  const rows: Record<string, unknown>[] = []

  await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal news reader)' }, signal: AbortSignal.timeout(12000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        let kept = 0
        for (const item of parseFeed(await res.text())) {
          const published = item.date ? new Date(item.date) : new Date()
          if (!item.title || !item.url.startsWith('http') || isNaN(published.getTime()) || published.getTime() < cutoff) continue
          if (PROMO.test(item.title)) continue
          const text = `${item.title} ${item.summary}`
          const topics = classify(item.title, item.summary, feed.topics)
          if (!topics.length) continue // not about any tracked topic
          rows.push({
            url: item.url,
            title: item.title.slice(0, 300),
            summary: item.summary || null,
            source: feed.source,
            image_url: item.image,
            published_at: published.toISOString(),
            topics,
            market_score: Math.min(10, text.match(MARKET_TERMS)?.length ?? 0),
            fetched_at: new Date().toISOString(),
          })
          kept++
        }
        report[feed.url] = kept
      } catch (e) {
        report[feed.url] = `error: ${e instanceof Error ? e.message : String(e)}`
      }
    }),
  )

  // De-duplicate by URL (the same story can appear in two feeds), then upsert without touching `saved`
  const unique = [...new Map(rows.map((r) => [r.url as string, r])).values()]
  let upserted = 0
  for (let i = 0; i < unique.length; i += 200) {
    const { error, count } = await db.from('news_articles').upsert(unique.slice(i, i + 200), { onConflict: 'url', count: 'exact' })
    if (error) return Response.json({ error: error.message, report }, { status: 500 })
    upserted += count ?? 0
  }

  // Keep the table small: drop unsaved stories older than 30 days
  await db.from('news_articles').delete().lt('published_at', new Date(Date.now() - 30 * 864e5).toISOString()).eq('saved', false)

  const details = await summarizePending(db, 60)
  return Response.json({ upserted, ...details, feeds: report })
})
