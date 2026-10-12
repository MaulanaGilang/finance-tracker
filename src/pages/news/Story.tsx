import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowSquareOut,
  Bank,
  Boat,
  BookmarkSimple,
  Brain,
  Clock,
  Cpu,
  GlobeHemisphereWest,
  Lightning,
  Robot,
  type IconProps,
} from '@phosphor-icons/react'
import { Globe, PLACE_COLORS, loadFlag, type GlobeController } from '../../components/news/Globe'
import { ImpactBadge, TopicTag } from '../../components/news/Article'
import { Card, Empty, IconButton, Skeleton, cx } from '../../components/ui'
import { detectPlaces, type Place } from '../../lib/countries'
import { EASE_OUT, pillSpring } from '../../lib/motion'
import { TOPICS, isHighImpact, plainText, readMinutes, storyParagraphs, timeAgo, type NewsArticle, type NewsTopic } from '../../lib/news'
import { useStore } from '../../lib/store'

/** Stand-in symbol for stories that aren't about a particular country */
const TOPIC_ICONS: Record<NewsTopic, ComponentType<IconProps>> = {
  ai: Brain,
  robotics: Robot,
  geopolitics: GlobeHemisphereWest,
  central_banks: Bank,
  energy: Lightning,
  trade: Boat,
  semiconductors: Cpu,
}

/** One story on its own page: a full-bleed globe tours the countries it's about, the article floats over it */
export function NewsStory() {
  const { id } = useParams()
  const { news, loading } = useStore()
  const article = news.find((a) => String(a.id) === id)

  if (!article) {
    if (loading || news.length === 0) return <Skeleton className="h-[60dvh] w-full rounded-[20px]" />
    return (
      <Card>
        <Empty title="This story is no longer here" body="Stories older than 30 days are cleared unless you saved them." action={<Link to="/news/feed" className="glow-button inline-flex h-11 items-center rounded-pill bg-accent px-5 text-white">Back to the feed</Link>} />
      </Card>
    )
  }
  return <Story key={article.id} a={article} />
}

/**
 * The visual sits fixed behind the page, rendered into <body>: the page wrapper animates a transform on
 * entry, which would otherwise pin "fixed" to the wrapper instead of the screen.
 */
function Stage({ tall, children }: { tall: boolean; children: ReactNode }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } }}
      className={cx('pointer-events-none fixed inset-x-0 top-14 z-0 md:top-16 lg:bottom-0', tall ? 'h-[56dvh] lg:h-auto' : 'h-[38dvh] lg:h-auto')}
    >
      {children}
    </motion.div>,
    document.body,
  )
}

function Story({ a }: { a: NewsArticle }) {
  const { toggleNewsSaved, loadArticleDetails } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const globe = useRef<GlobeController | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(0)

  useEffect(() => loadArticleDetails(a), []) // eslint-disable-line react-hooks/exhaustive-deps

  const paragraphs = storyParagraphs(a)
  // Detect from the headline and the article text we have
  // (the brief already covers what the feed summary says, so counting both would double every mention)
  const bodyText = a.brief?.length ? a.brief.join(' ') : [plainText(a.summary), ...(a.key_points ?? [])].join(' ')
  const places = useMemo(() => detectPlaces(a.title, bodyText), [a.title, bodyText])
  // Keep the globe running on the first detection; a later, longer text shouldn't restart the tour mid-flight
  const [tourPlaces, setTourPlaces] = useState(places)
  useEffect(() => {
    if (places.length && !tourPlaces.length) setTourPlaces(places)
  }, [places, tourPlaces.length])

  const topic = a.topics[0]
  const minutes = readMinutes(a.word_count)
  const loadingText = a.details_status === 'pending' && paragraphs.length <= 1
  // In-app history: go back (keeps the feed's scroll and filters); opened from a link: go to the feed
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/news/feed'))
  const hasGlobe = tourPlaces.length > 0

  return (
    <article>
      {hasGlobe ? (
        <Stage tall>
          <Globe places={tourPlaces} controller={globe} onFocus={setFocus} avoid={panel} className="size-full" />
        </Stage>
      ) : topic ? (
        <Stage tall={false}>
          <TopicEmblem topic={topic} avoid={panel} />
        </Stage>
      ) : null}

      {/* The article: frosted so it stays readable wherever the globe sits under it */}
      <div className={cx('relative z-10 lg:ml-auto lg:mt-0 lg:w-[480px]', hasGlobe ? 'mt-[50dvh]' : topic ? 'mt-[32dvh]' : '')}>
        <div
          ref={panel}
          className="rounded-[20px] border border-white/80 bg-canvas/75 p-5 ring-1 ring-line/60 backdrop-blur-xl backdrop-saturate-150 sm:p-7"
        >
          <button onClick={back} className="-ml-2 mb-4 inline-flex h-9 items-center gap-1.5 rounded-pill pl-2 pr-3.5 text-[14px] text-muted transition-colors hover:bg-raised hover:text-ink">
            <ArrowLeft size={16} /> Back
          </button>
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="font-[480] text-ink">{a.source}</span>
            <span>{timeAgo(a.published_at)}</span>
            {minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> {minutes} min read
              </span>
            )}
          </p>
          <h1 className="mb-4 text-balance font-display text-[24px] leading-[1.22] sm:text-[28px]">{a.title}</h1>
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {isHighImpact(a) && <ImpactBadge />}
            {a.topics.map((t) => (
              <TopicTag key={t} topic={t} />
            ))}
          </div>

          {hasGlobe && <PlaceChips places={tourPlaces} focus={focus} globe={globe} />}

          {loadingText ? (
            <div className="flex flex-col gap-3" aria-busy>
              {[100, 94, 97, 60, 0, 100, 91, 72].map((w, i) => (w ? <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} /> : <div key={i} className="h-2" />))}
              <p className="mt-1 text-[13px] text-muted">Reading the article…</p>
            </div>
          ) : paragraphs.length ? (
            <div className="flex flex-col gap-4">
              {paragraphs.map((p, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT, delay: 0.1 + Math.min(i, 5) * 0.06 } }}
                  className={cx('text-pretty leading-[1.7]', i === 0 ? 'text-[16px] text-ink sm:text-[17px]' : 'text-[15px] text-ink/85 sm:text-[16px]')}
                >
                  {p}
                </motion.p>
              ))}
            </div>
          ) : (
            <p className="text-[15px] leading-[1.6] text-muted">This site doesn't allow previews (paywall or blocked), so there's nothing to show here. The full story is on {a.source}.</p>
          )}

          {a.details_status === 'failed' && paragraphs.length > 0 && (
            <p className="mt-5 text-[13px] text-muted">Only the feed's short summary is available: {a.source} blocks previews.</p>
          )}

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <a href={a.url} target="_blank" rel="noreferrer" className="glow-button inline-flex h-10 items-center gap-2 rounded-pill bg-accent px-4 text-[14px] text-white">
                Read on {a.source} <ArrowSquareOut size={15} />
              </a>
              <IconButton label={a.saved ? 'Remove from saved' : 'Save for later'} onClick={() => toggleNewsSaved(a).catch(() => {})} className={a.saved ? 'text-accent' : 'text-muted'}>
                <BookmarkSimple size={20} weight={a.saved ? 'fill' : 'regular'} />
              </IconButton>
            </div>
            {a.brief?.length || a.key_points?.length ? <p className="text-[12px] text-muted">Every sentence is from the article itself, not AI-written.</p> : null}
          </footer>
        </div>
      </div>
    </article>
  )
}

/** The countries on the tour: tap one to fly back to it */
function PlaceChips({ places, focus, globe }: { places: Place[]; focus: number; globe: RefObject<GlobeController | null> }) {
  const [flags, setFlags] = useState<(string | null)[]>([])
  useEffect(() => {
    let live = true
    Promise.all(places.map((p) => loadFlag(p.code))).then((f) => live && setFlags(f))
    return () => {
      live = false
    }
  }, [places])

  return (
    <div className="mb-6 flex items-center gap-2 border-y border-line/70 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {places.map((p, i) => {
          const color = PLACE_COLORS[i % PLACE_COLORS.length]
          const active = focus === i
          return (
            <button
              key={p.code}
              onClick={() => globe.current?.flyTo(i)}
              aria-pressed={active}
              className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-pill pl-1.5 pr-3 text-[13px] font-[480] transition-transform active:scale-[0.97]"
              style={{ color }}
            >
              {active && <motion.span layoutId="place-pill" transition={pillSpring} className="absolute inset-0 rounded-pill" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }} />}
              <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5" style={{ background: `color-mix(in srgb, ${color} 18%, white)` }}>
                {flags[i] ? <img src={flags[i]!} alt="" className="size-full object-cover" /> : null}
              </span>
              <span className="relative">{p.name}</span>
            </button>
          )
        })}
      </div>
      <IconButton label="Replay the tour" onClick={() => globe.current?.replay()} className="shrink-0 text-muted">
        <ArrowCounterClockwise size={18} />
      </IconButton>
    </div>
  )
}

/**
 * No country to show: the topic's symbol, large and open on the page. Orbit rings draw themselves in and
 * keep turning slowly, the symbol floats; with reduced motion it all simply appears.
 */
function TopicEmblem({ topic, avoid }: { topic: NewsTopic; avoid: RefObject<HTMLElement | null> }) {
  const Icon = TOPIC_ICONS[topic]
  const { color, label } = TOPICS[topic]
  const reduce = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const [center, setCenter] = useState<{ x: number; size: number } | null>(null)

  // Centre in the space beside the article panel on wide screens, like the globe
  useEffect(() => {
    const measure = () => {
      const box = wrap.current?.getBoundingClientRect()
      if (!box) return
      const p = avoid.current?.getBoundingClientRect()
      const beside = p && p.left > box.width * 0.4
      const free = beside ? p.left - 24 : box.width
      setCenter({ x: free / 2, size: Math.min(free * 0.8, box.height * 0.82, 560) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    if (avoid.current) ro.observe(avoid.current)
    return () => ro.disconnect()
  }, [avoid])

  const rings = [
    { r: 0.32, dash: '', speed: 60, dot: 0.15 },
    { r: 0.41, dash: '2 6', speed: -90, dot: 0.6 },
    { r: 0.49, dash: '', speed: 140, dot: 0.85 },
  ]
  return (
    <div ref={wrap} className="relative size-full">
      {center && (
        <div className="absolute top-1/2" style={{ left: center.x, width: center.size, height: center.size, transform: 'translate(-50%, -50%)' }}>
          {/* Each ring is its own layer so it turns around the centre */}
          {rings.map((ring, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              animate={reduce ? undefined : { rotate: ring.speed > 0 ? 360 : -360 }}
              transition={{ duration: Math.abs(ring.speed), repeat: Infinity, ease: 'linear' }}
            >
              <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-hidden>
                <motion.circle
                  cx={50}
                  cy={50}
                  r={ring.r * 100}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.22 - i * 0.04}
                  strokeWidth={0.3}
                  strokeDasharray={ring.dash || undefined}
                  initial={reduce || ring.dash ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.1 + i * 0.12 }}
                />
                <motion.circle
                  cx={50 + Math.cos(ring.dot * Math.PI * 2) * ring.r * 100}
                  cy={50 + Math.sin(ring.dot * Math.PI * 2) * ring.r * 100}
                  r={0.9 - i * 0.15}
                  fill={color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  transition={{ duration: 0.6, delay: 0.9 + i * 0.12 }}
                />
              </svg>
            </motion.div>
          ))}
          {/* The symbol: settles in, then drifts up and down a few pixels */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.2 }}
          >
            <motion.span
              className="flex aspect-square w-[34%] items-center justify-center rounded-full"
              style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 10%, white), color-mix(in srgb, ${color} 22%, #efefe8))`, color }}
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon weight="duotone" className="size-[52%]" />
            </motion.span>
            <span className="text-[13px] font-[480]" style={{ color }}>
              {label}
            </span>
          </motion.div>
        </div>
      )}
    </div>
  )
}
