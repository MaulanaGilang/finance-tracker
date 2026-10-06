import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from '../lib/motion'

const SEEN_KEY = 'ledger.introSeen'

const alreadySeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** ~1s brand intro on a cold launch only: rings draw in, wordmark focuses, then the whole layer dissolves. */
export function Intro() {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(() => !alreadySeen())

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setShow(false), reduce ? 0 : 1150)
    return () => clearTimeout(t)
  }, [show, reduce])

  return (
    <AnimatePresence>
      {show && !reduce && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas"
          exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.03, transition: { duration: 0.45, ease: EASE_OUT } }}
          aria-hidden
        >
          <div className="flex items-center gap-3.5">
            <svg width="44" height="44" viewBox="0 0 44 44" className="text-forest">
              <motion.circle
                cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2.2"
                initial={{ pathLength: 0, rotate: -90 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
                style={{ transformOrigin: 'center' }}
              />
              <motion.circle
                cx="22" cy="22" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2"
                initial={{ pathLength: 0, rotate: -90 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}
                style={{ transformOrigin: 'center' }}
              />
            </svg>
            <motion.span
              className="font-display text-[26px]"
              initial={{ opacity: 0, x: -6, filter: 'blur(8px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE_OUT }}
            >
              Ledger
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
