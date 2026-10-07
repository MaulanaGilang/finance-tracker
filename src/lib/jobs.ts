// Job application tracker: types, labels, and the numbers behind the Jobs dashboard.

export type JobStatus =
  | 'applied'
  | 'hr_interview'
  | 'test'
  | 'user_interview'
  | 'medical_checkup'
  | 'offer'
  | 'accepted'
  | 'other'
  | 'rejected'
  | 'ghosted'
export type JobCategory = 'contract' | 'full_time' | 'part_time'
export type JobFlexibility = 'onsite' | 'remote' | 'hybrid'

export interface Job {
  id: string
  position: string
  company: string
  location: string | null
  category: JobCategory
  flexibility: JobFlexibility
  status: JobStatus
  platform: string | null
  link: string | null
  salary_min: number | null
  salary_max: number | null
  applied_date: string // YYYY-MM-DD
  status_changed_at: string // ISO timestamp
  auto_ghosted: boolean
  max_stage: number // furthest pipeline stage reached, 0..6
  notes: string | null
  created_at: string
  updated_at: string
}

export interface JobInput {
  id?: string
  position: string
  company: string
  location: string
  category: JobCategory
  flexibility: JobFlexibility
  status: JobStatus
  platform: string
  link: string
  salary_min: number | null
  salary_max: number | null
  applied_date: string
  notes: string
}

/**
 * Status meta. `stage` is the pipeline position (0 applied .. 6 accepted) used by the status ring;
 * stage null = off-pipeline (other / rejected / ghosted).
 * Colors are the Ink status palette.
 */
export const STATUS: Record<JobStatus, { label: string; short: string; color: string; stage: number | null }> = {
  applied: { label: 'Applied', short: 'Applied', color: '#6B7A99', stage: 0 },
  hr_interview: { label: 'HR interview', short: 'HR', color: '#3E5BA9', stage: 1 },
  test: { label: 'Test', short: 'Test', color: '#7A5BB5', stage: 2 },
  user_interview: { label: 'User interview', short: 'User', color: '#2B3A7A', stage: 3 },
  medical_checkup: { label: 'Medical checkup', short: 'MCU', color: '#2F7A55', stage: 4 },
  offer: { label: 'Offer', short: 'Offer', color: '#2F7A55', stage: 5 },
  accepted: { label: 'Accepted', short: 'Accepted', color: '#1F6B45', stage: 6 },
  other: { label: 'Other', short: 'Other', color: '#9A8F7A', stage: null },
  rejected: { label: 'Rejected', short: 'Rejected', color: '#B5483B', stage: null },
  ghosted: { label: 'Ghosted', short: 'Ghosted', color: '#A3A69F', stage: null },
}

/** Board column / select order */
export const STATUS_ORDER: JobStatus[] = [
  'applied',
  'hr_interview',
  'test',
  'user_interview',
  'medical_checkup',
  'offer',
  'accepted',
  'other',
  'rejected',
  'ghosted',
]

export const CATEGORY: Record<JobCategory, string> = { contract: 'Contract', full_time: 'Full time', part_time: 'Part time' }
export const FLEXIBILITY: Record<JobFlexibility, string> = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' }

export const GHOST_DAYS = 14
export const QUIET_FROM_DAYS = 10

/** Still waiting on the company: these are the ones the ghost rule watches */
export const isWaiting = (s: JobStatus) => !['rejected', 'ghosted', 'offer', 'accepted'].includes(s)
/** "Active" as in your sheet: anything not closed */
export const isActive = (s: JobStatus) => s !== 'rejected' && s !== 'ghosted'

export const daysSince = (iso: string, now = Date.now()) => Math.floor((now - new Date(iso).getTime()) / 864e5)

/** Days until the ghost rule fires, or null when it doesn't apply */
export function daysUntilGhost(job: Job, now = Date.now()): number | null {
  if (!isWaiting(job.status)) return null
  return Math.max(0, GHOST_DAYS - daysSince(job.status_changed_at, now))
}

/** A response = anything beyond "applied" happened, including a rejection. Ghosted and still-applied are no response. */
export const gotResponse = (j: Job) => j.max_stage >= 1 || j.status === 'rejected' || j.status === 'offer' || j.status === 'accepted'

// ---------------------------------------------------------------------------
// Dashboard numbers

export function jobKpis(jobs: Job[]) {
  const count = (s: JobStatus) => jobs.filter((j) => j.status === s).length
  const responded = jobs.filter(gotResponse).length
  return {
    total: jobs.length,
    active: jobs.filter((j) => isActive(j.status)).length,
    hr: count('hr_interview'),
    user: count('user_interview'),
    test: count('test'),
    offers: count('offer') + count('accepted'),
    inactive: count('rejected') + count('ghosted'),
    rejected: count('rejected'),
    ghosted: count('ghosted'),
    responseRate: jobs.length ? responded / jobs.length : 0,
  }
}

export const FUNNEL_STAGES = [
  { stage: 0, label: 'Applied' },
  { stage: 1, label: 'HR interview' },
  { stage: 2, label: 'Test' },
  { stage: 3, label: 'User interview' },
  { stage: 4, label: 'Medical checkup' },
  { stage: 5, label: 'Offer' },
  { stage: 6, label: 'Accepted' },
]

/** How many applications reached each stage (by furthest stage ever reached), and the step-to-step conversion */
export function funnel(jobs: Job[]) {
  return FUNNEL_STAGES.map(({ stage, label }, i) => {
    const reached = jobs.filter((j) => j.max_stage >= stage).length
    const prevReached = i === 0 ? reached : jobs.filter((j) => j.max_stage >= FUNNEL_STAGES[i - 1].stage).length
    return { stage, label, reached, conversion: i === 0 || !prevReached ? null : reached / prevReached }
  })
}

export interface FlowNode {
  name: string
  color: string
  /** stage nodes continue the pipeline; outcome nodes are where applications stopped */
  kind: 'root' | 'stage' | 'outcome'
}
export interface FlowGraph {
  nodes: FlowNode[]
  links: { source: number; target: number; value: number }[]
}

const STAGE_FLOW: { stage: number; status: JobStatus }[] = [
  { stage: 1, status: 'hr_interview' },
  { stage: 2, status: 'test' },
  { stage: 3, status: 'user_interview' },
  { stage: 4, status: 'medical_checkup' },
  { stage: 5, status: 'offer' },
  { stage: 6, status: 'accepted' },
]

/**
 * Sankey data: Applications -> each stage reached -> the next stage, branching off at every step
 * into where applications ended (rejected / ghosted). Applications still active at a stage simply
 * stay on that stage's node, so its outgoing flows are thinner than its incoming one.
 */
export function flowGraph(jobs: Job[]): FlowGraph {
  const nodes: FlowNode[] = [{ name: 'Applications', color: '#8A8F87', kind: 'root' }]
  const links: FlowGraph['links'] = []
  const add = (node: FlowNode, from: number, value: number) => {
    if (value <= 0) return -1
    nodes.push(node)
    links.push({ source: from, target: nodes.length - 1, value })
    return nodes.length - 1
  }

  let from = 0
  for (let s = 0; s <= 6; s++) {
    const endedHere = jobs.filter((j) => j.max_stage === s)
    // Outcomes first so they stack above the continuing pipeline, like the reference chart
    if (s === 0) add({ name: 'Waiting', color: STATUS.applied.color, kind: 'outcome' }, from, endedHere.filter((j) => isActive(j.status)).length)
    add({ name: s === 0 ? 'No answer' : 'Ghosted', color: STATUS.ghosted.color, kind: 'outcome' }, from, endedHere.filter((j) => j.status === 'ghosted').length)
    add({ name: 'Rejected', color: STATUS.rejected.color, kind: 'outcome' }, from, endedHere.filter((j) => j.status === 'rejected').length)

    const next = STAGE_FLOW[s]
    if (!next) break
    const reached = jobs.filter((j) => j.max_stage >= next.stage).length
    const idx = add({ name: STATUS[next.status].label, color: STATUS[next.status].color, kind: 'stage' }, from, reached)
    if (idx < 0) break
    from = idx
  }
  return { nodes, links }
}

/** Waiting applications 10-13 days without a status change: follow up before they turn ghosted */
export function goingQuiet(jobs: Job[], now = Date.now()) {
  return jobs
    .filter((j) => isWaiting(j.status) && daysSince(j.status_changed_at, now) >= QUIET_FROM_DAYS)
    .map((j) => ({ job: j, daysLeft: daysUntilGhost(j, now) ?? 0 }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface Breakdown {
  key: string
  count: number
  share: number
  responseRate: number
}

export function breakdown(jobs: Job[], pick: (j: Job) => string | null | undefined): Breakdown[] {
  const map = new Map<string, Job[]>()
  for (const j of jobs) {
    const k = pick(j)?.trim() || 'Unknown'
    map.set(k, [...(map.get(k) ?? []), j])
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      count: list.length,
      share: jobs.length ? list.length / jobs.length : 0,
      responseRate: list.filter(gotResponse).length / list.length,
    }))
    .sort((a, b) => b.count - a.count)
}

/** Monday-based week start, as YYYY-MM-DD */
function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Applications sent per week for the last `weeks` weeks (including the current one) */
export function perWeek(jobs: Job[], weeks = 10, today = new Date()) {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const end = new Date(weekStart(todayIso) + 'T00:00:00')
  const keys = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (weeks - 1 - i) * 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const counts = new Map(keys.map((k) => [k, 0]))
  for (const j of jobs) {
    const k = weekStart(j.applied_date)
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1)
  }
  return keys.map((k) => ({
    key: k,
    label: new Date(k + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    count: counts.get(k)!,
  }))
}

/** Advertised salary ranges: min/max/median of the range midpoints */
export function salaryOverview(jobs: Job[]) {
  const ranged = jobs
    .filter((j) => j.salary_min || j.salary_max)
    .map((j) => {
      const lo = j.salary_min ?? j.salary_max!
      const hi = j.salary_max ?? j.salary_min!
      return { job: j, lo, hi, mid: (lo + hi) / 2 }
    })
    .sort((a, b) => b.mid - a.mid)
  if (!ranged.length) return null
  const mids = ranged.map((r) => r.mid).sort((a, b) => a - b)
  const m = Math.floor(mids.length / 2)
  const median = mids.length % 2 ? mids[m] : (mids[m - 1] + mids[m]) / 2
  return {
    ranged,
    median,
    floor: Math.min(...ranged.map((r) => r.lo)),
    ceiling: Math.max(...ranged.map((r) => r.hi)),
    withSalary: ranged.length,
  }
}

/** "Rp 7,5 jt" style short salary label */
export function formatJuta(n: number): string {
  const jt = n / 1e6
  return `${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1).replace('.', ',')} jt`
}

export function salaryLabel(j: Pick<Job, 'salary_min' | 'salary_max'>): string | null {
  if (!j.salary_min && !j.salary_max) return null
  if (j.salary_min && j.salary_max && j.salary_min !== j.salary_max) return `${formatJuta(j.salary_min)} - ${formatJuta(j.salary_max)}`
  return formatJuta((j.salary_min ?? j.salary_max)!)
}
