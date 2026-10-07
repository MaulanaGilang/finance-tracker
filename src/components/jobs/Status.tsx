import { CheckCircle, DotsThreeCircle, Ghost, XCircle } from '@phosphor-icons/react'
import { STATUS, type JobStatus } from '../../lib/jobs'
import { cx } from '../ui'

const LAST_STAGE = 6

/**
 * Linear-style status glyph. Pipeline stages are a ring whose centre fills like a pie
 * as the application advances (applied = empty ring, offer = nearly full).
 * End states use distinct icons so they read at a glance.
 */
export function StatusRing({ status, size = 16 }: { status: JobStatus; size?: number }) {
  const { color, stage } = STATUS[status]
  if (status === 'accepted') return <CheckCircle size={size} weight="fill" color={color} aria-hidden />
  if (status === 'rejected') return <XCircle size={size} weight="fill" color={color} aria-hidden />
  if (status === 'ghosted') return <Ghost size={size} weight="duotone" color={color} aria-hidden />
  if (status === 'other') return <DotsThreeCircle size={size} weight="duotone" color={color} aria-hidden />

  const frac = (stage ?? 0) / LAST_STAGE
  const pieR = 3
  const pieC = 2 * Math.PI * pieR
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke={color} strokeWidth="1.5" />
      {frac > 0 && (
        <circle
          cx="8"
          cy="8"
          r={pieR}
          fill="none"
          stroke={color}
          strokeWidth={pieR * 2}
          strokeDasharray={`${frac * pieC} ${pieC}`}
          transform="rotate(-90 8 8)"
        />
      )}
    </svg>
  )
}

export function StatusPill({ status, auto = false, className }: { status: JobStatus; auto?: boolean; className?: string }) {
  const { label, color } = STATUS[status]
  return (
    <span
      className={cx('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill pl-2 pr-2.5 text-[13px] font-[440]', className)}
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: `color-mix(in srgb, ${color} 85%, #1c211e)` }}
    >
      <StatusRing status={status} size={14} />
      {label}
      {auto && <span className="rounded-pill bg-white/70 px-1.5 text-[10px] font-[480] uppercase tracking-wide text-muted">auto</span>}
    </span>
  )
}
