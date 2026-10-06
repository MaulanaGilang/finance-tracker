const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export const formatIDR = (n: number) => idr.format(Math.round(n)).replace(/ /g, ' ')

export const formatNumber = (n: number) => plain.format(n)

/** Short axis labels: 350K, 1.2M, 3.4B */
export function formatCompact(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (a >= 1e9) return `${sign}${trim(a / 1e9)}B`
  if (a >= 1e6) return `${sign}${trim(a / 1e6)}M`
  if (a >= 1e3) return `${sign}${trim(a / 1e3)}K`
  return `${sign}${a}`
}
const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''))

/** Parse "1.250.000" style input into a number */
export const parseAmount = (s: string) => Number(s.replace(/\D/g, '')) || 0

// ---- dates (all local, as YYYY-MM-DD strings) ----

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISODate(new Date())

/** Month key: YYYY-MM */
export const monthKey = (iso: string) => iso.slice(0, 7)
export const currentMonth = () => monthKey(todayISO())

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthRange(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number)
  return [`${key}-01`, toISODate(new Date(y, m, 0))]
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return style === 'long'
    ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { month: 'short' })
}

export function dayLabel(iso: string): string {
  const today = todayISO()
  const yesterday = toISODate(new Date(Date.now() - 864e5))
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Days between two ISO dates, inclusive */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 864e5) + 1
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}
