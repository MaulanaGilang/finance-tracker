import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Briefcase, LockSimple, Wallet } from '@phosphor-icons/react'
import { Logo, useToolTheme } from '../components/AppShell'
import { formatIDR, currentMonth } from '../lib/format'
import { goingQuiet, jobKpis } from '../lib/jobs'
import { EASE_OUT, itemVariants, listVariants } from '../lib/motion'
import { inMonth, totals } from '../lib/stats'
import { useStore } from '../lib/store'

const greeting = () => {
  const h = new Date().getHours()
  return h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Good night'
}

/** After the PIN: pick a tool. Each card glows in its own tool color (Arc-style spaces). */
export function ToolChooser() {
  const { transactions, jobs, lock } = useStore()
  useToolTheme(null)

  const net = totals(inMonth(transactions, currentMonth())).net
  const k = jobKpis(jobs)
  const quiet = goingQuiet(jobs).length

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1000px] flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <button onClick={() => lock()} className="inline-flex items-center gap-2 rounded-pill px-3 py-2 text-[14px] text-muted transition-colors hover:bg-raised hover:text-ink">
          <LockSimple size={16} /> Lock
        </button>
      </header>

      <motion.main className="flex flex-1 flex-col justify-center gap-8 py-8" variants={listVariants} initial="initial" animate="animate">
        <motion.div variants={itemVariants}>
          <p className="mb-2 text-[15px] text-muted">{greeting()}</p>
          <h1 className="font-display text-[32px] leading-[1.15] sm:text-[42px]">What are we tracking?</h1>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <ToolCard
            to="/budget"
            icon={<Wallet size={22} />}
            title="Budget"
            body="Income, spending and reports."
            stat={`Net this month ${net < 0 ? '-' : ''}${formatIDR(Math.abs(net))}`}
            palette={{ '--panel-1': '#2a5f49', '--panel-2': '#1f4d3a', '--panel-3': '#163829', glow: '#cfe7d7' }}
          />
          <ToolCard
            to="/jobs"
            icon={<Briefcase size={22} />}
            title="Job Applications"
            body="Pipeline, follow-ups and responses."
            stat={`${k.active} active${quiet ? ` · ${quiet} going quiet` : ''}`}
            palette={{ '--panel-1': '#3c4c96', '--panel-2': '#2b3a7a', '--panel-3': '#1c2654', glow: '#d6ddf6' }}
          />
        </motion.div>
      </motion.main>
    </div>
  )
}

function ToolCard({
  to,
  icon,
  title,
  body,
  stat,
  palette: { glow, ...vars },
}: {
  to: string
  icon: ReactNode
  title: string
  body: string
  stat: string
  palette: Record<'--panel-1' | '--panel-2' | '--panel-3' | 'glow', string>
}) {
  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
      <Link
        to={to}
        style={vars as CSSProperties}
        className="glow-panel group flex min-h-[220px] flex-col justify-between rounded-[22px] p-6 outline-offset-4 sm:min-h-[260px] sm:p-8"
      >
        {/* Soft-focus light; brightens on hover */}
        <span className="light drift transition-opacity duration-500 group-hover:opacity-60" style={{ width: 300, height: 300, right: '-12%', top: '-40%', background: glow, opacity: 0.35, filter: 'blur(60px)' }} />
        <span className="light drift-slow" style={{ width: 220, height: 220, left: '-10%', bottom: '-45%', background: glow, opacity: 0.25, filter: 'blur(55px)' }} />

        <span className="glass-on-dark flex size-11 items-center justify-center rounded-full">{icon}</span>
        <div>
          <h2 className="mb-1.5 font-display text-[26px] leading-[1.15] sm:text-[30px]">{title}</h2>
          <p className="mb-5 text-[15px] text-white/70">{body}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="glass-on-dark truncate rounded-pill px-3.5 py-1.5 text-[13px] tabular-nums">{stat}</span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-ink transition-transform duration-300 group-hover:translate-x-1">
              <ArrowRight size={18} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
