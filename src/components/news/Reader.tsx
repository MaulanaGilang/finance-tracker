import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowSquareOut, BookmarkSimple, Clock, X } from '@phosphor-icons/react'
import { EASE_OUT, sheetSpring } from '../../lib/motion'
import { readMinutes, timeAgo } from '../../lib/news'
import { useStore } from '../../lib/store'
import { IconButton, cx } from '../ui'
import { ImpactBadge, TopicTag } from './Article'
import { isHighImpact } from '../../lib/news'

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

/** In-app reader: the story's key points, so you rarely need to open the original site */
export function NewsReader() {
  const { reading, closeArticle } = useStore()
  return <AnimatePresence>{reading && <ReaderSheet key={reading.id} onClose={closeArticle} />}</AnimatePresence>
}

function ReaderSheet({ onClose }: { onClose: () => void }) {
  const { reading: a, toggleNewsSaved } = useStore()
  const [wide] = useState(isWide)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!a) return null
  const minutes = readMinutes(a.word_count)
  const points = a.key_points ?? []

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={a.title}>
      <motion.div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[6px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      />
      <motion.article
        initial={wide ? { opacity: 0, scale: 0.97, y: 12, filter: 'blur(6px)' } : { y: '100%' }}
        animate={
          wide
            ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT }, transitionEnd: { filter: 'none' } }
            : { y: 0, transition: sheetSpring }
        }
        exit={wide ? { opacity: 0, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.2 } } : { y: '100%', transition: { duration: 0.25, ease: 'easeIn' } }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[24px] bg-canvas/90 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl sm:max-w-[640px] sm:rounded-card sm:border sm:border-line sm:p-8"
      >
        {/* Grab handle on phones */}
        <span className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />

        <header className="mb-4 flex items-start justify-between gap-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[13px] text-muted">
            <span className="font-[480] text-ink">{a.source}</span>
            <span>{timeAgo(a.published_at)}</span>
            {minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> {minutes} min read
              </span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label={a.saved ? 'Remove from saved' : 'Save for later'} onClick={() => toggleNewsSaved(a).catch(() => {})} className={a.saved ? 'text-accent' : undefined}>
              <BookmarkSimple size={20} weight={a.saved ? 'fill' : 'regular'} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
        </header>

        <h2 className="mb-4 font-display text-[22px] leading-[1.25] sm:text-[26px]">{a.title}</h2>
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          {isHighImpact(a) && <ImpactBadge />}
          {a.topics.map((t) => (
            <TopicTag key={t} topic={t} />
          ))}
        </div>

        {/* Key points: the article's most informative sentences */}
        <section aria-label="Key points" className="mb-6">
          <h3 className="mb-3 text-[13px] font-[480] text-muted">Key points</h3>
          {a.details_status === 'pending' ? (
            <div className="flex flex-col gap-3" aria-busy>
              {[90, 75, 85, 60].map((w, i) => (
                <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
              ))}
              <p className="text-[12px] text-muted">Reading the article…</p>
            </div>
          ) : points.length ? (
            <ol className="flex flex-col gap-3.5">
              {points.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT, delay: 0.08 + i * 0.06 }, transitionEnd: { filter: 'none' } }}
                  className="flex gap-3 text-[15px] leading-[1.6] sm:text-[16px]"
                >
                  <span className="mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-[480] tabular-nums text-accent">
                    {i + 1}
                  </span>
                  <span>{p}</span>
                </motion.li>
              ))}
            </ol>
          ) : (
            <div className="rounded-card bg-raised/70 px-4 py-3 text-[14px] leading-[1.55] text-muted">
              {a.summary ? <p className="mb-2 text-ink">{a.summary}</p> : null}
              This site doesn't allow previews (paywall or blocked), so only the feed summary is available.
            </div>
          )}
        </section>

        {points.length > 0 && a.summary && !points.some((p) => p.startsWith(a.summary!.slice(0, 40))) && (
          <section className="mb-6 rounded-card bg-raised/60 px-4 py-3">
            <h3 className="mb-1 text-[12px] font-[480] text-muted">From the feed</h3>
            <p className="text-[14px] leading-[1.55]">{a.summary}</p>
          </section>
        )}

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12px] text-muted">{points.length > 0 ? 'Key points are sentences taken from the article, not AI-written.' : ''}</p>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className={cx('glow-button inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-4 text-[14px] text-white')}
          >
            Read on {a.source} <ArrowSquareOut size={15} />
          </a>
        </footer>
      </motion.article>
    </div>
  )
}
