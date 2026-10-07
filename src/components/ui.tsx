import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { AnimatedNumber } from './motion-primitives/animated-number'
import { numberSpring, pillSpring } from '../lib/motion'
import { addMonths, currentMonth, formatIDR, monthLabel } from '../lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Buttons: pill-shaped, flat. Forest fill is reserved for the primary action.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'glow-button bg-accent text-white',
  secondary: 'bg-raised text-ink hover:bg-line',
  ghost: 'border border-line-strong text-ink hover:bg-raised',
  danger: 'border border-line-strong text-expense hover:bg-expense/5',
}

export function Button({
  variant = 'secondary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex h-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill px-5 text-[15px] font-[440] transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-raised active:scale-95 disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  // min-w-0 lets cards shrink inside grid tracks instead of stretching to fit chart content
  return <section className={cx('frost min-w-0 rounded-card border border-white/80 p-5 ring-1 ring-line/60 sm:p-7', className)}>{children}</section>
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-[480] text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
      <h1 className="font-display text-[28px] leading-[1.2] sm:text-[32px]">{title}</h1>
      {children}
    </header>
  )
}

// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const groupId = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-pill bg-raised/70 p-1 backdrop-blur-md', className)}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative h-9 flex-1 whitespace-nowrap rounded-pill px-3 text-[14px] font-[440] transition-colors sm:px-4',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {/* The white thumb slides to the selected option */}
            {active && (
              <motion.span layoutId={`seg-${groupId}`} transition={pillSpring} className="absolute inset-0 rounded-pill bg-card ring-1 ring-line" />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function MonthStepper({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const atCurrent = value >= currentMonth()
  return (
    <div className="frost inline-flex items-center gap-1 rounded-pill border border-white/80 p-1 ring-1 ring-line/60">
      <IconButton label="Previous month" className="size-9" onClick={() => onChange(addMonths(value, -1))}>
        <CaretLeft size={16} />
      </IconButton>
      <span className="min-w-[132px] text-center text-[14px] font-[480] tabular-nums">{monthLabel(value)}</span>
      <IconButton
        label="Next month"
        className="size-9"
        disabled={atCurrent}
        onClick={() => onChange(addMonths(value, 1))}
      >
        <CaretRight size={16} />
      </IconButton>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-[480] text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'h-12 w-full rounded-pill border border-line-strong bg-card px-5 text-[16px] text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15'

export const selectClass = inputClass + ' appearance-none pr-10 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 256 256%27%3E%3Cpath fill=%27%23616862%27 d=%27M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_1.1rem_center] bg-no-repeat'

// ---------------------------------------------------------------------------

export function Money({ value, type, className }: { value: number; type?: 'income' | 'expense'; className?: string }) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : ''
  return (
    <span className={cx('tabular-nums', type === 'income' && 'text-income', className)}>
      {sign}
      {formatIDR(value)}
    </span>
  )
}

/** Rupiah amount that counts smoothly to its new value (month switch, new transaction). */
export function AnimatedMoney({ value, signed = false, className }: { value: number; signed?: boolean; className?: string }) {
  return (
    <AnimatedNumber
      value={value}
      springOptions={numberSpring}
      className={className}
      format={(n) => (signed && n < -0.5 ? '-' : '') + formatIDR(signed ? Math.abs(n) : n)}
    />
  )
}

export function Delta({ value, goodWhenUp = true, onDark = false }: { value: number | null; goodWhenUp?: boolean; onDark?: boolean }) {
  const muted = onDark ? 'text-white/60' : 'text-muted'
  if (value === null || !isFinite(value)) return <span className={cx('text-[12px]', muted)}>No previous data</span>
  if (Math.abs(value) < 0.0005) return <span className={cx('text-[12px]', muted)}>No change</span>
  const up = value >= 0
  const good = up === goodWhenUp
  const color = onDark ? (good ? 'text-[#a9dcbf]' : 'text-[#f4b4a8]') : good ? 'text-income' : 'text-expense'
  return (
    <span className={cx('text-[12px] font-[480] tabular-nums', color)}>
      {up ? '▲' : '▼'} {Math.abs(value * 100).toFixed(1)}%
    </span>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="text-[15px] font-[480]">{title}</p>
      {body && <p className="max-w-[34ch] text-[14px] leading-[1.5] text-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />
}
