import type { Category, Transaction, TxType } from './api'
import { addMonths, monthKey, monthLabel } from './format'

export interface Totals {
  income: number
  expense: number
  net: number
}

export function totals(txs: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, net: income - expense }
}

export const inRange = (txs: Transaction[], from: string, to: string) =>
  txs.filter((t) => t.date >= from && t.date <= to)

export const inMonth = (txs: Transaction[], key: string) => txs.filter((t) => monthKey(t.date) === key)

export interface CategorySlice {
  id: string
  name: string
  color: string
  amount: number
  share: number // 0..1
}

const UNCATEGORISED = { name: 'Uncategorised', color: '#B9BDB7' }

export function byCategory(txs: Transaction[], categories: Category[], type: TxType): CategorySlice[] {
  const map = new Map<string, number>()
  let total = 0
  for (const t of txs) {
    if (t.type !== type) continue
    const key = t.category_id ?? 'none'
    map.set(key, (map.get(key) ?? 0) + t.amount)
    total += t.amount
  }
  const catById = new Map(categories.map((c) => [c.id, c]))
  return [...map.entries()]
    .map(([id, amount]) => {
      const c = catById.get(id) ?? UNCATEGORISED
      return { id, name: c.name, color: c.color, amount, share: total ? amount / total : 0 }
    })
    .sort((a, b) => b.amount - a.amount)
}

export interface MonthPoint {
  key: string
  label: string
  income: number
  expense: number
  net: number
}

/** `count` months ending at (and including) `endKey` */
export function monthlySeries(txs: Transaction[], endKey: string, count: number): MonthPoint[] {
  const keys = Array.from({ length: count }, (_, i) => addMonths(endKey, i - count + 1))
  const buckets = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]))
  for (const t of txs) {
    const b = buckets.get(monthKey(t.date))
    if (b) b[t.type] += t.amount
  }
  return keys.map((key) => {
    const b = buckets.get(key)!
    return { key, label: monthLabel(key, 'short'), ...b, net: b.income - b.expense }
  })
}

export interface Insight {
  kind: 'trend-up' | 'trend-down' | 'top' | 'daily' | 'biggest'
  label: string
  text: string
}

/**
 * Three plain-language facts about a month's spending:
 * the category that moved most vs last month, average spend per day, and the single biggest expense.
 */
export function monthInsights(
  monthTx: Transaction[],
  prevMonthTx: Transaction[],
  categories: Category[],
  key: string,
  today: string,
  fmt: (n: number) => string,
): Insight[] {
  const expenses = monthTx.filter((t) => t.type === 'expense')
  if (expenses.length === 0) return []
  const out: Insight[] = []

  const cur = byCategory(monthTx, categories, 'expense')
  const prev = new Map(byCategory(prevMonthTx, categories, 'expense').map((s) => [s.id, s.amount]))
  let mover: { name: string; delta: number } | null = null
  for (const s of cur) {
    const p = prev.get(s.id)
    if (!p) continue
    const d = (s.amount - p) / p
    if (Math.abs(d) >= 0.05 && (!mover || Math.abs(d) > Math.abs(mover.delta))) mover = { name: s.name, delta: d }
  }
  if (mover) {
    out.push({
      kind: mover.delta > 0 ? 'trend-up' : 'trend-down',
      label: 'Biggest change',
      text: `${mover.name} is ${mover.delta > 0 ? 'up' : 'down'} ${Math.round(Math.abs(mover.delta) * 100)}% vs last month`,
    })
  } else {
    out.push({ kind: 'top', label: 'Top category', text: `${cur[0].name} takes ${Math.round(cur[0].share * 100)}% of your spending` })
  }

  // Days elapsed: the whole month for past months, up to today for the current one
  const [y, m] = key.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const days = monthKey(today) === key ? Number(today.slice(8, 10)) : daysInMonth
  const spent = expenses.reduce((s, t) => s + t.amount, 0)
  out.push({ kind: 'daily', label: 'Daily average', text: `${fmt(spent / Math.max(1, days))} per day` })

  const big = expenses.reduce((a, b) => (b.amount > a.amount ? b : a))
  const bigName = big.note || categories.find((c) => c.id === big.category_id)?.name || 'Uncategorised'
  out.push({ kind: 'biggest', label: 'Biggest expense', text: `${bigName}, ${fmt(big.amount)}` })

  return out
}

/** Relative change, or null when there is no baseline to compare against */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}
