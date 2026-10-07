import { useMemo, useRef, useState } from 'react'
import { motion, useDragControls, type PanInfo } from 'motion/react'
import { DotsSixVertical } from '@phosphor-icons/react'
import { StatusRing } from '../../components/jobs/Status'
import { PageHeader, cx } from '../../components/ui'
import { friendlyError } from '../../lib/api'
import { CATEGORY, FLEXIBILITY, STATUS, STATUS_ORDER, daysSince, daysUntilGhost, salaryLabel, type Job, type JobInput, type JobStatus } from '../../lib/jobs'
import { useStore } from '../../lib/store'
import { ViewToggle } from './Applications'

const toInput = (j: Job, status: JobStatus): JobInput => ({
  id: j.id,
  position: j.position,
  company: j.company,
  location: j.location ?? '',
  category: j.category,
  flexibility: j.flexibility,
  status,
  platform: j.platform ?? '',
  link: j.link ?? '',
  salary_min: j.salary_min,
  salary_max: j.salary_max,
  applied_date: j.applied_date,
  notes: j.notes ?? '',
})

/** The column under a screen point, found via the data-drop-status attribute */
function statusAt(point: { x: number; y: number }): JobStatus | null {
  const x = point.x - window.scrollX
  const y = point.y - window.scrollY
  for (const el of document.elementsFromPoint(x, y)) {
    const s = (el as HTMLElement).dataset?.dropStatus
    if (s) return s as JobStatus
  }
  return null
}

export function Board() {
  const { jobs, saveJob } = useStore()
  // Optimistic moves: show the card in its new column while the save is in flight
  const [pending, setPending] = useState<Record<string, JobStatus>>({})
  const [dragFrom, setDragFrom] = useState<JobStatus | null>(null)
  const [hover, setHover] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const columns = useMemo(() => {
    const map = new Map<JobStatus, Job[]>(STATUS_ORDER.map((s) => [s, []]))
    for (const j of jobs) map.get(pending[j.id] ?? j.status)!.push(j)
    for (const list of map.values()) list.sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at))
    return map
  }, [jobs, pending])

  async function move(job: Job, to: JobStatus) {
    setPending((p) => ({ ...p, [job.id]: to }))
    setError(null)
    try {
      await saveJob(toInput(job, to))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setPending(({ [job.id]: _, ...rest }) => rest)
    }
  }

  return (
    <div>
      <PageHeader title="Board">
        <ViewToggle value="board" />
      </PageHeader>
      <p className="-mt-3 mb-5 text-[14px] text-muted">
        Drag a card to another column to change its status, or tap it to edit.
        {error && <span className="ml-2 text-expense">{error}</span>}
      </p>

      {/* Full-bleed horizontal scroller on phones */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="flex w-max gap-3 sm:gap-4">
          {STATUS_ORDER.map((s) => {
            const list = columns.get(s)!
            const isTarget = hover === s && dragFrom !== s
            return (
              <section
                key={s}
                data-drop-status={s}
                aria-label={STATUS[s].label}
                className={cx(
                  // No backdrop-filter here: it would trap the dragged card under neighbouring columns
                  'relative flex w-[264px] shrink-0 flex-col rounded-card border bg-white/50 p-2.5 transition-colors duration-200',
                  isTarget ? 'border-accent bg-accent-soft/70' : 'border-white/80',
                  dragFrom === s && 'z-10',
                )}
              >
                <header data-drop-status={s} className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                  <StatusRing status={s} />
                  <h2 className="flex-1 text-[14px] font-[480]">{STATUS[s].label}</h2>
                  <span className="rounded-pill bg-raised px-2 text-[12px] tabular-nums text-muted">{list.length}</span>
                </header>
                <div data-drop-status={s} className="flex min-h-[120px] flex-1 flex-col gap-2">
                  {list.map((j) => (
                    <BoardCard
                      key={j.id}
                      job={j}
                      status={s}
                      onDragStart={() => setDragFrom(s)}
                      onHover={setHover}
                      onDrop={(to) => {
                        setDragFrom(null)
                        setHover(null)
                        if (to && to !== s) move(j, to)
                      }}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BoardCard({
  job,
  status,
  onDragStart,
  onHover,
  onDrop,
}: {
  job: Job
  status: JobStatus
  onDragStart: () => void
  onHover: (s: JobStatus | null) => void
  onDrop: (s: JobStatus | null) => void
}) {
  const { openJobComposer, highlightId } = useStore()
  const controls = useDragControls()
  const dragged = useRef(false)
  const lastHover = useRef<JobStatus | null>(null)
  const ghostIn = daysUntilGhost(job)
  const salary = salaryLabel(job)

  const track = (_: PointerEvent, info: PanInfo) => {
    const s = statusAt(info.point)
    if (s !== lastHover.current) {
      lastHover.current = s
      onHover(s)
    }
  }

  return (
    <motion.article
      layout
      layoutId={`job-card-${job.id}`}
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragMomentum={false}
      whileDrag={{ scale: 1.04, rotate: -1.5, zIndex: 50, cursor: 'grabbing' }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      onDragStart={() => {
        dragged.current = true
        onDragStart()
      }}
      onDrag={track}
      onDragEnd={(_, info) => {
        lastHover.current = null
        onDrop(statusAt(info.point))
      }}
      // Mouse: drag from anywhere on the card. Touch: only from the grip, so the board can still scroll.
      onPointerDown={(e) => e.pointerType === 'mouse' && controls.start(e)}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false
          return
        }
        openJobComposer(job)
      }}
      className={cx(
        'relative cursor-pointer select-none rounded-[10px] border border-line/80 bg-card p-3 text-left transition-colors hover:border-line-strong',
        highlightId === job.id && 'ring-2 ring-accent/40',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-[480]">{job.company}</p>
          <p className="truncate text-[13px] text-muted">{job.position}</p>
        </div>
        <span
          onPointerDown={(e) => {
            e.stopPropagation()
            controls.start(e)
          }}
          aria-label="Drag to move"
          className="-mr-1 -mt-0.5 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-raised"
        >
          <DotsSixVertical size={16} weight="bold" />
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-pill bg-raised px-2 py-0.5 text-muted">{CATEGORY[job.category]}</span>
        <span className="rounded-pill bg-raised px-2 py-0.5 text-muted">{FLEXIBILITY[job.flexibility]}</span>
        {salary && <span className="rounded-pill bg-accent-soft px-2 py-0.5 tabular-nums text-accent">{salary}</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {status === 'ghosted' && job.auto_ghosted
          ? 'Auto-ghosted'
          : ghostIn !== null && ghostIn <= 4
            ? <span className="text-expense">Ghosted in {ghostIn}d</span>
            : `${daysSince(job.status_changed_at)}d in ${STATUS[status].short}`}
      </p>
    </motion.article>
  )
}
