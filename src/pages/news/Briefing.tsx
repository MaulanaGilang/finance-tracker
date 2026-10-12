import { useMemo } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'
import { HeroPanel } from '../../components/HeroPanel'
import { AnimatedNumber } from '../../components/motion-primitives/animated-number'
import { ArticleRow } from '../../components/news/Article'
import { Card, CardTitle, Empty, Skeleton } from '../../components/ui'
import { itemVariants, listVariants, numberSpring } from '../../lib/motion'
import { GROUPS, GROUP_ORDER, TOPICS, inGroup, isHighImpact, timeAgo, within, type NewsArticle, type NewsGroup } from '../../lib/news'
import { useStore } from '../../lib/store'

/** The News "dashboard": what moved in the last day, the market movers, and each topic at a glance */
export function NewsBriefing() {
  const { news, loading, refreshNews, newsRefreshing } = useStore()

  const d = useMemo(() => {
    const day = news.filter((a) => within(a.published_at, 24))
    const week = news.filter((a) => within(a.published_at, 24 * 7))
    const movers = [...week].filter(isHighImpact).sort((a, b) => b.market_score - a.market_score || b.published_at.localeCompare(a.published_at))
    const byGroup = GROUP_ORDER.map((g) => {
      const list = week.filter((a) => inGroup(a, g))
      return { group: g, list, today: list.filter((a) => within(a.published_at, 24)).length }
    })
    const lastFetch = news.reduce((m, a) => (a.fetched_at > m ? a.fetched_at : m), '')
    return { day, week, movers, byGroup, lastFetch }
  }, [news])

  if (loading && news.length === 0) return <Skeleton className="h-64 w-full rounded-[20px]" />
  if (news.length === 0)
    return (
      <Card>
        <Empty
          title="No stories yet"
          body="News is fetched every 2 hours. You can also pull it now."
          action={
            <button onClick={() => refreshNews()} disabled={newsRefreshing} className="glow-button h-11 rounded-pill bg-accent px-5 text-white">
              {newsRefreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          }
        />
      </Card>
    )

  const busiest = [...d.byGroup].sort((a, b) => b.today - a.today)[0]

  return (
    <motion.div className="flex flex-col gap-6 sm:gap-8" variants={listVariants} initial="initial" animate="animate">
      <h1 className="sr-only">News briefing</h1>

      <motion.div variants={itemVariants}>
        <HeroPanel>
          <div>
            <p className="mb-3 text-[14px] text-white/70">Stories in the last 24 hours</p>
            <AnimatedNumber value={d.day.length} springOptions={numberSpring} className="block font-display text-[48px] leading-[1.05] sm:text-[64px]" />
            <p className="mt-3 text-[13px] leading-[1.6] text-white/70">
              {d.movers.filter((a) => within(a.published_at, 24)).length} market movers today
              {busiest?.today ? ` · busiest: ${GROUPS[busiest.group].label}` : ''}
              <br />
              {d.lastFetch ? `Updated ${timeAgo(d.lastFetch)} · refreshes every 2 hours` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {d.byGroup.map(({ group, today }) => (
              <div key={group} className="glass-on-dark min-w-0 rounded-card px-4 py-3.5">
                <p className="mb-1 truncate text-[13px] text-white/70">{GROUPS[group].label}</p>
                <AnimatedNumber value={today} springOptions={numberSpring} className="block font-display text-[24px]" />
              </div>
            ))}
            <div className="glass-on-dark min-w-0 rounded-card px-4 py-3.5">
              <p className="mb-1 truncate text-[13px] text-white/70">Market movers</p>
              <AnimatedNumber value={d.movers.filter((a) => within(a.published_at, 24)).length} springOptions={numberSpring} className="block font-display text-[24px]" />
            </div>
          </div>
        </HeroPanel>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="px-3 sm:px-5">
          <CardTitle
            action={
              <Link to="/news/feed" className="group inline-flex items-center gap-1.5 text-[14px] text-accent">
                All stories <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            }
          >
            <span className="px-2 sm:px-2">Market movers this week</span>
          </CardTitle>
          {d.movers.length === 0 ? (
            <p className="px-2 pb-2 text-[14px] text-muted">No high-impact stories this week.</p>
          ) : (
            <ul className="flex flex-col">
              <AnimatePresence>
                {d.movers.slice(0, 6).map((a, i) => (
                  <ArticleRow key={a.id} article={a} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-6">
        {d.byGroup.map(({ group, list }) => (
          <GroupCard key={group} group={group} list={list} />
        ))}
      </motion.div>
    </motion.div>
  )
}

/** One of the 3 groups: how its sub-topics split this week, then the latest stories */
function GroupCard({ group, list }: { group: NewsGroup; list: NewsArticle[] }) {
  const { label, color, topics } = GROUPS[group]
  return (
    <Card className="px-3 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-2">
        <h2 className="flex items-center gap-2.5 text-[15px] font-[480]">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </h2>
        <Link to={`/news/feed?group=${group}`} className="text-[13px] text-muted transition-colors hover:text-accent">
          {list.length} this week
        </Link>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5 px-2">
        {topics.map((t) => (
          <Link
            key={t}
            to={`/news/feed?group=${group}&topic=${t}`}
            className="rounded-pill bg-raised px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-ink"
          >
            {TOPICS[t].short} <span className="tabular-nums text-ink">{list.filter((a) => a.topics.includes(t)).length}</span>
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-2 py-3 text-[14px] text-muted">Quiet week here.</p>
      ) : (
        <ul className="flex flex-col">
          {list.slice(0, 4).map((a, i) => (
            <ArticleRow key={a.id} article={a} index={i} compact />
          ))}
        </ul>
      )}
    </Card>
  )
}