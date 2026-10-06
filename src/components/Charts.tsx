import { useId } from 'react'
import { motion } from 'motion/react'
import { EASE_OUT } from '../lib/motion'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact, formatIDR } from '../lib/format'
import type { CategorySlice, MonthPoint } from '../lib/stats'

const INCOME = '#2F7A55'
const EXPENSE = '#B5483B'
const GRID = '#E4E4DC'
const TICK = { fill: '#616862', fontSize: 12 }

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color: string }[] }) {
  return (
    <div className="frost rounded-[12px] border border-white/80 px-3.5 py-2.5 text-[13px] ring-1 ring-line/60">
      <p className="mb-1.5 font-[480]">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 tabular-nums">
          <span className="size-2 rounded-full" style={{ background: r.color }} />
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto pl-4">{formatIDR(r.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Income vs expense as two soft area lines: gradient fills fade to nothing, lines carry a faint glow. */
export function CashflowChart({ data, height = 240 }: { data: MonthPoint[]; height?: number }) {
  // React 19 ids contain characters that are invalid inside SVG url(#...) references
  const id = 'cf' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glowDot = (color: string) => ({ r: 5, fill: color, stroke: '#ffffff', strokeWidth: 2, style: { filter: `url(#${id}-glow)` } })
  return (
    // Lines draw in left to right when the chart mounts. Mount, not scroll-into-view: a missed\n    // intersection event would otherwise leave the chart permanently clipped.
    <motion.div
      style={{ height }}
      className="-ml-2"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      transition={{ duration: 1.1, delay: 0.15, ease: EASE_OUT }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-inc`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INCOME} stopOpacity={0.32} />
              <stop offset="100%" stopColor={INCOME} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}-exp`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EXPENSE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={EXPENSE} stopOpacity={0} />
            </linearGradient>
            <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={6} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={TICK} tickFormatter={formatCompact} width={44} />
          <Tooltip
            cursor={{ stroke: '#C9CBC2', strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={(payload[0].payload as MonthPoint).label}
                  rows={[
                    { label: 'Income', value: (payload[0].payload as MonthPoint).income, color: INCOME },
                    { label: 'Expense', value: (payload[0].payload as MonthPoint).expense, color: EXPENSE },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke={INCOME}
            strokeWidth={2.5}
            fill={`url(#${id}-inc)`}
            isAnimationActive={false}
            dot={false}
            activeDot={glowDot(INCOME)}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Expense"
            stroke={EXPENSE}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill={`url(#${id}-exp)`}
            isAnimationActive={false}
            dot={false}
            activeDot={glowDot(EXPENSE)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-[13px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-[2.5px] w-4 rounded-full" style={{ background: INCOME }} />
        Income
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: EXPENSE }} />
        Expense
      </span>
    </div>
  )
}

export function CategoryDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[220px]"
      initial={{ opacity: 0, rotate: -25, scale: 0.94 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 1.5 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={String(payload[0].name)}
                  rows={[{ label: 'Spent', value: Number(payload[0].value), color: (payload[0].payload as CategorySlice).color }]}
                />
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[12px] text-muted">Total spent</span>
        <span className="font-display text-[17px] tabular-nums">{formatCompact(total)}</span>
      </div>
    </motion.div>
  )
}

export function CategoryLegend({ data, limit }: { data: CategorySlice[]; limit?: number }) {
  const rows = limit ? data.slice(0, limit) : data
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((d) => (
        <li key={d.id} className="flex items-center gap-3 text-[14px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="min-w-0 flex-1 truncate">{d.name}</span>
          <span className="w-10 shrink-0 text-right tabular-nums text-muted">{Math.round(d.share * 100)}%</span>
          <span className="shrink-0 text-right tabular-nums">{formatIDR(d.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
