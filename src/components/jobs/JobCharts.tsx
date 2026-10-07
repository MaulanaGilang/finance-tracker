import { useId, type ReactElement, type SVGProps } from 'react'
import { motion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis } from 'recharts'
import { EASE_OUT } from '../../lib/motion'
import type { Breakdown, FlowGraph, FlowNode } from '../../lib/jobs'
import { cx } from '../ui'

const INK = '#2B3A7A'
const GRID = '#E4E4DC'
const TICK = { fill: '#616862', fontSize: 12 }

/** Applications sent per week: one soft ink area, drawn in left to right on mount */
export function WeeklyChart({ data }: { data: { key: string; label: string; count: number }[] }) {
  const id = 'wk' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <motion.div
      style={{ height: 220 }}
      className="-ml-2"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      transition={{ duration: 1.1, delay: 0.15, ease: EASE_OUT }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INK} stopOpacity={0.28} />
              <stop offset="100%" stopColor={INK} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={6} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={TICK} allowDecimals={false} width={28} />
          <Tooltip
            cursor={{ stroke: '#C9CBC2', strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="frost rounded-[12px] border border-white/80 px-3.5 py-2.5 text-[13px] ring-1 ring-line/60">
                  <p className="font-[480]">Week of {String((payload[0].payload as { label: string }).label)}</p>
                  <p className="tabular-nums text-muted">
                    {Number(payload[0].value)} {Number(payload[0].value) === 1 ? 'application' : 'applications'}
                  </p>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={INK}
            strokeWidth={2.5}
            fill={`url(#${id}-fill)`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 5, fill: INK, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

/**
 * Horizontal bars for a breakdown (platform, category...). Bars have no background track;
 * optional response-rate column shows which sources actually reply.
 */
export function BreakdownBars({
  data,
  showResponse = false,
  limit,
  color = INK,
}: {
  data: Breakdown[]
  showResponse?: boolean
  limit?: number
  color?: string
}) {
  const rows = limit ? data.slice(0, limit) : data
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="flex flex-col gap-3.5">
      {showResponse && (
        <li className="-mb-1 flex justify-end gap-4 text-[12px] font-[480] text-muted">
          <span className="w-10 text-right">Sent</span>
          <span className="w-[4.5rem] text-right">Replied</span>
        </li>
      )}
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 truncate text-[14px]">{r.key}</p>
            <motion.span
              className="block h-1.5 origin-left rounded-full"
              style={{ width: `${Math.max(3, (r.count / max) * 100)}%`, background: color, opacity: 0.85 - i * 0.05 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: EASE_OUT }}
            />
          </div>
          <span className="w-10 text-right text-[14px] tabular-nums">{r.count}</span>
          {showResponse && (
            <span className={cx('w-[4.5rem] text-right text-[14px] tabular-nums', r.responseRate > 0 ? 'text-ink' : 'text-muted')}>
              {Math.round(r.responseRate * 100)}%
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Application flow (Sankey)

type NodeRenderProps = { x: number; y: number; width: number; height: number; index: number; payload: FlowNode & { value: number } }
type LinkRenderProps = {
  sourceX: number
  targetX: number
  sourceY: number
  targetY: number
  sourceControlX: number
  targetControlX: number
  linkWidth: number
  index: number
  payload: { source: FlowNode; target: FlowNode; value: number }
}

/**
 * Where every application went: Applications -> stages reached, branching off into
 * where they stopped. Links fade from the source colour into the outcome colour.
 * Scrolls sideways on narrow screens instead of squashing the labels.
 */
export function FlowSankey({ data }: { data: FlowGraph }) {
  const uid = 'sk' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const depth = data.nodes.filter((n) => n.kind === 'stage').length
  const height = Math.max(260, 140 + depth * 34)

  const renderNode = ({ x, y, width, height: h, payload }: NodeRenderProps) => {
    const isRoot = payload.kind === 'root'
    const labelX = isRoot ? x - 10 : x + width + 10
    const anchor = isRoot ? 'end' : 'start'
    const midY = y + h / 2
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(h, 2)} rx={2} fill={payload.color} />
        <text x={labelX} y={midY - 4} textAnchor={anchor} fontSize={13} fill="#616862">
          {payload.name}
        </text>
        <text x={labelX} y={midY + 16} textAnchor={anchor} fontSize={18} fill="#1C211E" style={{ fontFamily: 'var(--font-display)', fontStretch: '112%', fontWeight: 480 }}>
          {payload.value}
        </text>
      </g>
    )
  }

  const renderLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }: LinkRenderProps) => {
    const id = `${uid}-l${index}`
    return (
      <g>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={sourceX} x2={targetX} y1={0} y2={0}>
            <stop offset="0%" stopColor={payload.source.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={payload.target.color} stopOpacity={0.42} />
          </linearGradient>
        </defs>
        <path
          d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={Math.max(linkWidth, 1.5)}
          className="transition-opacity duration-200 hover:opacity-70"
        />
      </g>
    ) as unknown as ReactElement<SVGProps<SVGPathElement>>
  }

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <motion.div
        className="min-w-[640px]"
        style={{ height }}
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 1.3, delay: 0.15, ease: EASE_OUT }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            node={renderNode as never}
            link={renderLink as never}
            nodeWidth={10}
            nodePadding={28}
            linkCurvature={0.5}
            // 'left': an outcome sits in the column right after the stage it branched from,
            // instead of being pushed to the far right edge (the default 'justify')
            align="left"
            iterations={0}
            sort={false}
            margin={{ top: 16, right: 130, bottom: 16, left: 110 }}
          />
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}
