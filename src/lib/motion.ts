import type { Transition, Variants } from 'motion/react'

/*
  Motion language: Mercury's soft focus. Things come INTO focus (blur → sharp),
  rise a few pixels, and settle with a long ease-out. No bounce except tactile taps.
*/

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const soft: Transition = { duration: 0.45, ease: EASE_OUT }

/** Page-level focus-in / out */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: 'blur(6px)' },
  // transitionEnd drops the filter entirely: a lingering `blur(0px)` would still break the frosted
  // backdrop-filter on cards inside and make this element the containing block for fixed children.
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT }, transitionEnd: { filter: 'none' } },
  exit: { opacity: 0, y: -4, filter: 'blur(4px)', transition: { duration: 0.18, ease: 'easeIn' } },
}

/** Staggered children (lists, insight tiles) */
export const listVariants: Variants = {
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
}

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 6, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: soft, transitionEnd: { filter: 'none' } },
  exit: { opacity: 0, height: 0, filter: 'blur(4px)', transition: { duration: 0.25, ease: EASE_OUT } },
}

/** Springs for things you physically touch */
export const sheetSpring: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }
export const pillSpring: Transition = { type: 'spring', stiffness: 420, damping: 38 }
export const numberSpring = { stiffness: 90, damping: 22, mass: 0.8 }
