import type { PointerEvent, ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

/**
 * The deep, accent-tinted hero panel (forest in Budget, ink in Jobs). Ambient lights drift on their own; on devices with a mouse,
 * one extra soft light trails the pointer, like the glowing objects in Mercury's illustrations.
 */
export function HeroPanel({ children }: { children: ReactNode }) {
  const x = useMotionValue(-400)
  const y = useMotionValue(-400)
  const sx = useSpring(x, { stiffness: 120, damping: 24, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 120, damping: 24, mass: 0.6 })
  const finePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - r.left - 160)
    y.set(e.clientY - r.top - 160)
  }

  return (
    <section
      onPointerMove={finePointer ? onMove : undefined}
      className="glow-panel group grid gap-6 rounded-[20px] p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-end md:gap-10 md:p-10"
    >
      <span className="light drift" style={{ width: 340, height: 340, right: '-6%', top: '-55%', background: '#e9f1ea', opacity: 0.32, filter: 'blur(70px)' }} />
      <span className="light drift-slow" style={{ width: 260, height: 260, left: '-8%', bottom: '-60%', background: '#9fc9ae', opacity: 0.4, filter: 'blur(60px)' }} />
      <span className="light" style={{ width: 120, height: 120, right: '30%', bottom: '-20%', background: '#ffffff', opacity: 0.16, filter: 'blur(40px)' }} />
      {finePointer && (
        <motion.span
          className="light left-0 top-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ x: sx, y: sy, width: 320, height: 320, background: 'radial-gradient(circle, rgb(233 243 236 / 0.28) 0%, transparent 65%)' }}
        />
      )}
      {children}
    </section>
  )
}

