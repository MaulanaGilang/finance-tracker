import { useMemo, useState, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react'
import { ArrowRight, CalendarBlank, Receipt, Star, TrendDown, TrendUp } from '@phosphor-icons/react'
import { CashflowChart, CategoryDonut, CategoryLegend, ChartLegend } from '../components/Charts'
import { TransactionRow } from '../components/TransactionList'
import { AnimatedMoney, Button, Card, CardTitle, Delta, Empty, MonthStepper, Skeleton, cx } from '../components/ui'
import { addMonths, currentMonth, formatIDR, monthLabel, todayISO } from '../lib/format'
import { itemVariants, listVariants } from '../lib/motion'
import { byCategory, change, inMonth, monthInsights, monthlySeries, totals, type Insight } from '../lib/stats'
import { useStore } from '../lib/store'

export function Dashboard() {
  const { transactions, categories, loading, openComposer } = useStore()
  const [month, setMonth] = useState(currentMonth)

  const data = useMemo(() => {
    const thisMonth = inMonth(transactions, month)
    const prevMonth = inMonth(transactions, addMonths(month, -1))
    return {
      t: totals(thisMonth),
      prev: totals(prevMonth),
      slices: byCategory(thisMonth, categories, 'expense'),
      series: monthlySeries(transactions, month, 6),
      recent: thisMonth.slice(0, 5),
      insights: monthInsights(thisMonth, prevMonth, categories, month, todayISO(), formatIDR),
    }
  }, [transactions, categories, month])

  if (loading && transactions.length === 0) return <DashboardSkeleton />

  const { t, prev, slices, series, recent, insights } = data

  return (
    <motion.div className="flex flex-col gap-6 sm:gap-8" variants={listVariants} initial="initial" animate="animate">
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="sr-only">Dashboard</h1>
        <MonthStepper value={month} onChange={setMonth} />
      </motion.div>

      {/* Hero: net balance for the month, then income and expense */}
      <motion.div variants={itemVariants}>
        <HeroPanel>
          <div>
            <p className="mb-3 text-[14px] text-white/70">Net this month</p>
            <AnimatedMoney
              value={t.net}
              signed
              className={cx('block font-display text-[40px] leading-[1.1] sm:text-[56px]', t.net < 0 && 'text-[#f4b4a8]')}
            />
            <p className="mt-3 text-[13px] text-white/70">
              {t.income > 0 ? `You kept ${Math.max(0, Math.round((t.net / t.income) * 100))}% of your income.` : 'No income recorded yet.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat label="Income" value={t.income} delta={change(t.income, prev.income)} goodWhenUp />
            <Stat label="Expenses" value={t.expense} delta={change(t.expense, prev.expense)} goodWhenUp={false} />
          </div>
        </HeroPanel>
      </motion.div>

      {insights.length > 0 && (
        <motion.section variants={itemVariants} aria-label="Insights" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {insights.map((i) => (
            <InsightTile key={i.kind} insight={i} />
          ))}
        </motion.section>
      )}

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.25fr] lg:gap-8">
        <Card>
          <CardTitle>Spending by category</CardTitle>
          {slices.length === 0 ? (
            <Empty title="No spending yet" body={`Expenses you add for ${monthLabel(month)} will show up here.`} />
          ) : (
            <div className="grid items-center gap-7 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[170px_minmax(0,1fr)]">
              <CategoryDonut data={slices} total={t.expense} />
              <CategoryLegend data={slices} limit={6} />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle action={<ChartLegend />}>Last 6 months</CardTitle>
          <CashflowChart data={series} />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardTitle
            action={
              <Link to="/transactions" className="group inline-flex items-center gap-1.5 text-[14px] text-forest">
                View all <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            }
          >
            Latest transactions
          </CardTitle>
          {recent.length === 0 ? (
            <Empty
              title="Nothing here yet"
              body="Add your first income or expense to start tracking."
              action={
                <Button variant="primary" onClick={() => openComposer()}>
                  Add transaction
                </Button>
              }
            />
          ) : (
            <ul className="-mx-2 sm:-mx-3">
              <AnimatePresence>
                {recent.map((tx, i) => (
                  <TransactionRow key={tx.id} tx={tx} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}

/**
 * The deep-forest balance panel. Ambient lights drift on their own; on devices with a mouse,
 * one extra soft light trails the pointer, like the glowing objects in Mercury's illustrations.
 */
function HeroPanel({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(-400)
  const y = useMotionValue(-400)
  const sx = useSpring(x, { stiffness: 120, damping: 24, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 120, damping: 24, mass: 0.6 })
  const finePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - r.left - 160)
    y.set(e.clientY - r.top - 160)
  }

  return (
    <section
      onPointerMove={finePointer ? onMove : undefined}
      className="glow-panel group grid gap-6 rounded-[20px] p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-end md:gap-10 md:p-10"
    >
      <span className="light drift" style={{ width: 340, height: 340, right: '-6%', top: '-55%', background: '#e9f1ea', opacity: 0.32, filter: 'blur(70px)' }} />
      <span className="light drift-slow" style={{ width: 260, height: 260, left: '-8%', bottom: '-60%', background: '#9fc9ae', opacity: 0.4, filter: 'blur(60px)' }} />
      <span className="light" style={{ width: 120, height: 120, right: '30%', bottom: '-20%', background: '#ffffff', opacity: 0.16, filter: 'blur(40px)' }} />
      {finePointer && (
        <motion.span
          className="light left-0 top-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ x: sx, y: sy, width: 320, height: 320, background: 'radial-gradient(circle, rgb(233 243 236 / 0.28) 0%, transparent 65%)' }}
        />
      )}
      {children}
    </section>
  )
}

function Stat({ label, value, delta, goodWhenUp }: { label: string; value: number; delta: number | null; goodWhenUp: boolean }) {
  return (
    // Phones: full-width row (label + change left, amount right). Larger screens: compact tile.
    <div className="glass-on-dark flex min-w-0 items-center justify-between gap-3 rounded-card px-4 py-3.5 sm:block sm:p-5">
      <div className="flex flex-col gap-1 sm:contents">
        <p className="text-[13px] text-white/70 sm:mb-2">{label}</p>
        <span className="sm:hidden">
          <Delta value={delta} goodWhenUp={goodWhenUp} onDark />
        </span>
      </div>
      <AnimatedMoney value={value} className="block font-display text-[19px] sm:mb-2 sm:text-[21px]" />
      <span className="hidden sm:inline">
        <Delta value={delta} goodWhenUp={goodWhenUp} onDark />
      </span>
    </div>
  )
}

const INSIGHT_ICON = {
  'trend-up': TrendUp,
  'trend-down': TrendDown,
  top: Star,
  daily: CalendarBlank,
  biggest: Receipt,
} as const

function InsightTile({ insight }: { insight: Insight }) {
  const Icon = INSIGHT_ICON[insight.kind]
  return (
    <div className="frost flex min-w-0 items-start gap-3.5 rounded-card border border-white/80 p-4 ring-1 ring-line/60 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="mb-1 text-[12px] font-[480] text-muted">{insight.label}</p>
        <p className="text-[14px] leading-[1.4] text-ink">{insight.text}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Skeleton className="h-11 w-56 rounded-pill" />
      <Skeleton className="h-48 w-full rounded-[20px]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}
