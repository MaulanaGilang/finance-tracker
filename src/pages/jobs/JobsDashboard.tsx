import { useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle, HourglassMedium } from '@phosphor-icons/react'
import { HeroPanel } from '../../components/HeroPanel'
import { AnimatedNumber } from '../../components/motion-primitives/animated-number'
import { BreakdownBars, FlowSankey, WeeklyChart } from '../../components/jobs/JobCharts'
import { StatusPill } from '../../components/jobs/Status'
import { Button, Card, CardTitle, Empty, Skeleton, cx } from '../../components/ui'
import {
  CATEGORY,
  FLEXIBILITY,
  breakdown,
  flowGraph,
  formatJuta,
  funnel,
  goingQuiet,
  jobKpis,
  perWeek,
  salaryOverview,
  salaryLabel,
  type Job,
} from '../../lib/jobs'
import { EASE_OUT, itemVariants, listVariants, numberSpring } from '../../lib/motion'
import { useStore } from '../../lib/store'

export function JobsDashboard() {
  const { jobs, loading, openJobComposer } = useStore()

  const d = useMemo(
    () => ({
      k: jobKpis(jobs),
      funnel: funnel(jobs),
      flow: flowGraph(jobs),
      quiet: goingQuiet(jobs),
      weekly: perWeek(jobs),
      platforms: breakdown(jobs, (j) => j.platform),
      categories: breakdown(jobs, (j) => CATEGORY[j.category]),
      flex: breakdown(jobs, (j) => FLEXIBILITY[j.flexibility]),
      locations: breakdown(jobs, (j) => j.location),
      salary: salaryOverview(jobs),
      recent: [...jobs].sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at)).slice(0, 5),
    }),
    [jobs],
  )

  if (loading && jobs.length === 0) return <Skeletons />
  if (jobs.length === 0)
    return (
      <Card>
        <Empty
          title="No applications yet"
          body="Add the jobs you apply to and this page fills with your pipeline, response rates and salaries."
          action={
            <Button variant="primary" onClick={() => openJobComposer()}>
              Add application
            </Button>
          }
        />
      </Card>
    )

  const { k } = d

  return (
    <motion.div className="flex flex-col gap-6 sm:gap-8" variants={listVariants} initial="initial" animate="animate">
      <h1 className="sr-only">Job applications dashboard</h1>

      {/* Hero: same KPIs as the original sheet, in the glowing ink panel */}
      <motion.div variants={itemVariants}>
        <HeroPanel>
          <div>
            <p className="mb-3 text-[14px] text-white/70">Active applications</p>
            <AnimatedNumber value={k.active} springOptions={numberSpring} className="block font-display text-[48px] leading-[1.05] sm:text-[64px]" />
            <p className="mt-3 text-[13px] leading-[1.6] text-white/70">
              {k.total} sent · {Math.round(k.responseRate * 100)}% got a response
              <br />
              {k.inactive} inactive ({k.rejected} rejected, {k.ghosted} ghosted)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="HR interview" value={k.hr} />
            <HeroStat label="Test" value={k.test} />
            <HeroStat label="User interview" value={k.user} />
            <HeroStat label="Offers" value={k.offers} />
          </div>
        </HeroPanel>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardTitle>Application flow</CardTitle>
          <FlowSankey data={d.flow} />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
        <Card>
          <CardTitle>Pipeline</CardTitle>
          <Funnel stages={d.funnel} />
        </Card>
        <GoingQuiet items={d.quiet} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <Card>
          <CardTitle>Applications per week</CardTitle>
          <WeeklyChart data={d.weekly} />
        </Card>
        <Card>
          <CardTitle>Response rate by platform</CardTitle>
          <BreakdownBars data={d.platforms} showResponse limit={6} />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Salary data={d.salary} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        <Card>
          <CardTitle>Category</CardTitle>
          <BreakdownBars data={d.categories} />
        </Card>
        <Card>
          <CardTitle>Flexibility</CardTitle>
          <BreakdownBars data={d.flex} />
        </Card>
        <Card>
          <CardTitle>Top locations</CardTitle>
          <BreakdownBars data={d.locations} limit={5} />
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardTitle
            action={
              <Link to="/jobs/applications" className="group inline-flex items-center gap-1.5 text-[14px] text-accent">
                View all <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            }
          >
            Recently updated
          </CardTitle>
          <ul className="-mx-2 sm:-mx-3">
            {d.recent.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </ul>
        </Card>
      </motion.div>
    </motion.div>
  )
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-on-dark min-w-0 rounded-card px-4 py-3.5 sm:p-5">
      <p className="mb-1.5 truncate text-[13px] text-white/70">{label}</p>
      <AnimatedNumber value={value} springOptions={numberSpring} className="block font-display text-[24px] sm:text-[28px]" />
    </div>
  )
}

/** Stage bars sized by how many applications ever reached them, with the step conversion between stages */
function Funnel({ stages }: { stages: ReturnType<typeof funnel> }) {
  const top = Math.max(1, stages[0].reached)
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((s, i) => (
        <li key={s.stage} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[9rem_1fr_auto]">
          <span className={cx('truncate text-[14px]', s.reached === 0 && 'text-muted')}>{s.label}</span>
          <span className="relative h-7">
            <motion.span
              className="absolute inset-y-0 left-0 origin-left rounded-[6px] bg-accent"
              style={{ width: `${Math.max(1.5, (s.reached / top) * 100)}%`, opacity: s.reached ? 1 - i * 0.11 : 0.15 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: EASE_OUT }}
            />
          </span>
          <span className="flex w-[5.5rem] items-baseline justify-end gap-2 tabular-nums">
            <span className="text-[15px] font-[480]">{s.reached}</span>
            <span className="w-10 text-right text-[12px] text-muted">{s.conversion === null ? '' : `${Math.round(s.conversion * 100)}%`}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Waiting applications close to the 14-day ghost rule */
function GoingQuiet({ items }: { items: ReturnType<typeof goingQuiet> }) {
  const { openJobComposer } = useStore()
  return (
    <Card>
      <CardTitle>Going quiet</CardTitle>
      {items.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <CheckCircle size={22} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[14px] leading-[1.5] text-muted">
            Nothing is close to being ghosted. Applications show up here after 10 days without a status change.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-muted">No update for 10+ days. A follow-up message now can keep these alive.</p>
          <ul className="-mx-2 flex flex-col">
            {items.slice(0, 6).map(({ job, daysLeft }) => (
              <li key={job.id}>
                <button onClick={() => openJobComposer(job)} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-raised">
                  <HourglassMedium size={18} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-[440]">{job.company}</span>
                    <span className="block truncate text-[12px] text-muted">{job.position}</span>
                  </span>
                  <span className={cx('shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-[480] tabular-nums', daysLeft <= 1 ? 'bg-expense/10 text-expense' : 'bg-accent-soft text-accent')}>
                    {daysLeft === 0 ? 'today' : `${daysLeft}d left`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.length > 6 && <p className="mt-2 text-[13px] text-muted">+{items.length - 6} more</p>}
        </>
      )}
    </Card>
  )
}

/** Advertised salary ranges on one shared scale, highest first */
function Salary({ data }: { data: ReturnType<typeof salaryOverview> }) {
  if (!data)
    return (
      <Card>
        <CardTitle>Salary overview</CardTitle>
        <p className="text-[14px] text-muted">Add salary ranges to your applications to compare them here.</p>
      </Card>
    )
  const span = Math.max(1, data.ceiling - data.floor)
  const pos = (n: number) => ((n - data.floor) / span) * 100
  return (
    <Card>
      <CardTitle>Salary overview</CardTitle>
      <dl className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <dt className="mb-1 text-[13px] text-muted">Median offer</dt>
          <dd className="font-display text-[21px] tabular-nums sm:text-[24px]">Rp {formatJuta(data.median)}</dd>
        </div>
        <div>
          <dt className="mb-1 text-[13px] text-muted">Range seen</dt>
          <dd className="text-[16px] font-[480] tabular-nums sm:text-[18px]">
            {formatJuta(data.floor)} - {formatJuta(data.ceiling)}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-[13px] text-muted">With salary listed</dt>
          <dd className="text-[16px] font-[480] tabular-nums sm:text-[18px]">{data.withSalary}</dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-3">
        {data.ranged.slice(0, 8).map(({ job, lo, hi }, i) => (
          <li key={job.id} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[14rem_1fr_7.5rem] sm:items-center sm:gap-4">
            <span className="min-w-0 truncate text-[14px]">
              {job.company} <span className="text-muted">· {job.position}</span>
            </span>
            <span className="relative h-2">
              <motion.span
                className="absolute inset-y-0 origin-left rounded-full bg-accent"
                style={{ left: `${pos(lo)}%`, width: `${Math.max(1.5, pos(hi) - pos(lo))}%` }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.85 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: EASE_OUT }}
              />
            </span>
            <span className="text-[13px] tabular-nums text-muted sm:text-right">{salaryLabel(job)}</span>
          </li>
        ))}
      </ul>
      {data.ranged.length > 8 && <p className="mt-4 text-[13px] text-muted">Showing the 8 highest of {data.ranged.length}.</p>}
    </Card>
  )
}

export function JobRow({ job }: { job: Job }) {
  const { openJobComposer, highlightId } = useStore()
  return (
    <li>
      <button
        onClick={() => openJobComposer(job)}
        className={cx(
          'flex w-full items-center gap-3.5 rounded-[10px] px-2 py-3 text-left transition-colors hover:bg-raised sm:px-3',
          highlightId === job.id && 'bg-accent-soft',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[14px] font-[480] text-accent" aria-hidden>
          {job.company.replace(/^PT\.?\s+/i, '').charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-[440]">{job.company}</span>
          <span className="block truncate text-[13px] text-muted">{job.position}</span>
        </span>
        <StatusPill status={job.status} auto={job.auto_ghosted && job.status === 'ghosted'} className="shrink-0" />
      </button>
    </li>
  )
}

function Skeletons() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Skeleton className="h-48 w-full rounded-[20px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}
