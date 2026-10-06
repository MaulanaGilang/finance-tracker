import { useMemo, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { CashflowChart, ChartLegend } from '../components/Charts'
import { AnimatedMoney, Card, CardTitle, Delta, Empty, Field, IconButton, PageHeader, Segmented, cx, inputClass } from '../components/ui'
import type { TxType } from '../lib/api'
import { addMonths, currentMonth, daysBetween, formatIDR, monthRange, shiftDate, todayISO } from '../lib/format'
import { byCategory, change, inRange, monthlySeries, totals } from '../lib/stats'
import { useStore } from '../lib/store'

type Period = 'month' | '3m' | 'year' | 'custom'

function periodRange(p: Period, custom: [string, string]): { cur: [string, string]; prev: [string, string]; label: string } {
  const m = currentMonth()
  const year = m.slice(0, 4)
  switch (p) {
    case 'month':
      return { cur: monthRange(m), prev: monthRange(addMonths(m, -1)), label: 'last month' }
    case '3m':
      return {
        cur: [monthRange(addMonths(m, -2))[0], monthRange(m)[1]],
        prev: [monthRange(addMonths(m, -5))[0], monthRange(addMonths(m, -3))[1]],
        label: 'previous 3 months',
      }
    case 'year':
      return { cur: [`${year}-01-01`, `${year}-12-31`], prev: [`${+year - 1}-01-01`, `${+year - 1}-12-31`], label: 'last year' }
    case 'custom': {
      const [from, to] = custom[0] <= custom[1] ? custom : [custom[1], custom[0]]
      const len = daysBetween(from, to)
      return { cur: [from, to], prev: [shiftDate(from, -len), shiftDate(from, -1)], label: 'previous period' }
    }
  }
}

export function Reports() {
  const { transactions, categories } = useStore()
  const [period, setPeriod] = useState<Period>('month')
  const [custom, setCustom] = useState<[string, string]>(() => [monthRange(currentMonth())[0], todayISO()])
  const [breakdownType, setBreakdownType] = useState<TxType>('expense')

  const r = periodRange(period, custom)

  const report = useMemo(() => {
    const curTx = inRange(transactions, ...r.cur)
    const prevTx = inRange(transactions, ...r.prev)
    const prevSlices = new Map(byCategory(prevTx, categories, breakdownType).map((s) => [s.id, s.amount]))
    return {
      cur: totals(curTx),
      prev: totals(prevTx),
      slices: byCategory(curTx, categories, breakdownType).map((s) => ({
        ...s,
        delta: change(s.amount, prevSlices.get(s.id) ?? 0),
      })),
    }
    // r is derived from period/custom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, breakdownType, period, custom])

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Reports" />

      <div className="flex flex-col gap-4">
        <Segmented
          label="Period"
          value={period}
          onChange={setPeriod}
          className="w-full sm:w-auto sm:self-start"
          options={[
            { value: 'month', label: 'Month' },
            { value: '3m', label: '3 months' },
            { value: 'year', label: 'Year' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Field label="From" htmlFor="from">
              <input id="from" type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} className={inputClass} />
            </Field>
            <Field label="To" htmlFor="to">
              <input id="to" type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} className={inputClass} />
            </Field>
          </div>
        )}
      </div>

      {/* Period summary vs the previous equivalent period */}
      <section className="grid grid-cols-1 overflow-hidden rounded-card border border-line bg-card sm:grid-cols-3 sm:divide-x sm:divide-line">
        <Summary label="Income" value={report.cur.income} delta={change(report.cur.income, report.prev.income)} goodWhenUp vs={r.label} className="text-income" />
        <Summary label="Expenses" value={report.cur.expense} delta={change(report.cur.expense, report.prev.expense)} goodWhenUp={false} vs={r.label} />
        <Summary
          label="Net"
          value={report.cur.net}
          delta={report.prev.net === 0 ? null : (report.cur.net - report.prev.net) / Math.abs(report.prev.net)}
          goodWhenUp
          vs={r.label}
          className={report.cur.net < 0 ? 'text-expense' : undefined}
        />
      </section>

      <Card>
        <CardTitle
          action={
            <Segmented
              label="Breakdown type"
              value={breakdownType}
              onChange={setBreakdownType}
              options={[
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
              ]}
            />
          }
        >
          By category
        </CardTitle>
        {report.slices.length === 0 ? (
          <Empty title={`No ${breakdownType === 'expense' ? 'expenses' : 'income'} in this period`} />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="hidden grid-cols-[1fr_140px_70px_110px] gap-4 px-1 pb-2 text-[12px] font-[480] text-muted sm:grid">
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Share</span>
              <span className="text-right">vs {r.label}</span>
            </div>
            {report.slices.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-[10px] px-1 py-2.5 sm:grid-cols-[1fr_140px_70px_110px]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex items-center gap-2.5 text-[15px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  {/* share bar with no background track */}
                  <span className="ml-5 block h-1 rounded-full" style={{ width: `${Math.max(2, s.share * 100)}%`, background: s.color, opacity: 0.85 }} />
                </div>
                <span className="text-right text-[15px] tabular-nums">{formatIDR(s.amount)}</span>
                <span className="hidden text-right text-[14px] tabular-nums text-muted sm:block">{(s.share * 100).toFixed(1)}%</span>
                <span className="col-span-2 flex justify-end gap-3 text-right sm:col-span-1 sm:block">
                  <span className="text-[13px] tabular-nums text-muted sm:hidden">{(s.share * 100).toFixed(1)}%</span>
                  <Delta value={s.delta} goodWhenUp={breakdownType === 'income'} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <YearView />
    </div>
  )
}

function Summary({
  label,
  value,
  delta,
  goodWhenUp,
  vs,
  className,
}: {
  label: string
  value: number
  delta: number | null
  goodWhenUp: boolean
  vs: string
  className?: string
}) {
  return (
    <div className="border-b border-line p-5 last:border-b-0 sm:border-b-0 sm:p-7">
      <p className="mb-2 text-[14px] text-muted">{label}</p>
      <AnimatedMoney value={value} signed className={cx('mb-2 block font-display text-[24px] sm:text-[28px]', className)} />
      <p className="flex flex-wrap items-center gap-1.5">
        <Delta value={delta} goodWhenUp={goodWhenUp} />
        {delta !== null && <span className="text-[12px] text-muted">vs {vs}</span>}
      </p>
    </div>
  )
}

function YearView() {
  const { transactions } = useStore()
  const thisYear = Number(currentMonth().slice(0, 4))
  const [year, setYear] = useState(thisYear)

  const { series, total, monthsElapsed } = useMemo(() => {
    // Future months have no data yet: leave them empty so the lines stop at today instead of dropping to zero
    const now = currentMonth()
    const series = monthlySeries(transactions, `${year}-12`, 12).map((p) =>
      p.key > now ? { ...p, income: null as unknown as number, expense: null as unknown as number } : p,
    )
    const elapsed = year < thisYear ? 12 : year === thisYear ? Number(currentMonth().slice(5)) : 0
    return {
      series,
      total: totals(inRange(transactions, `${year}-01-01`, `${year}-12-31`)),
      monthsElapsed: elapsed,
    }
  }, [transactions, year, thisYear])

  const avg = (n: number) => (monthsElapsed ? n / monthsElapsed : 0)

  return (
    <Card>
      <CardTitle
        action={
          <div className="flex items-center gap-1">
            <IconButton label="Previous year" className="size-9" onClick={() => setYear((y) => y - 1)}>
              <CaretLeft size={16} />
            </IconButton>
            <span className="w-12 text-center text-[14px] font-[480] tabular-nums">{year}</span>
            <IconButton label="Next year" className="size-9" disabled={year >= thisYear} onClick={() => setYear((y) => y + 1)}>
              <CaretRight size={16} />
            </IconButton>
          </div>
        }
      >
        Year overview
      </CardTitle>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <YearStat label="Total income" value={total.income} />
        <YearStat label="Total expenses" value={total.expense} />
        <YearStat label="Avg. income / month" value={avg(total.income)} />
        <YearStat label="Avg. spend / month" value={avg(total.expense)} />
      </dl>

      <div className="mb-3 flex justify-end">
        <ChartLegend />
      </div>
      <CashflowChart data={series} height={260} />
    </Card>
  )
}

function YearStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="mb-1 text-[13px] text-muted">{label}</dt>
      <dd className="text-[16px] font-[480] tabular-nums sm:text-[18px]">{formatIDR(value)}</dd>
    </div>
  )
}
