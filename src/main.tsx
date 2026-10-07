import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import './index.css'
import { AppShell, type Tool } from './components/AppShell'
import { Atmosphere } from './components/Atmosphere'
import { Composer } from './components/Composer'
import { Intro } from './components/Intro'
import { JobComposer } from './components/jobs/JobComposer'
import { PinScreen } from './components/PinScreen'
import { EASE_OUT, pageVariants } from './lib/motion'
import { StoreProvider, useStore } from './lib/store'
import { Dashboard } from './pages/Dashboard'
import { Applications } from './pages/jobs/Applications'
import { Board } from './pages/jobs/Board'
import { JobsDashboard } from './pages/jobs/JobsDashboard'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { ToolChooser } from './pages/ToolChooser'
import { Transactions } from './pages/Transactions'

/** Pages inside one tool: each page blurs out, the next focuses in */
function ToolPages({ tool }: { tool: Tool }) {
  const location = useLocation()
  return (
    // Scroll to the top once the old page has faded out, so the new one starts at its beginning
    <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          {tool === 'budget' ? (
            <>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings tool={tool} />} />
            </>
          ) : (
            <>
              <Route index element={<JobsDashboard />} />
              <Route path="applications" element={<Applications />} />
              <Route path="board" element={<Board />} />
              <Route path="settings" element={<Settings tool={tool} />} />
            </>
          )}
          <Route path="*" element={<Navigate to={`/${tool}`} replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function ToolLayout({ tool }: { tool: Tool }) {
  const { loadError, reload } = useStore()
  return (
    <AppShell tool={tool}>
      {loadError && (
        <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-card border border-expense/30 bg-expense/5 px-5 py-3 text-[14px] text-expense">
          {loadError}
          <button className="font-[480] underline" onClick={() => reload()}>
            Retry
          </button>
        </div>
      )}
      <ToolPages tool={tool} />
      {tool === 'budget' ? <Composer /> : <JobComposer />}
    </AppShell>
  )
}

/** chooser / budget / jobs: switching between them crossfades the whole space */
function Spaces() {
  const location = useLocation()
  const space = location.pathname.split('/')[1] || 'home'
  return (
    // Opacity only: a filter here would become the containing block for the fixed nav bars.
    <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={space}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.35, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        <Routes location={location}>
          <Route path="/" element={<ToolChooser />} />
          <Route path="/budget/*" element={<ToolLayout tool="budget" />} />
          <Route path="/jobs/*" element={<ToolLayout tool="jobs" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  const { status } = useStore()
  return (
    <AnimatePresence mode="wait">
      {status !== 'ready' ? (
        // Unlocking dissolves the PIN screen out of focus before the chooser focuses in
        <motion.div key="lock" exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)', transition: { duration: 0.35, ease: EASE_OUT } }}>
          <PinScreen />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } }}>
          <Spaces />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Atmosphere />
      <Intro />
      <BrowserRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
