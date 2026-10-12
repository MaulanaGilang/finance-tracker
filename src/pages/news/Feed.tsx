import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence } from 'motion/react'
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react'
import { ArticleRow } from '../../components/news/Article'
import { Card, Empty, PageHeader, cx, inputClass } from '../../components/ui'
import { TOPICS, TOPIC_ORDER, isHighImpact, type NewsTopic } from '../../lib/news'
import { useStore } from '../../lib/store'

/** Every story, newest first, filterable by topic / impact / search. With `savedOnly` it's the Saved page. */
export function NewsFeed({ savedOnly = false }: { savedOnly?: boolean }) {
  const { news } = useStore()
  const [params, setParams] = useSearchParams()
  const topic = (params.get('topic') as NewsTopic | null) ?? null
  const [impactOnly, setImpactOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(40)

  const setTopic = (t: NewsTopic | null) => {
    const next = new URLSearchParams(params)
    if (t) next.set('topic', t)
    else next.delete('topic')
    setParams(next, { replace: true })
    setLimit(40)
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return news.filter(
      (a) =>
        (!savedOnly || a.saved) &&
        (!topic || a.topics.includes(topic)) &&
        (!impactOnly || isHighImpact(a)) &&
        (!q || a.title.toLowerCase().includes(q) || (a.summary ?? '').toLowerCase().includes(q) || a.source.toLowerCase().includes(q)),
    )
  }, [news, savedOnly, topic, impactOnly, query])

  const chip = (active: boolean) =>
    cx(
      'inline-flex h-9 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-[14px] transition-colors',
      active ? 'border-accent bg-accent-soft font-[480] text-accent' : 'border-line bg-card/70 text-ink hover:border-line-strong',
    )

  return (
    <div>
      <PageHeader title={savedOnly ? 'Saved' : 'Feed'} />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative md:max-w-md">
          <label className="sr-only" htmlFor="news-search">
            Search stories
          </label>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input id="news-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search headlines and sources" className={cx(inputClass, 'h-11 pl-10')} />
        </div>
        {/* Topic chips scroll sideways on phones */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <button className={chip(!topic)} onClick={() => setTopic(null)}>
            All topics
          </button>
          {TOPIC_ORDER.map((t) => (
            <button key={t} className={chip(topic === t)} onClick={() => setTopic(topic === t ? null : t)} aria-pressed={topic === t}>
              <span className="size-2 rounded-full" style={{ background: TOPICS[t].color }} />
              {TOPICS[t].label}
            </button>
          ))}
          <button className={chip(impactOnly)} onClick={() => setImpactOnly((v) => !v)} aria-pressed={impactOnly}>
            <TrendUp size={14} weight="bold" /> Market movers
          </button>
        </div>
      </div>

      <p className="mb-3 px-1 text-[14px] text-muted">
        {rows.length} {rows.length === 1 ? 'story' : 'stories'}
      </p>

      <Card className="px-2 py-2 sm:px-4 sm:py-3">
        {rows.length === 0 ? (
          <Empty
            title={savedOnly ? 'Nothing saved yet' : 'No stories match'}
            body={savedOnly ? 'Tap the bookmark on any story to keep it here. Saved stories are never deleted.' : 'Try another topic or clear the search.'}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line/70">
            <AnimatePresence initial={false}>
              {rows.slice(0, limit).map((a, i) => (
                <ArticleRow key={a.id} article={a} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {rows.length > limit && (
          <div className="flex justify-center py-3">
            <button onClick={() => setLimit((l) => l + 40)} className="h-10 rounded-pill bg-raised px-5 text-[14px] transition-colors hover:bg-line">
              Show more ({rows.length - limit} left)
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
