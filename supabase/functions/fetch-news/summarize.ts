// Free, extractive summaries: fetch the article page, pull out its body paragraphs,
// and pick the most informative sentences. No AI service involved; the key points
// are the article's own sentences, chosen by how central they are to the story.

const STOP = new Set(
  ('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own said same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your says say new one two year years told also like time people').split(' '),
)

const BOILERPLATE =
  /cookie|subscribe|sign up|newsletter|all rights reserved|follow us|advertis|read more|click here|getty images|reuters\/|ap photo|©|copyright|terms of (use|service)|privacy policy|download the app|share this|related:|watch:|listen:|this article (was|is)|contributed to this report/i

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&[lr]squo;/g, "'").replace(/&[lr]dquo;/g, '"').replace(/&mdash;/g, ' - ').replace(/&ndash;/g, '-').replace(/&hellip;/g, '...')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1') // 'spending .' -> 'spending.'
    .trim()

/** Body paragraphs of an article page, boilerplate removed */
export function extractParagraphs(html: string): string[] {
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|header|aside|figure|form|noscript|svg|button)[\s\S]*?<\/\1>/gi, ' ')
  // Prefer the <article> (largest one) or <main> region when the page has one
  const articles = body.match(/<article[\s>][\s\S]*?<\/article>/gi)
  if (articles?.length) body = articles.sort((a, b) => b.length - a.length)[0]
  else body = body.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ?? body

  const seen = new Set<string>()
  const out: string[] = []
  for (const m of body.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)) {
    const text = decode(m[0])
    if (text.length < 60 || BOILERPLATE.test(text) || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

const words = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]{2,}/g)?.filter((w) => !STOP.has(w)) ?? []

// Periods that don't end a sentence: U.S., U.K., Mr., Jan., Inc. ...
const ABBREV = /\b(?:[A-Z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|St|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Inc|Corp|Ltd|Co|No|vs|Gov|Sen|Rep|Gen|Lt|Col|Prof)\./g
const HOLD = '․'
const protect = (s: string) => s.replace(ABBREV, (m) => m.replaceAll('.', HOLD))
const restore = (s: string) => s.replaceAll(HOLD, '.')

/** Pick up to `n` sentences that best represent the article, returned in reading order */
export function keyPoints(title: string, paragraphs: string[], n = 5): string[] {
  const sentences: { text: string; para: number; idx: number }[] = []
  paragraphs.slice(0, 40).forEach((p, para) => {
    for (const raw of protect(p).split(/(?<=[.!?]["”’]?)\s+(?=["“A-Z0-9])/)) {
      const t = restore(raw).trim()
      if (t.length >= 50 && t.length <= 400 && /[.!?]["”’]?$/.test(t)) sentences.push({ text: t, para, idx: sentences.length })
    }
  })
  if (sentences.length < 2) return []

  // Term frequency over the whole article: words the story keeps returning to matter most
  const freq = new Map<string, number>()
  for (const s of sentences) for (const w of words(s.text)) freq.set(w, (freq.get(w) ?? 0) + 1)
  const titleWords = new Set(words(title))

  const scored = sentences.map((s) => {
    const ws = words(s.text)
    if (!ws.length) return { ...s, score: 0 }
    const centrality = ws.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(ws.length)
    const titleOverlap = ws.filter((w) => titleWords.has(w)).length
    const lead = s.para === 0 ? 2 : s.para < 3 ? 1 : 0 // news puts the essentials first
    const quote = /^["“]/.test(s.text) ? -1 : 0 // standalone quotes make poor summaries
    return { ...s, score: centrality + titleOverlap * 2 + lead + quote }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.text)
}

/** Fetch one article and summarise it. Returns null when the page can't be read (paywall, block, no text). */
export async function summarizeUrl(url: string, title: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  })
  if (!res.ok) return null
  const paragraphs = extractParagraphs(await res.text())
  const points = keyPoints(title, paragraphs)
  if (points.length < 2) return null
  const wordCount = paragraphs.join(' ').split(/\s+/).length
  return { key_points: points, word_count: wordCount }
}
