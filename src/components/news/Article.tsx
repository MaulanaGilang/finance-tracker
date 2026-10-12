import { motion } from 'motion/react'
import { ArrowUpRight, BookmarkSimple, TrendUp } from '@phosphor-icons/react'
import { EASE_OUT } from '../../lib/motion'
import { TOPICS, isHighImpact, plainText, timeAgo, type NewsArticle, type NewsTopic } from '../../lib/news'
import { useStore } from '../../lib/store'
import { cx } from '../ui'

export function TopicTag({ topic, className }: { topic: NewsTopic; className?: string }) {
  const { short, color } = TOPICS[topic]
  return (
    <span
      className={cx('inline-flex h-6 items-center rounded-pill px-2.5 text-[11px] font-[480]', className)}
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: `color-mix(in srgb, ${color} 88%, #1c211e)` }}
    >
      {short}
    </span>
  )
}

export function ImpactBadge() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-accent px-2.5 text-[11px] font-[480] text-white" title="Mentions several market-moving terms">
      <TrendUp size={12} weight="bold" /> Market mover
    </span>
  )
}

/** One story: source + time, headline (opens the original), short summary, topic tags, save toggle */
export function ArticleRow({ article, index = 0, compact = false }: { article: NewsArticle; index?: number; compact?: boolean }) {
  const { toggleNewsSaved, openArticle } = useStore()
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT, delay: Math.min(index, 8) * 0.02 } }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
      className="group relative overflow-hidden rounded-[12px] px-2 py-3.5 transition-colors hover:bg-raised/70 sm:px-3"
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            <span className="font-[480] text-ink">{article.source}</span>
            <span>{timeAgo(article.published_at)}</span>
          </p>
          {/* Opens the in-app reader (key points); the original link lives inside it */}
          <button
            onClick={() => openArticle(article)}
            className="block text-left text-[15px] font-[480] leading-[1.35] text-ink decoration-accent/40 underline-offset-4 hover:underline sm:text-[16px]"
          >
            {article.title}
            <ArrowUpRight size={13} className="ml-1 inline -translate-y-px text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          {!compact && (article.key_points?.[0] || article.summary) && (
            <p className="mt-1.5 line-clamp-2 text-[14px] leading-[1.5] text-muted">{article.key_points?.[0] ?? plainText(article.summary)}</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {isHighImpact(article) && <ImpactBadge />}
            {article.topics.map((t) => (
              <TopicTag key={t} topic={t} />
            ))}
          </div>
        </div>
        <button
          onClick={() => toggleNewsSaved(article).catch(() => {})}
          aria-label={article.saved ? 'Remove from saved' : 'Save for later'}
          aria-pressed={article.saved}
          className={cx(
            'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-card',
            article.saved ? 'text-accent' : 'text-muted',
          )}
        >
          <BookmarkSimple size={19} weight={article.saved ? 'fill' : 'regular'} />
        </button>
      </div>
    </motion.li>
  )
}
