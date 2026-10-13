import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowCounterClockwise, ArrowLeft, ArrowSquareOut, BookmarkSimple, Clock } from '@phosphor-icons/react'
import { Globe, PLACE_COLORS, loadFlag, type GlobeController } from '../../components/news/Globe'
import { ImpactBadge, TopicTag } from '../../components/news/Article'
import { Card, Empty, IconButton, Skeleton, cx } from '../../components/ui'
import { detectPlaces, type Place } from '../../lib/countries'
import { EASE_OUT, pillSpring } from '../../lib/motion'
import { isHighImpact, plainText, readMinutes, storyParagraphs, timeAgo, type NewsArticle } from '../../lib/news'
import { useStore } from '../../lib/store'

/**
 * One story on its own page. When it's about a place, a full-bleed globe tours the countries and the article
 * floats over it; otherwise the article is a plain, centred read.
 */
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
function Stage({ children }: { children: ReactNode }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } }}
      className="pointer-events-none fixed inset-x-0 top-14 z-0 h-[56dvh] md:top-16 lg:bottom-0 lg:h-auto"
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

  const minutes = readMinutes(a.word_count)
  const loadingText = a.details_status === 'pending' && paragraphs.length <= 1
  // In-app history: go back (keeps the feed's scroll and filters); opened from a link: go to the feed
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/news/feed'))
  const hasGlobe = tourPlaces.length > 0

  return (
    <article>
      {hasGlobe && (
        <Stage>
          <Globe places={tourPlaces} controller={globe} onFocus={setFocus} avoid={panel} className="size-full" />
        </Stage>
      )}

      {/* The article: frosted so it stays readable wherever the globe sits under it */}
      {/* With a globe: a side panel over it. Without: a centred column with room to read */}
      <div className={cx('relative z-10', hasGlobe ? 'mt-[50dvh] lg:ml-auto lg:mt-0 lg:w-[480px]' : 'mx-auto max-w-[720px]')}>
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
