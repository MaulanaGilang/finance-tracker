import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowSquareOut, CaretDown, Minus, Plus, Star } from '@phosphor-icons/react'
import type { CompanyReview } from '../../lib/jobs'
import { EASE_OUT } from '../../lib/motion'
import { cx } from '../ui'

/** Small rating chip for tables and cards: "★ 4.3", or nothing when no rating exists */
export function RatingChip({ review, className }: { review: CompanyReview | null; className?: string }) {
  if (!review?.rating) return null
  const tone = review.rating >= 4 ? 'text-income' : review.rating >= 3 ? 'text-ink' : 'text-expense'
  return (
    <span className={cx('inline-flex items-center gap-1 text-[12px] font-[480] tabular-nums', tone, className)} title={`${review.rating} on ${review.rating_source}`}>
      <Star size={12} weight="fill" />
      {review.rating.toFixed(1)}
    </span>
  )
}

/**
 * What employees say about a company, from the researched reviews.
 * Collapsed to a one-line summary; expands to pros, cons, caveats and sources.
 */
export function CompanyReviewPanel({ review, company }: { review: CompanyReview | null; company: string }) {
  const [open, setOpen] = useState(false)
  const hasDetail = !!review && (review.pros.length > 0 || review.cons.length > 0 || !!review.notes)

  if (!review)
    return (
      <div className="rounded-card bg-raised/70 px-4 py-3 text-[13px] text-muted">
        No review researched for {company} yet. Ask Claude to research it.
      </div>
    )

  const summary = review.rating
    ? `${review.rating.toFixed(1)} / 5 on ${review.rating_source}${review.review_count ? ` · ${review.review_count.toLocaleString('en-US')} reviews` : ''}${review.recommend_pct != null ? ` · ${review.recommend_pct}% recommend` : ''}`
    : review.pros.length || review.cons.length
      ? 'No overall rating; group-level or small-sample reviews'
      : 'No reliable reviews found'

  return (
    <div className="rounded-card border border-line bg-card/70">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((o) => !o)}
        aria-expanded={open}
        className={cx('flex w-full items-center gap-3 px-4 py-3 text-left', hasDetail && 'cursor-pointer')}
      >
        <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-full', review.rating ? 'bg-accent-soft text-accent' : 'bg-raised text-muted')}>
          <Star size={17} weight={review.rating ? 'fill' : 'regular'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-[480]">What employees say</span>
          <span className="block truncate text-[12px] text-muted">{summary}</span>
        </span>
        {hasDetail && <CaretDown size={16} className={cx('shrink-0 text-muted transition-transform duration-300', open && 'rotate-180')} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-3.5">
              {(review.pros.length > 0 || review.cons.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PointList title="Good" items={review.pros} icon={<Plus size={12} weight="bold" />} tone="text-income bg-income/10" />
                  <PointList title="Watch out" items={review.cons} icon={<Minus size={12} weight="bold" />} tone="text-expense bg-expense/10" />
                </div>
              )}
              {review.notes && <p className="text-[12px] leading-[1.5] text-muted">{review.notes}</p>}
              {review.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {review.sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-pill bg-raised px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-accent"
                    >
                      {s.label} <ArrowSquareOut size={11} />
                    </a>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted">
                Researched {new Date(review.researched_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Reviews are anonymous and unverified.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PointList({ title, items, icon, tone }: { title: string; items: string[]; icon: React.ReactNode; tone: string }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-2 text-[12px] font-[480] text-muted">{title}</p>
      <ul className="flex flex-col gap-2">
        {items.map((p) => (
          <li key={p} className="flex gap-2 text-[13px] leading-[1.45]">
            <span className={cx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full', tone)}>{icon}</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
