import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowsLeftRight,
  Briefcase,
  ChartBar,
  GearSix,
  Kanban,
  ListBullets,
  Plus,
  SquaresFour,
  Table,
  Wallet,
} from '@phosphor-icons/react'
import { pillSpring } from '../lib/motion'
import { useStore } from '../lib/store'
import { cx } from './ui'

export type Tool = 'budget' | 'jobs'

export const TOOLS = {
  budget: { name: 'Budget', icon: Wallet, home: '/budget' },
  jobs: { name: 'Job Applications', icon: Briefcase, home: '/jobs' },
} as const

const NAV = {
  budget: [
    { to: '/budget', label: 'Dashboard', mobile: 'Dashboard', icon: SquaresFour },
    { to: '/budget/transactions', label: 'Transactions', mobile: 'History', icon: ListBullets },
    { to: '/budget/reports', label: 'Reports', mobile: 'Reports', icon: ChartBar },
    { to: '/budget/settings', label: 'Settings', mobile: 'Settings', icon: GearSix },
  ],
  jobs: [
    { to: '/jobs', label: 'Dashboard', mobile: 'Dashboard', icon: SquaresFour },
    { to: '/jobs/applications', label: 'Applications', mobile: 'List', icon: Table },
    { to: '/jobs/board', label: 'Board', mobile: 'Board', icon: Kanban },
    { to: '/jobs/settings', label: 'Settings', mobile: 'Settings', icon: GearSix },
  ],
} as const

type NavItem = (typeof NAV)[Tool][number]

/** Re-tints the whole app for the active tool (Arc-style spaces). */
export function useToolTheme(tool: Tool | null) {
  useEffect(() => {
    if (tool) document.documentElement.dataset.tool = tool
    else delete document.documentElement.dataset.tool
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F7F7F2')
  }, [tool])
}

/** Two concentric rings, same mark as the app icon */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-canvas transition-colors duration-500">
        <svg width="18" height="18" viewBox="0 0 44 44" aria-hidden>
          <circle cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <circle cx="22" cy="22" r="8.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
        </svg>
      </span>
      <span className="font-display text-[18px]">Ledger</span>
    </span>
  )
}

/** Shows the current tool; tapping returns to the tool chooser */
function ToolSwitch({ tool }: { tool: Tool }) {
  const { name, icon: Icon } = TOOLS[tool]
  return (
    <Link
      to="/"
      title="Switch tool"
      className="frost inline-flex h-9 items-center gap-2 rounded-pill border border-white/80 pl-2.5 pr-3 text-[14px] ring-1 ring-line/60 transition-colors hover:text-accent"
    >
      <Icon size={16} className="text-accent" />
      <span className="max-w-[9rem] truncate">{name}</span>
      <ArrowsLeftRight size={14} className="text-muted" />
    </Link>
  )
}

export function AppShell({ tool, children }: { tool: Tool; children: ReactNode }) {
  const { openComposer, openJobComposer } = useStore()
  useToolTheme(tool)
  const nav = NAV[tool]
  const add = () => (tool === 'jobs' ? openJobComposer() : openComposer())

  return (
    <div className="min-h-[100dvh]">
      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-20 hidden border-b border-white/60 bg-canvas/55 backdrop-blur-xl backdrop-saturate-150 md:block">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-8">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="All tools">
              <Logo />
            </Link>
            <ToolSwitch tool={tool} />
          </div>
          <nav aria-label="Main" className="flex items-center gap-1">
            {nav.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === TOOLS[tool].home} className="relative rounded-pill px-4 py-2 text-[15px]">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="nav-pill" transition={pillSpring} className="absolute inset-0 rounded-pill bg-accent-soft" />
                    )}
                    <span className={cx('relative transition-colors', isActive ? 'font-[480] text-accent' : 'text-muted hover:text-ink')}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <motion.button
            onClick={add}
            whileTap={{ scale: 0.97 }}
            className="glow-button inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-5 text-[15px] text-white"
          >
            <Plus size={16} weight="bold" />
            Add
          </motion.button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Link to="/" aria-label="All tools">
          <Logo />
        </Link>
        <ToolSwitch tool={tool} />
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-4 md:px-8 md:pb-16 md:pt-10">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-canvas/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {nav.slice(0, 2).map((item) => (
            <TabLink key={item.to} item={item} end={item.to === TOOLS[tool].home} />
          ))}
          <div className="flex justify-center">
            <AddFab onClick={add} label={tool === 'jobs' ? 'Add application' : 'Add transaction'} />
          </div>
          {nav.slice(2).map((item) => (
            <TabLink key={item.to} item={item} end={item.to === TOOLS[tool].home} />
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Centre + button: presses in, and a soft ring ripples out on each tap */
function AddFab({ onClick, label }: { onClick: () => void; label: string }) {
  const [pulse, setPulse] = useState(0)
  return (
    <motion.button
      onClick={() => {
        setPulse((p) => p + 1)
        onClick()
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      aria-label={label}
      className="glow-button relative flex size-12 items-center justify-center rounded-full bg-accent text-white"
    >
      <AnimatePresence>
        {pulse > 0 && (
          <motion.span
            key={pulse}
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <Plus size={22} weight="bold" />
    </motion.button>
  )
}

function TabLink({ item: { to, mobile, icon: Icon }, end }: { item: NavItem; end: boolean }) {
  return (
    <NavLink to={to} end={end} className="relative flex flex-col items-center gap-1 py-1 text-[11px]">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="tab-pill" transition={pillSpring} className="absolute -top-0.5 h-8 w-12 rounded-pill bg-accent-soft" />
          )}
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} className={cx('relative mt-0.5', isActive ? 'text-accent' : 'text-muted')} />
          <span className={cx('relative', isActive ? 'font-[480] text-accent' : 'text-muted')}>{mobile}</span>
        </>
      )}
    </NavLink>
  )
}
