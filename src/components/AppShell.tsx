import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ChartBar, GearSix, ListBullets, Plus, SquaresFour } from '@phosphor-icons/react'
import { pillSpring } from '../lib/motion'
import { useStore } from '../lib/store'
import { cx } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/transactions', label: 'Transactions', icon: ListBullets },
  { to: '/reports', label: 'Reports', icon: ChartBar },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const

/** Two concentric rings, same mark as the app icon */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-forest text-canvas">
        <svg width="18" height="18" viewBox="0 0 44 44" aria-hidden>
          <circle cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <circle cx="22" cy="22" r="8.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
        </svg>
      </span>
      <span className="font-display text-[18px]">Ledger</span>
    </span>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { openComposer } = useStore()

  return (
    <div className="min-h-[100dvh]">
      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-20 hidden border-b border-white/60 bg-canvas/55 backdrop-blur-xl backdrop-saturate-150 md:block">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-8">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className="relative rounded-pill px-4 py-2 text-[15px]">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="nav-pill" transition={pillSpring} className="absolute inset-0 rounded-pill bg-forest-soft" />
                    )}
                    <span className={cx('relative transition-colors', isActive ? 'font-[480] text-forest' : 'text-muted hover:text-ink')}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <motion.button
            onClick={() => openComposer()}
            whileTap={{ scale: 0.97 }}
            className="glow-button inline-flex h-10 items-center gap-2 rounded-pill bg-forest px-5 text-[15px] text-white"
          >
            <Plus size={16} weight="bold" />
            Add
          </motion.button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex h-14 items-center px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Logo />
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-32 pt-4 md:px-8 md:pb-16 md:pt-10">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-canvas/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((item) => (
            <TabLink key={item.to} {...item} />
          ))}
          <div className="flex justify-center">
            <AddFab onClick={() => openComposer()} />
          </div>
          {NAV.slice(2).map((item) => (
            <TabLink key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Centre + button: presses in, and a soft ring ripples out on each tap */
function AddFab({ onClick }: { onClick: () => void }) {
  const [pulse, setPulse] = useState(0)
  return (
    <motion.button
      onClick={() => {
        setPulse((p) => p + 1)
        onClick()
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      aria-label="Add transaction"
      className="glow-button relative flex size-12 items-center justify-center rounded-full bg-forest text-white"
    >
      <AnimatePresence>
        {pulse > 0 && (
          <motion.span
            key={pulse}
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-forest"
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

function TabLink({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <NavLink to={to} end={to === '/'} className="relative flex flex-col items-center gap-1 py-1 text-[11px]">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="tab-pill"
              transition={pillSpring}
              className="absolute -top-0.5 h-8 w-12 rounded-pill bg-forest-soft"
            />
          )}
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} className={cx('relative mt-0.5', isActive ? 'text-forest' : 'text-muted')} />
          <span className={cx('relative', isActive ? 'font-[480] text-forest' : 'text-muted')}>
            {label === 'Transactions' ? 'History' : label}
          </span>
        </>
      )}
    </NavLink>
  )
}
