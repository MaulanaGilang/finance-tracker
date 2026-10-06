import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import './index.css'
import { AppShell } from './components/AppShell'
import { Atmosphere } from './components/Atmosphere'
import { Composer } from './components/Composer'
import { Intro } from './components/Intro'
import { PinScreen } from './components/PinScreen'
import { EASE_OUT, pageVariants } from './lib/motion'
import { StoreProvider, useStore } from './lib/store'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  const { status, loadError, reload } = useStore()
  const ready = status === 'ready'

  return (
    <AnimatePresence mode="wait">
      {!ready ? (
        // Unlocking dissolves the PIN screen out of focus before the app focuses in
        <motion.div key="lock" exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)', transition: { duration: 0.35, ease: EASE_OUT } }}>
          <PinScreen />
        </motion.div>
      ) : (
        // Opacity only: any filter here would become the containing block for the fixed nav bars.
        // The blur-in happens one level down, on the page content (see AnimatedRoutes).
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } }}>
          <AppShell>
            {loadError && (
              <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-card border border-expense/30 bg-expense/5 px-5 py-3 text-[14px] text-expense">
                {loadError}
                <button className="font-[480] underline" onClick={() => reload()}>
                  Retry
                </button>
              </div>
            )}
            <AnimatedRoutes />
            <Composer />
          </AppShell>
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
