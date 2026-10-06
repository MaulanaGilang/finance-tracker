import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Transaction } from '../lib/api'
import { dayLabel, formatIDR } from '../lib/format'
import { EASE_OUT } from '../lib/motion'
import { useCategoryMap, useStore } from '../lib/store'
import { Money, cx } from './ui'

/**
 * A row comes into focus on mount (staggered by index), collapses away when deleted,
 * and glows softly for a moment right after it was saved.
 */
export function TransactionRow({ tx, index = 0 }: { tx: Transaction; index?: number }) {
  const { openComposer, highlightId } = useStore()
  const cat = useCategoryMap().get(tx.category_id ?? '')
  const fresh = highlightId === tx.id

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.45, ease: EASE_OUT, delay: Math.min(index, 10) * 0.035 },
        transitionEnd: { filter: 'none' },
      }}
      exit={{ opacity: 0, height: 0, filter: 'blur(4px)', transition: { duration: 0.28, ease: EASE_OUT } }}
      className="overflow-hidden"
    >
      <button
        onClick={() => openComposer(tx)}
        className="relative flex w-full items-center gap-3.5 rounded-[10px] px-2 py-3 text-left transition-colors hover:bg-raised sm:px-3"
      >
        {/* Saved-just-now glow */}
        <AnimatePresence>
          {fresh && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-[10px] bg-forest-soft"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0], transition: { duration: 1.8, times: [0, 0.15, 0.6, 1] } }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <span
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-[480] text-white"
          style={{ background: cat?.color ?? '#B9BDB7' }}
          aria-hidden
        >
          {(cat?.name ?? '?').charAt(0)}
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-[15px] font-[440]">{tx.note || cat?.name || 'Uncategorised'}</span>
          <span className="block truncate text-[13px] text-muted">{tx.note ? cat?.name ?? 'Uncategorised' : dayLabel(tx.date)}</span>
        </span>
        <Money value={tx.amount} type={tx.type} className="relative shrink-0 text-[15px] font-[480]" />
      </button>
    </motion.li>
  )
}

/** Transactions grouped under day headings with each day's net total. */
export function GroupedTransactions({ items }: { items: Transaction[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of items) {
      const g = map.get(t.date)
      if (g) g.push(t)
      else map.set(t.date, [t])
    }
    return [...map.entries()]
  }, [items])

  let rowIndex = 0
  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence initial={false}>
        {groups.map(([date, txs]) => {
          const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
          return (
            <motion.section
              key={date}
              layout="position"
              exit={{ opacity: 0, height: 0, transition: { duration: 0.28, ease: EASE_OUT } }}
              className="overflow-hidden"
            >
              <header className="mb-1 flex items-center justify-between px-2 sm:px-3">
                <h3 className="text-[13px] font-[480] text-muted">{dayLabel(date)}</h3>
                <span className={cx('text-[13px] tabular-nums', net >= 0 ? 'text-income' : 'text-muted')}>
                  {net >= 0 ? '+' : '-'}
                  {formatIDR(Math.abs(net))}
                </span>
              </header>
              <ul>
                <AnimatePresence>
                  {txs.map((t) => (
                    <TransactionRow key={t.id} tx={t} index={rowIndex++} />
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
