import { useEffect, useRef, useState, type Ref, type RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import { geoCentroid, geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { Place } from '../../lib/countries'

/*
  A large, light, paper-like globe drawn with d3-geo on one canvas, filling the page behind the article.
  It opens zoomed out, flies to each country the story is about (pulling back on long hops so you see the
  route), and marks each one with a flat tint and its national emblem in white.

  Kept cheap per frame: the sea, halo and shading are CSS layers that only get a transform; the canvas
  draws just the graticule, land and highlights, from the 1:110m atlas unless zoomed in close.
*/

/** One tint per stop, from the app's tool palette */
export const PLACE_COLORS = ['#8a3a46', '#3c4c96', '#2a5f49', '#b07a1f']

export interface GlobeController {
  flyTo: (index: number) => void
  replay: () => void
}

type Coords = [number, number]
type Country = Feature<Polygon | MultiPolygon>
/**
 * One polygon (a country's mainland, or one island) with a bounding circle. Zoomed in, we cull per polygon:
 * culling per country would still project all of Russia or Indonesia whenever a corner of them is in view.
 */
type Poly = { coords: Polygon['coordinates']; c: Coords; r: number; id: string }
type Geo = {
  /** 1:110m: drawn unless zoomed in close (about 10x cheaper; the extra detail would be sub-pixel) */
  lo: { land: GeoPermissibleObjects; outlines: GeoPermissibleObjects; byId: Map<string, Country[]> }
  /** 1:50m: drawn zoomed in (culled per polygon), and the only source for small countries like Singapore */
  hi: Poly[]
  hiById: Map<string, Country[]>
}

// The atlases (~850 KB together) load once, only when an article page needs them
let atlas: Promise<Geo> | null = null
function loadAtlas() {
  atlas ??= Promise.all([import('world-atlas/countries-110m.json'), import('world-atlas/countries-50m.json'), import('topojson-client')]).then(([loJson, hiJson, topo]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tl = ((loJson as any).default ?? loJson) as any, th = ((hiJson as any).default ?? hiJson) as any
    const loFeatures = (topo.feature(tl, tl.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon>).features
    const byId = new Map<string, Country[]>()
    for (const f of loFeatures) byId.set(String(f.id), [...(byId.get(String(f.id)) ?? []), f])
    const features = (topo.feature(th, th.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon>).features
    const hiById = new Map<string, Country[]>()
    const hi: Poly[] = []
    for (const f of features) {
      const id = String(f.id)
      hiById.set(id, [...(hiById.get(id) ?? []), f])
      for (const coords of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) {
        const c = geoCentroid({ type: 'Polygon', coordinates: coords }) as Coords
        let r = 0
        for (let i = 0; i < coords[0].length; i += 2) r = Math.max(r, geoDistance(c, coords[0][i] as Coords))
        hi.push({ coords, c, r, id })
      }
    }
    return { lo: { land: topo.merge(tl, tl.objects.countries.geometries), outlines: topo.mesh(tl, tl.objects.countries), byId }, hi, hiById }
  })
  return atlas
}

// Flags (for the small labels and chips) come from country-flag-icons; each SVG is its own small lazy chunk
const flagFiles = import.meta.glob<string>('/node_modules/country-flag-icons/3x2/*.svg', { query: '?raw', import: 'default' })
const flagCache = new Map<string, Promise<string | null>>()
export function loadFlag(code: string) {
  if (!flagCache.has(code)) {
    const load = flagFiles[`/node_modules/country-flag-icons/3x2/${code}.svg`]
    flagCache.set(code, load ? load().then((svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))) : Promise.resolve(null))
  }
  return flagCache.get(code)!
}

/**
 * The white national emblem drawn on a highlighted country. public/emblems holds each country's coat of arms
 * or seal (from Wikimedia Commons), pre-converted to white line art. The EU gets its ring of twelve stars.
 */
const emblemCache = new Map<string, Promise<CanvasImageSource | null>>()
function loadEmblem(code: string) {
  if (!emblemCache.has(code)) {
    emblemCache.set(
      code,
      code === 'EU'
        ? Promise.resolve(euStars())
        : new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => resolve(null)
            img.src = `/emblems/${code}.png`
          }),
    )
  }
  return emblemCache.get(code)!
}
function euStars() {
  const c = document.createElement('canvas')
  c.width = c.height = 200
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const cx = 100 + Math.cos(a) * 70
    const cy = 100 + Math.sin(a) * 70
    x.beginPath()
    for (let p = 0; p < 10; p++) {
      const r = p % 2 ? 6 : 15
      const t = -Math.PI / 2 + (p * Math.PI) / 5
      x.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r)
    }
    x.fill()
  }
  return c
}

/** Zoom (relative to the whole-globe scale) where the detailed atlas takes over */
const DETAIL_ZOOM = 3.5
/** The halo layer's radius relative to the sphere */
const HALO = 1.2

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/**
 * What we frame on: each country's biggest polygon plus the sizeable ones near it. Keeps archipelagos whole
 * (Indonesia, Japan) but drops far-off territories (Alaska, French Guiana) that would zoom the camera out.
 */
function mainland(features: Country[]): Feature<MultiPolygon> {
  const polys = features.flatMap((f) => {
    if (f.geometry.type === 'Polygon') return [f.geometry.coordinates]
    const parts = f.geometry.coordinates
    const size = (p: Polygon['coordinates']) => p[0].length // ring vertex count is a good-enough proxy for size at 50m
    const biggest = parts.reduce((a, b) => (size(b) > size(a) ? b : a))
    const core = geoCentroid({ type: 'Polygon', coordinates: biggest }) as Coords
    return parts.filter(
      (p) => p === biggest || (size(p) >= size(biggest) * 0.05 && geoDistance(core, geoCentroid({ type: 'Polygon', coordinates: p }) as Coords) < 0.45),
    )
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } }
}

interface Stop {
  color: string
  /** Detailed polygons (culled like the land), and the light shape (null when the 110m atlas lacks the country) */
  hi: Poly[]
  lo: FeatureCollection | null
  focus: Feature<MultiPolygon>
  center: Coords
  /** the country's smaller on-screen side at scale 1, so the emblem can size itself without re-projecting */
  extent: number
  emblem: CanvasImageSource | null
  /** highlight strength, 0..1 */
  alpha: number
}

export function Globe({
  places,
  controller,
  onFocus,
  avoid,
  className,
}: {
  places: Place[]
  controller?: Ref<GlobeController | null>
  /** Index of the country in view, -1 for the overview */
  onFocus?: (index: number) => void
  /** An element over the stage (the article panel): countries are framed in the space beside it */
  avoid?: RefObject<HTMLElement | null>
  className?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const halo = useRef<HTMLDivElement>(null)
  const sea = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const labels = useRef<(HTMLDivElement | null)[]>([])
  const reduce = useReducedMotion()
  const [flagUrls, setFlagUrls] = useState<(string | null)[]>([])
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  useEffect(() => {
    let disposed = false
    let raf = 0
    let run = 0 // bumps on every new tour / fly-to so stale tweens stop
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    const projection = geoOrthographic().clipAngle(90).precision(1.2)
    const path = geoPath(projection, ctx)
    const graticule = geoGraticule().step([15, 15])()
    /** frame = the free area countries are centred in (beside the article panel on wide screens) */
    const view = { w: 0, h: 0, dpr: 1, base: 1, fx: 0, fy: 0, fw: 0, fh: 0, center: [0, 15] as Coords, k: 1, opacity: 0 }
    let geo: Geo | null = null
    let stops: Stop[] = []
    const layers = [halo.current!, sea.current!, shade.current!]

    // Scale that frames a stop (or several) inside the free area
    const fit = (focus: GeoPermissibleObjects, center: Coords) => {
      projection.rotate([-center[0], -center[1]]).scale(1).translate([0, 0])
      const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(focus)
      const bw = Math.max(x1 - x0, 1e-4)
      const bh = Math.max(y1 - y0, 1e-4)
      return clamp(Math.min((view.fw * 0.5) / bw, (view.fh * 0.42) / bh), view.base, view.base * 16)
    }

    const draw = () => {
      const { w, h, dpr, k, center, fx, fy } = view
      // The sphere's CSS layers: sized to the base radius, moved and scaled to the current one
      const s = k / view.base
      layers.forEach((layer, i) => {
        const r = view.base * (i === 0 ? HALO : 1)
        layer.style.opacity = String(view.opacity)
        layer.style.transform = `translate3d(${fx - r}px, ${fy - r}px, 0) scale(${s})`
      })
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!geo) return
      ctx.globalAlpha = view.opacity
      projection.rotate([-center[0], -center[1]]).scale(k).translate([fx, fy])
      const detailed = k >= view.base * DETAIL_ZOOM

      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = 'rgba(28, 33, 30, 0.07)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      // Land, then outlines. Zoomed out: the light atlas, outlines as one mesh. Zoomed in: the detailed
      // atlas, only the countries whose bounding circle reaches into the frame.
      // Angle from the globe's centre to the farthest corner of the screen: anything beyond is out of view
      const corner = Math.hypot(Math.max(fx, w - fx), Math.max(fy, h - fy))
      const reach = corner >= k ? Math.PI / 2 : Math.asin(corner / k)
      // Polygons in view and at least about a pixel across
      const cull = (polys: Poly[]) =>
        ({ type: 'MultiPolygon', coordinates: polys.filter((p) => p.r * k > 0.6 && geoDistance(p.c, center) < reach + p.r).map((p) => p.coords) }) as MultiPolygon
      ctx.fillStyle = '#fbfbf7'
      ctx.strokeStyle = 'rgba(97, 104, 98, 0.3)'
      ctx.lineWidth = 0.6
      if (!detailed) {
        ctx.beginPath()
        path(geo.lo.land)
        ctx.fill()
        ctx.beginPath()
        path(geo.lo.outlines)
        ctx.stroke()
      } else {
        ctx.beginPath()
        path(cull(geo.hi))
        ctx.fill()
        ctx.stroke()
      }

      // Highlighted countries: one flat tint, a stronger outline, the emblem in white on top
      for (const st of stops) {
        if (st.alpha <= 0.001 || geoDistance(st.center, center) > Math.PI / 2 + 0.6) continue
        const shape = new Path2D()
        path.context(shape as unknown as CanvasRenderingContext2D)(detailed || !st.lo ? cull(st.hi) : st.lo)
        path.context(ctx)
        ctx.globalAlpha = view.opacity * st.alpha * 0.55
        ctx.fillStyle = st.color
        ctx.fill(shape)
        ctx.globalAlpha = view.opacity * st.alpha
        ctx.strokeStyle = st.color
        ctx.lineWidth = 1.2
        ctx.stroke(shape)
      }
      ctx.globalAlpha = view.opacity
      ctx.beginPath()
      ctx.arc(fx, fy, k, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(28, 33, 30, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Emblems and labels sit at each country's centre, sized to how big the country is on screen
      stops.forEach((st, i) => {
        const label = labels.current[i]
        const p = projection(st.center)
        const facing = geoDistance(st.center, center) < Math.PI / 2 - 0.12
        const a = facing && p ? st.alpha * view.opacity : 0
        let size = 0
        if (a > 0 && p) {
          size = clamp(k * st.extent * 0.55, 26, 150)
          if (st.emblem) {
            const iw = (st.emblem as HTMLImageElement).width
            const ih = (st.emblem as HTMLImageElement).height
            const sc = size / Math.max(iw, ih)
            ctx.globalAlpha = a * 0.92
            ctx.drawImage(st.emblem, p[0] - (iw * sc) / 2, p[1] - (ih * sc) / 2, iw * sc, ih * sc)
          }
        }
        if (label) {
          label.style.opacity = String(a)
          if (p) label.style.transform = `translate3d(${p[0] + size / 2 + 10}px, ${p[1]}px, 0) translateY(-50%)`
        }
      })
      ctx.globalAlpha = 1
    }

    // Single rAF loop that only runs while something is moving
    const tweens = new Set<(now: number) => boolean>()
    const tick = (now: number) => {
      for (const t of tweens) if (!t(now)) tweens.delete(t)
      draw()
      raf = tweens.size ? requestAnimationFrame(tick) : 0
    }
    const tween = (ms: number, step: (t: number) => void, id = run) =>
      new Promise<boolean>((resolve) => {
        if (reduce || ms <= 0) {
          step(1)
          if (!raf) raf = requestAnimationFrame(tick)
          return resolve(id === run)
        }
        let start = -1
        tweens.add((now) => {
          if (id !== run) return resolve(false), false
          if (start < 0) start = now
          const t = Math.min(1, (now - start) / ms)
          step(t)
          if (t >= 1) return resolve(true), false
          return true
        })
        if (!raf) raf = requestAnimationFrame(tick)
      })
    const wait = (ms: number, id = run) => new Promise<boolean>((r) => setTimeout(() => r(id === run && !disposed), reduce ? 0 : ms))

    /** Great-circle flight; on long hops the camera pulls back mid-way so you see the route */
    const flight = (to: Coords, kTo: number, id: number) => {
      const from = view.center
      const kFrom = view.k
      const d = geoDistance(from, to)
      const interp = geoInterpolate(from, to)
      const kMid = Math.max(view.base * 0.9, Math.min(kFrom, kTo) / (1 + 2.6 * (d / Math.PI)))
      const l0 = Math.log(kFrom)
      const l2 = Math.log(kTo)
      // Quadratic Bézier in log-scale that passes through kMid at the halfway point
      const l1 = kMid < Math.min(kFrom, kTo) ? 2 * Math.log(kMid) - (l0 + l2) / 2 : (l0 + l2) / 2
      const ms = clamp(1200 + 1500 * (d / Math.PI) + 220 * Math.abs(l2 - l0), 1200, 2700)
      return tween(
        ms,
        (raw) => {
          const t = easeInOut(raw)
          view.center = interp(t) as Coords
          view.k = Math.exp((1 - t) * (1 - t) * l0 + 2 * (1 - t) * t * l1 + t * t * l2)
        },
        id,
      )
    }

    const reveal = (st: Stop, id: number) => tween(600, (t) => (st.alpha = Math.max(st.alpha, easeOut(t))), id)

    const overview = () => {
      const all = { type: 'FeatureCollection', features: stops.map((st) => st.focus) } as FeatureCollection
      const center = geoCentroid(all) as Coords
      return { center, k: stops.length > 1 ? Math.min(fit(all, center), view.base * 3) : view.base }
    }

    async function tour() {
      const id = ++run
      stops.forEach((st) => (st.alpha = 0))
      onFocusRef.current?.(stops.length ? 0 : -1)
      // Open a little small and turned away, then settle into place
      const first = stops[0]?.center ?? [100, 10]
      const startLon = first[0] - 60
      const lat = clamp(first[1] * 0.4, -30, 30)
      view.center = [startLon, lat]
      view.k = view.base * 0.8
      view.opacity = 0
      if (reduce) {
        const o = overview()
        Object.assign(view, { center: o.center, k: o.k, opacity: 1 })
        stops.forEach((st) => (st.alpha = 1))
        onFocusRef.current?.(stops.length > 1 ? -1 : 0)
        return tween(0, () => {}, id)
      }
      const ok = await tween(
        900,
        (t) => {
          const e = easeOut(t)
          view.opacity = Math.min(1, t * 1.8)
          view.k = view.base * (0.8 + 0.2 * e)
          view.center = [startLon + 20 * e, lat]
        },
        id,
      )
      if (!ok) return
      for (let i = 0; i < stops.length; i++) {
        const st = stops[i]
        onFocusRef.current?.(i)
        if (!(await flight(st.center, fit(st.focus, st.center), id))) return
        if (!(await reveal(st, id))) return
        if (!(await wait(i === stops.length - 1 ? 900 : 1300, id))) return
      }
      if (stops.length > 1) {
        onFocusRef.current?.(-1)
        const o = overview()
        await flight(o.center, o.k, id)
      }
    }

    async function flyTo(index: number) {
      const id = ++run
      view.opacity = 1
      if (index < 0) {
        onFocusRef.current?.(-1)
        const o = overview()
        return flight(o.center, o.k, id)
      }
      const st = stops[index]
      if (!st) return
      onFocusRef.current?.(index)
      if (await flight(st.center, fit(st.focus, st.center), id)) await reveal(st, id)
    }

    const resize = () => {
      const box = wrap.current!.getBoundingClientRect()
      view.w = box.width
      view.h = box.height
      // 1.5x is plenty for a soft illustrated globe and keeps fill cost down on retina screens
      view.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(box.width * view.dpr)
      el.height = Math.round(box.height * view.dpr)
      // Free area: left of the panel when it sits beside the globe, otherwise the whole stage
      const panel = avoid?.current?.getBoundingClientRect()
      const beside = panel && panel.left > box.left + box.width * 0.4
      view.fw = beside ? panel.left - box.left - 24 : box.width
      view.fh = box.height
      view.fx = view.fw / 2
      view.fy = box.height / 2
      const prevBase = view.base
      view.base = beside ? Math.min(box.height * 0.5, view.fw * 0.62) : Math.min(box.width * 0.6, box.height * 0.5)
      view.k *= view.base / prevBase
      layers.forEach((layer, i) => {
        layer.style.width = layer.style.height = `${view.base * 2 * (i === 0 ? HALO : 1)}px`
      })
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap.current!)
    if (avoid?.current) ro.observe(avoid.current)
    resize()

    loadAtlas().then(async (g) => {
      if (disposed) return
      geo = g
      const [emblems, flags] = await Promise.all([Promise.all(places.map((p) => loadEmblem(p.code))), Promise.all(places.map((p) => loadFlag(p.code)))])
      if (disposed) return
      stops = places.map((place, i) => {
        const hi = place.ids.flatMap((id) => g.hiById.get(id) ?? [])
        const lo = place.ids.flatMap((id) => g.lo.byId.get(id) ?? [])
        const focus = mainland(hi)
        const center = geoCentroid(focus) as Coords
        projection.rotate([-center[0], -center[1]]).scale(1).translate([0, 0])
        const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(focus)
        return {
          color: PLACE_COLORS[i % PLACE_COLORS.length],
          hi: g.hi.filter((p) => place.ids.includes(p.id)),
          lo: lo.length ? { type: 'FeatureCollection', features: lo } : null,
          focus,
          center,
          extent: Math.min(x1 - x0, y1 - y0) || 0.01,
          emblem: emblems[i],
          alpha: 0,
        }
      })
      setFlagUrls(flags)
      tour()
    })

    const api: GlobeController = { flyTo: (i) => void flyTo(i), replay: () => void tour() }
    if (typeof controller === 'function') controller(api)
    else if (controller) controller.current = api

    return () => {
      disposed = true
      run++
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (typeof controller === 'function') controller(null)
      else if (controller) controller.current = null
    }
    // places is stable per article (memoised by the caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, reduce])

  const layer = 'pointer-events-none absolute left-0 top-0 rounded-full will-change-transform'
  return (
    <div ref={wrap} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Soft halo in the news tint, the sea, then (above the canvas) light and rim shading */}
      <div ref={halo} className={layer} style={{ opacity: 0, background: 'radial-gradient(closest-side, rgba(110,42,53,0.12) 80%, rgba(110,42,53,0) 100%)' }} />
      <div ref={sea} className={layer} style={{ opacity: 0, background: 'radial-gradient(circle at 32% 28%, #f3f3ec 0%, #e6e7df 70%, #dcddd4 100%)' }} />
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      <div
        ref={shade}
        className={layer}
        style={{ opacity: 0, background: 'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 45%, rgba(28,33,30,0.03) 78%, rgba(28,33,30,0.12) 100%)' }}
      />
      {places.map((p, i) => (
        <div
          key={p.code}
          ref={(n) => {
            labels.current[i] = n
          }}
          className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-card/90 py-1 pl-1 pr-2.5 text-[12px] font-[480] shadow-[0_1px_0_rgba(28,33,30,0.06)] ring-1 backdrop-blur-md will-change-transform"
          style={{ opacity: 0, color: PLACE_COLORS[i % PLACE_COLORS.length], ['--tw-ring-color' as string]: `color-mix(in srgb, ${PLACE_COLORS[i % PLACE_COLORS.length]} 35%, transparent)` }}
          aria-hidden
        >
          {flagUrls[i] ? <img src={flagUrls[i]!} alt="" className="h-3.5 w-[21px] rounded-[3px] object-cover" /> : null}
          {p.name}
        </div>
      ))}
    </div>
  )
}
