import type { Transition, Variants } from 'motion/react'

/*
  Motion language: calm and quick. Things fade in, rise a few pixels and settle with an ease-out.
  Blur is kept for one-off moments only (intro, PIN dissolve): animating it on lists, pages or
  large sheets makes phones drop frames. No bounce except tactile taps and sheets.
*/

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const soft: Transition = { duration: 0.45, ease: EASE_OUT }

/** Page-level enter / exit. Transform + opacity only: animating blur on a whole page is too costly on phones. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
}

/** Staggered children (lists, insight tiles) */
export const listVariants: Variants = {
  animate: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
}

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: EASE_OUT } },
}

/** Springs for things you physically touch */
export const sheetSpring: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }
export const pillSpring: Transition = { type: 'spring', stiffness: 420, damping: 38 }
export const numberSpring = { stiffness: 90, damping: 22, mass: 0.8 }
