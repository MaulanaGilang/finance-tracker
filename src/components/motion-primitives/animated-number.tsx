// From Motion-Primitives (animated-number), adapted:
// - motion.create hoisted out of render so the element isn't remounted every update
// - optional `format` so amounts can render as Rupiah
// - React 19 types (no global JSX namespace)
import { cn } from '@/lib/utils'
import { motion, useSpring, useTransform, type SpringOptions } from 'motion/react'
import { useEffect, useMemo, type ElementType } from 'react'

export type AnimatedNumberProps = {
  value: number
  className?: string
  springOptions?: SpringOptions
  as?: ElementType
  format?: (n: number) => string
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString()

export function AnimatedNumber({ value, className, springOptions, as = 'span', format = defaultFormat }: AnimatedNumberProps) {
  const MotionComponent = useMemo(() => motion.create(as), [as])

  const spring = useSpring(value, springOptions)
  const display = useTransform(spring, (current) => format(current))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <MotionComponent className={cn('tabular-nums', className)}>{display}</MotionComponent>
}
