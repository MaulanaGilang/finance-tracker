import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { EASE_OUT, sheetSpring } from '../lib/motion'
import { IconButton, cx } from './ui'

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

/**
 * Modal form surface. Phones: springs up from the bottom edge. Larger screens: focuses in at the centre.
 * Render inside <AnimatePresence> so the exit animation plays.
 */
export function Sheet({
  title,
  onClose,
  onSubmit,
  children,
  maxWidth = 'sm:max-w-[480px]',
}: {
  title: string
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  children: ReactNode
  maxWidth?: string
}) {
  const [wide] = useState(isWide)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[6px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      />
      <motion.form
        onSubmit={onSubmit}
        initial={wide ? { opacity: 0, scale: 0.97, y: 12, filter: 'blur(6px)' } : { y: '100%' }}
        animate={
          wide
            ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT }, transitionEnd: { filter: 'none' } }
            : { y: 0, transition: sheetSpring }
        }
        exit={wide ? { opacity: 0, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.2 } } : { y: '100%', transition: { duration: 0.25, ease: 'easeIn' } }}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[24px] bg-canvas/85 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 backdrop-blur-2xl sm:rounded-card sm:border sm:border-line sm:p-8',
          maxWidth,
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-[21px]">{title}</h2>
          <IconButton label="Close" type="button" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </motion.form>
    </div>
  )
}
