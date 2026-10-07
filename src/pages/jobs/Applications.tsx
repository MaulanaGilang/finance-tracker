import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowSquareOut, MagnifyingGlass } from '@phosphor-icons/react'
import { StatusPill } from '../../components/jobs/Status'
import { Button, Card, Empty, PageHeader, Segmented, Skeleton, cx, inputClass, selectClass } from '../../components/ui'
import { shortDate } from '../../lib/format'
import {
  CATEGORY,
  FLEXIBILITY,
  STATUS,
  STATUS_ORDER,
  daysSince,
  daysUntilGhost,
  salaryLabel,
  type Job,
  type JobCategory,
  type JobFlexibility,
  type JobStatus,
} from '../../lib/jobs'
import { EASE_OUT } from '../../lib/motion'
import { useStore } from '../../lib/store'

type Sort = 'applied' | 'updated' | 'company'

/** Table / Board switch shared by both job views */
export function ViewToggle({ value }: { value: 'table' | 'board' }) {
  const navigate = useNavigate()
  return (
    <Segmented
      label="View"
      value={value}
      onChange={(v) => navigate(v === 'board' ? '/jobs/board' : '/jobs/applications')}
      options={[
        { value: 'table', label: 'Table' },
        { value: 'board', label: 'Board' },
      ]}
    />
  )
}

export function Applications() {
  const { jobs, loading, openJobComposer } = useStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | JobStatus>('all')
  const [category, setCategory] = useState<'all' | JobCategory>('all')
  const [flex, setFlex] = useState<'all' | JobFlexibility>('all')
  const [platform, setPlatform] = useState('all')
  const [sort, setSort] = useState<Sort>('applied')

  const platforms = useMemo(() => [...new Set(jobs.map((j) => j.platform).filter(Boolean))].sort() as string[], [jobs])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = jobs.filter(
      (j) =>
        (status === 'all' || (status === 'open' ? j.status !== 'rejected' && j.status !== 'ghosted' : j.status === status)) &&
        (category === 'all' || j.category === category) &&
        (flex === 'all' || j.flexibility === flex) &&
        (platform === 'all' || j.platform === platform) &&
        (!q || [j.company, j.position, j.location, j.notes].some((s) => s?.toLowerCase().includes(q))),
    )
    const by: Record<Sort, (a: Job, b: Job) => number> = {
      applied: (a, b) => b.applied_date.localeCompare(a.applied_date) || b.created_at.localeCompare(a.created_at),
      updated: (a, b) => b.status_changed_at.localeCompare(a.status_changed_at),
      company: (a, b) => a.company.localeCompare(b.company),
    }
    return list.sort(by[sort])
  }, [jobs, query, status, category, flex, platform, sort])

  const filtered = query !== '' || status !== 'all' || category !== 'all' || flex !== 'all' || platform !== 'all'
  const clear = () => {
    setQuery('')
    setStatus('all')
    setCategory('all')
    setFlex('all')
    setPlatform('all')
  }

  return (
    <div>
      <PageHeader title="Applications">
        <ViewToggle value="table" />
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative col-span-2 md:col-span-1">
          <label className="sr-only" htmlFor="job-search">
            Search applications
          </label>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input id="job-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, position, notes" className={cx(inputClass, 'h-11 pl-10')} />
        </div>
        <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as typeof status)}>
          <option value="all">All statuses</option>
          <option value="open">Active only</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Category" value={category} onChange={(v) => setCategory(v as typeof category)}>
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY) as JobCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY[c]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Flexibility" value={flex} onChange={(v) => setFlex(v as typeof flex)}>
          <option value="all">Any flexibility</option>
          {(Object.keys(FLEXIBILITY) as JobFlexibility[]).map((f) => (
            <option key={f} value={f}>
              {FLEXIBILITY[f]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Platform" value={platform} onChange={setPlatform}>
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </FilterSelect>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-[14px] text-muted">
          {rows.length} of {jobs.length} applications
          {filtered && (
            <button onClick={clear} className="ml-3 text-accent hover:underline">
              Clear filters
            </button>
          )}
        </p>
        <label className="flex items-center gap-2 text-[14px] text-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cx(selectClass, 'h-9 w-auto px-4 pr-9 text-[14px]')}>
            <option value="applied">Newest applied</option>
            <option value="updated">Recently updated</option>
            <option value="company">Company A-Z</option>
          </select>
        </label>
      </div>

      <Card className="px-2 py-3 sm:px-3 sm:py-4">
        {loading && jobs.length === 0 ? (
          <div className="flex flex-col gap-3 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtered ? (
            <Empty title="No matches" body="Nothing matches these filters." action={<Button onClick={clear}>Clear filters</Button>} />
          ) : (
            <Empty
              title="No applications yet"
              body="Every job you apply to goes here."
              action={
                <Button variant="primary" onClick={() => openJobComposer()}>
                  Add application
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Column headings, desktop only */}
            <div className="hidden grid-cols-[minmax(0,2.2fr)_10.5rem_minmax(0,1fr)_minmax(0,0.9fr)_7.5rem_5.5rem_2.25rem] gap-4 px-3 pb-2 text-[12px] font-[480] text-muted lg:grid">
              <span>Company</span>
              <span>Status</span>
              <span>Type</span>
              <span>Platform</span>
              <span>Salary</span>
              <span className="text-right">Applied</span>
              <span />
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {rows.map((j, i) => (
                  <TableRow key={j.id} job={j} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(selectClass, 'h-11 truncate text-[15px]')}>
        {children}
      </select>
    </label>
  )
}

function TableRow({ job, index }: { job: Job; index: number }) {
  const { openJobComposer, highlightId } = useStore()
  const ghostIn = daysUntilGhost(job)
  const quiet = ghostIn !== null && ghostIn <= 4
  const salary = salaryLabel(job)

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT, delay: Math.min(index, 12) * 0.025 }, transitionEnd: { filter: 'none' } }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.25, ease: EASE_OUT } }}
      className="overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => openJobComposer(job)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openJobComposer(job))}
        className={cx(
          'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[10px] px-2 py-3 transition-colors hover:bg-raised sm:px-3 lg:grid-cols-[minmax(0,2.2fr)_10.5rem_minmax(0,1fr)_minmax(0,0.9fr)_7.5rem_5.5rem_2.25rem]',
          highlightId === job.id && 'bg-accent-soft',
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] font-[440]">{job.company}</p>
          <p className="truncate text-[13px] text-muted">
            {job.position}
            {job.location && <span className="lg:hidden"> · {job.location}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 lg:items-start">
          <StatusPill status={job.status} auto={job.auto_ghosted && job.status === 'ghosted'} />
          {quiet && <span className="text-[11px] text-expense">ghosted in {ghostIn}d</span>}
        </div>
        {/* Mobile meta line */}
        <p className="col-span-2 truncate text-[12px] text-muted lg:hidden">
          {CATEGORY[job.category]} · {FLEXIBILITY[job.flexibility]}
          {job.platform && ` · ${job.platform}`}
          {salary && ` · ${salary}`} · applied {shortDate(job.applied_date)}
        </p>
        <span className="hidden truncate text-[14px] lg:block">
          {CATEGORY[job.category]} <span className="text-muted">· {FLEXIBILITY[job.flexibility]}</span>
        </span>
        <span className="hidden truncate text-[14px] lg:block">{job.platform ?? <span className="text-muted">-</span>}</span>
        <span className="hidden truncate text-[14px] tabular-nums lg:block">{salary ?? <span className="text-muted">-</span>}</span>
        <span className="hidden text-right text-[14px] tabular-nums lg:block" title={`Status changed ${daysSince(job.status_changed_at)} days ago`}>
          {shortDate(job.applied_date)}
        </span>
        <span className="hidden justify-end lg:flex">
          {job.link && (
            <a
              href={job.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open job posting for ${job.company}`}
              className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-accent"
            >
              <ArrowSquareOut size={17} />
            </a>
          )}
        </span>
      </div>
    </motion.li>
  )
}
