import { useEffect, useRef, useState, type Ref, type RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson'
import polylabel from 'polylabel'
import type { Place } from '../../lib/countries'

/*
  A large relief globe in the style of a news-desk globe: grey shaded relief on land, a near-black sea, and
  each country the story is about tinted in its own colour with its national emblem in white.

  Rendered with Three.js (WebGL) so the GPU does the per-frame work: the sphere samples one baked texture
  (public/globe, Natural Earth gray shaded relief, ocean painted black), borders are line geometry, and
  highlights are small per-country mask textures blended in the shader. The camera logic is plain maths on
  (centre, scale), shared with d3's orthographic projection, which also places the DOM emblems and labels.
*/

/** One colour per stop, for the light UI (chips, labels) */
export const PLACE_COLORS = ['#8a3a46', '#3c4c96', '#2a5f49', '#b07a1f']
/** The same family, lifted so it reads on the dark relief */
const GLOBE_COLORS = ['#d8607a', '#7a92ea', '#58b487', '#e8b04a']

export interface GlobeController {
  flyTo: (index: number) => void
  replay: () => void
}

type Coords = [number, number]
type Country = Feature<Polygon | MultiPolygon>
type Atlas = {
  byId: Map<string, Country[]>
  /** Line positions (xyz pairs) for country borders, coastlines and the graticule, built once */
  borders: Float32Array
  coasts: Float32Array
  graticule: Float32Array
}

/** Lon/lat (degrees) to a point on the unit sphere, matching d3's orthographic: +z faces the viewer at (0, 0) */
function toXYZ([lon, lat]: Coords, r = 1): [number, number, number] {
  const l = (lon * Math.PI) / 180
  const p = (lat * Math.PI) / 180
  return [r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l)]
}

/** Line segments on the sphere; long edges are split so they follow the curve instead of cutting under it */
function lineSegments(lines: Coords[][], r: number): Float32Array {
  const out: number[] = []
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]
      const b = line[i]
      const steps = Math.max(1, Math.ceil(geoDistance(a, b) / 0.012))
      const interp = steps > 1 ? geoInterpolate(a, b) : null
      let prev = a
      for (let s = 1; s <= steps; s++) {
        const next = interp ? (interp(s / steps) as Coords) : b
        out.push(...toXYZ(prev, r), ...toXYZ(next, r))
        prev = next
      }
    }
  return new Float32Array(out)
}

// The 1:50m atlas (~750 KB) and its line geometry are built once, only when an article page needs them
let atlas: Promise<Atlas> | null = null
function loadAtlas() {
  atlas ??= Promise.all([import('world-atlas/countries-50m.json'), import('topojson-client')]).then(([json, topo]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = ((json as any).default ?? json) as any
    const features = (topo.feature(t, t.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon>).features
    const byId = new Map<string, Country[]>()
    for (const f of features) byId.set(String(f.id), [...(byId.get(String(f.id)) ?? []), f])
    const borders = topo.mesh(t, t.objects.countries, (a, b) => a !== b) as MultiLineString
    const coasts = topo.mesh(t, t.objects.countries, (a, b) => a === b) as MultiLineString
    const grat = geoGraticule().step([15, 15])() as MultiLineString
    return {
      byId,
      borders: lineSegments(borders.coordinates as Coords[][], 1.0012),
      coasts: lineSegments(coasts.coordinates as Coords[][], 1.0012),
      graticule: lineSegments(grat.coordinates as Coords[][], 1.0008),
    }
  })
  return atlas
}

// The relief texture: 8K where the GPU and screen can use it, 4K on phones and smaller GPUs
const reliefCache = new Map<string, Promise<HTMLImageElement>>()
function loadRelief(url: string) {
  if (!reliefCache.has(url))
    reliefCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      }),
    )
  return reliefCache.get(url)!
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
 * The white national emblem on a highlighted country. public/emblems holds each country's coat of arms or
 * seal (from Wikimedia Commons), pre-converted to white line art and cropped to its visible pixels.
 * The EU gets its ring of twelve stars, drawn here.
 */
const emblemCache = new Map<string, Promise<{ url: string; aspect: number } | null>>()
function loadEmblem(code: string) {
  if (!emblemCache.has(code)) {
    const url = code === 'EU' ? euStars() : `/emblems/${code}.png`
    emblemCache.set(
      code,
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ url, aspect: img.naturalWidth / img.naturalHeight })
        img.onerror = () => resolve(null)
        img.src = url
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
    const cx = 100 + Math.cos(a) * 80
    const cy = 100 + Math.sin(a) * 80
    x.beginPath()
    for (let p = 0; p < 10; p++) {
      const r = p % 2 ? 7 : 17
      const t = -Math.PI / 2 + (p * Math.PI) / 5
      x.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r)
    }
    x.fill()
  }
  return c.toDataURL()
}

/** Deepest zoom, relative to the whole-globe scale (beyond this the relief texture turns soft) */
const MAX_ZOOM = 9

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const polygonsOf = (f: Country) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)

/**
 * What we frame on: each country's biggest polygon plus the sizeable ones near it. Keeps archipelagos whole
 * (Indonesia, Japan) but drops far-off territories (Alaska, French Guiana) that would zoom the camera out.
 */
function mainland(features: Country[]): Feature<MultiPolygon> {
  const polys = features.flatMap((f) => {
    const parts = polygonsOf(f)
    const area = (p: Polygon['coordinates']) => geoArea({ type: 'Polygon', coordinates: p })
    const biggest = parts.reduce((a, b) => (area(b) > area(a) ? b : a))
    const core = geoCentroid({ type: 'Polygon', coordinates: biggest }) as Coords
    return parts.filter(
      (p) => p === biggest || (area(p) >= area(biggest) * 0.04 && geoDistance(core, geoCentroid({ type: 'Polygon', coordinates: p }) as Coords) < 0.45),
    )
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } }
}

/**
 * Where the emblem goes and how big it can be: the middle of the country's largest landmass by area (what
 * reads as "the middle" of Yemen or Britain), and the emblem's size in globe radii: about 70% of the landmass's
 * shorter side, capped by the room around that point so thin, curving countries (Vietnam, Chile) don't get a
 * giant emblem spilling over their neighbours. For shapes whose middle falls outside the land (crescents,
 * S-shapes), it moves to the point deepest inside.
 */
function emblemSpot(features: Country[]): { center: Coords; size: number } {
  const polys = features.flatMap(polygonsOf)
  const biggest = polys.reduce((a, b) => (geoArea({ type: 'Polygon', coordinates: b }) > geoArea({ type: 'Polygon', coordinates: a }) ? b : a))
  const shape = { type: 'Polygon', coordinates: biggest } as Polygon
  let center = geoCentroid(shape) as Coords
  const flat = geoOrthographic().rotate([-center[0], -center[1]]).scale(1).translate([0, 0])
  const rings = biggest.map((ring) => ring.map((pt) => flat(pt as Coords) ?? ([0, 0] as [number, number])))
  const deepest = polylabel(rings, 0.0005)
  if (!geoContains(shape, center)) center = (flat.invert?.([deepest[0], deepest[1]]) as Coords) ?? center
  const [[x0, y0], [x1, y1]] = geoPath(flat).bounds(shape)
  return { center, size: Math.min(0.7 * Math.min(x1 - x0, y1 - y0), 4 * deepest.distance) }
}
/** A mask of the country, drawn over its own lon/lat box so it stays sharp when zoomed in */
function countryMask(features: Country[]) {
  const [[w, s], [e, n]] = geoBounds({ type: 'FeatureCollection', features } as FeatureCollection)
  const west = w - 0.5
  const south = Math.max(-90, s - 0.5)
  const spanLon = (e < w ? e + 360 : e) - w + 1
  const spanLat = Math.min(90, n + 0.5) - south
  const scale = Math.min(4096 / spanLon, 2048 / spanLat, 60)
  const cw = Math.max(16, Math.round(spanLon * scale))
  const ch = Math.max(16, Math.round(spanLat * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  for (const poly of features.flatMap(polygonsOf))
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon < west ? lon + 360 : lon) - west) * (cw / spanLon)
        const y = (south + spanLat - lat) * (ch / spanLat)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
      ctx.closePath()
    }
  ctx.fill('evenodd')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  return { tex, box: new THREE.Vector4(west, south, spanLon, spanLat) }
}

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = /* glsl */ `
  uniform sampler2D uRelief;
  uniform sampler2D uMask0, uMask1, uMask2, uMask3;
  uniform vec4 uBox[4];
  uniform vec3 uColor[4];
  uniform float uAlpha[4];
  varying vec3 vPos;
  varying vec3 vNormal;
  const float PI = 3.141592653589793;

  vec3 tint(vec3 col, float g, sampler2D mask, vec4 box, vec3 c, float a, float lon, float lat) {
    if (a <= 0.0) return col;
    float l = lon < box.x ? lon + 360.0 : lon;
    vec2 m = vec2((l - box.x) / box.z, (lat - box.y) / box.w);
    if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return col;
    float k = texture2D(mask, m).r * a;
    // The tint keeps some of the relief underneath, so the country still reads as terrain
    return mix(col, c * (0.5 + 0.75 * g), k * 0.78);
  }

  void main() {
    vec3 p = normalize(vPos);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.x, p.z);
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    // Derivatives from a copy of u that wraps elsewhere, so the texture seam at 180° doesn't flash a line
    vec2 uvAlt = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    vec2 dxa = dFdx(uvAlt), dya = dFdy(uvAlt);
    if (abs(dxa.x) + abs(dya.x) < abs(dx.x) + abs(dy.x)) { dx = dxa; dy = dya; }
    float g = textureGrad(uRelief, uv, dx, dy).r;
    vec3 col = vec3(g);

    float lonD = degrees(lon), latD = degrees(lat);
    col = tint(col, g, uMask0, uBox[0], uColor[0], uAlpha[0], lonD, latD);
    col = tint(col, g, uMask1, uBox[1], uColor[1], uAlpha[1], lonD, latD);
    col = tint(col, g, uMask2, uBox[2], uColor[2], uAlpha[2], lonD, latD);
    col = tint(col, g, uMask3, uBox[3], uColor[3], uAlpha[3], lonD, latD);

    // Soft key light from the upper left, a darker limb, and a faint atmosphere at the rim
    vec3 n = normalize(vNormal);
    float light = clamp(dot(n, normalize(vec3(-0.45, 0.55, 1.0))), 0.0, 1.0);
    col *= 0.62 + 0.45 * light;
    float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.6);
    col += vec3(0.80, 0.80, 0.78) * rim * 0.22;
    gl_FragColor = vec4(col, 1.0);
  }
`

interface Stop {
  /** Framing shape (mainland) and its centre, for the camera */
  focus: Feature<MultiPolygon>
  center: Coords
  /** Emblem placement: the middle of the main landmass, and the emblem's longer side in globe radii */
  mark: Coords
  size: number
  emblem: { url: string; aspect: number } | null
  outline: THREE.LineBasicMaterial
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
  const shadow = useRef<HTMLDivElement>(null)
  const emblems = useRef<(HTMLImageElement | null)[]>([])
  const labels = useRef<(HTMLDivElement | null)[]>([])
  const reduce = useReducedMotion()
  const [flagUrls, setFlagUrls] = useState<(string | null)[]>([])
  const [emblemUrls, setEmblemUrls] = useState<(string | null)[]>([])
  const [failed, setFailed] = useState(false)
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  useEffect(() => {
    let disposed = false
    let raf = 0
    let run = 0 // bumps on every new tour / fly-to so stale tweens stop

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas.current!, antialias: true, alpha: true })
    } catch {
      setFailed(true) // no WebGL: the page simply shows the article without the globe
      return
    }
    THREE.ColorManagement.enabled = false
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2e5)
    camera.position.z = 1e5
    const globe = new THREE.Group()
    scene.add(globe)

    const dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    dummy.needsUpdate = true
    const uniforms = {
      uRelief: { value: dummy as THREE.Texture },
      uMask0: { value: dummy as THREE.Texture },
      uMask1: { value: dummy as THREE.Texture },
      uMask2: { value: dummy as THREE.Texture },
      uMask3: { value: dummy as THREE.Texture },
      uBox: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 1)) },
      uColor: { value: GLOBE_COLORS.map((c) => new THREE.Color(c)) },
      uAlpha: { value: [0, 0, 0, 0] },
    }
    const sphereGeo = new THREE.SphereGeometry(1, 160, 120)
    const sphereMat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    globe.add(new THREE.Mesh(sphereGeo, sphereMat))
    const disposables: { dispose: () => void }[] = [sphereGeo, sphereMat, dummy]
    const addLines = (positions: Float32Array, mat: THREE.LineBasicMaterial) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      globe.add(new THREE.LineSegments(geo, mat))
      disposables.push(geo, mat)
    }

    /** frame = the free area countries are centred in (beside the article panel on wide screens) */
    const view = { w: 0, h: 0, base: 1, fx: 0, fy: 0, fw: 0, fh: 0, center: [0, 15] as Coords, k: 1, opacity: 0 }
    const projection = geoOrthographic().clipAngle(90)
    let stops: Stop[] = []

    // Scale that frames a stop (or several) inside the free area
    const fit = (focus: GeoPermissibleObjects, center: Coords) => {
      projection.rotate([-center[0], -center[1]]).scale(1).translate([0, 0])
      const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(focus)
      const bw = Math.max(x1 - x0, 1e-4)
      const bh = Math.max(y1 - y0, 1e-4)
      return clamp(Math.min((view.fw * 0.5) / bw, (view.fh * 0.42) / bh), view.base, view.base * MAX_ZOOM)
    }

    const draw = () => {
      const { w, h, k, center, fx, fy } = view
      // Same placement as d3's orthographic: (lon0, lat0) faces the viewer, scale k px per radius
      globe.position.set(fx - w / 2, h / 2 - fy, 0)
      globe.scale.setScalar(k)
      globe.rotation.set((center[1] * Math.PI) / 180, (-center[0] * Math.PI) / 180, 0, 'XYZ')
      stops.forEach((st, i) => {
        uniforms.uAlpha.value[i] = st.alpha
        st.outline.opacity = st.alpha * 0.9
      })
      canvas.current!.style.opacity = String(view.opacity)
      const sh = shadow.current!
      sh.style.opacity = String(view.opacity)
      sh.style.transform = `translate3d(${fx - view.base}px, ${fy - view.base}px, 0) scale(${k / view.base})`
      renderer.render(scene, camera)

      // Emblems and labels: DOM layers moved to each country's visual centre
      projection.rotate([-center[0], -center[1]]).scale(k).translate([fx, fy])
      stops.forEach((st, i) => {
        const p = projection(st.mark)
        const facing = geoDistance(st.mark, center) < Math.PI / 2 - 0.12
        const a = facing && p ? st.alpha * view.opacity : 0
        const size = clamp(st.size * k, 36, 280)
        const asp = st.emblem?.aspect ?? 1
        const ew = asp >= 1 ? size : size * asp
        const eh = asp >= 1 ? size / asp : size
        const img = emblems.current[i]
        if (img) {
          img.style.opacity = String(a * 0.95)
          if (p) img.style.transform = `translate3d(${p[0] - ew / 2}px, ${p[1] - eh / 2}px, 0)`
          img.style.width = `${ew}px`
          img.style.height = `${eh}px`
        }
        const label = labels.current[i]
        if (label) {
          label.style.opacity = String(a)
          if (p) label.style.transform = `translate3d(${p[0] + ew / 2 + 12}px, ${p[1]}px, 0) translateY(-50%)`
        }
      })
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

    /** All stops in one view, or null when they're too far apart to share a hemisphere nicely */
    const overview = () => {
      const spread = Math.max(...stops.flatMap((a) => stops.map((b) => geoDistance(a.center, b.center))))
      if (stops.length > 1 && spread > (100 * Math.PI) / 180) return null
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
        const last = stops.at(-1)
        Object.assign(view, o ? { center: o.center, k: o.k, opacity: 1 } : { center: last?.center ?? view.center, k: last ? fit(last.focus, last.center) : view.base, opacity: 1 })
        stops.forEach((st) => (st.alpha = 1))
        onFocusRef.current?.(o && stops.length > 1 ? -1 : stops.length - 1)
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
      // End on all of them together when they fit in one view; far-apart stops stay on the last one
      const o = overview()
      if (stops.length > 1 && o) {
        onFocusRef.current?.(-1)
        await flight(o.center, o.k, id)
      }
    }

    async function flyTo(index: number) {
      const id = ++run
      view.opacity = 1
      if (index < 0) {
        const o = overview()
        if (!o) return
        onFocusRef.current?.(-1)
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(box.width, box.height, false)
      Object.assign(camera, { left: -box.width / 2, right: box.width / 2, top: box.height / 2, bottom: -box.height / 2 })
      camera.updateProjectionMatrix()
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
      shadow.current!.style.width = shadow.current!.style.height = `${view.base * 2}px`
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap.current!)
    if (avoid?.current) ro.observe(avoid.current)
    resize()

    const small = Math.min(window.screen.width, window.screen.height) < 768
    const reliefUrl = renderer.capabilities.maxTextureSize >= 8192 && !small ? '/globe/relief-8k.jpg' : '/globe/relief-4k.jpg'

    Promise.all([loadAtlas(), loadRelief(reliefUrl), Promise.all(places.map((p) => loadEmblem(p.code))), Promise.all(places.map((p) => loadFlag(p.code)))]).then(
      ([g, reliefImg, marks, flags]) => {
        if (disposed) return
        const relief = new THREE.Texture(reliefImg)
        relief.colorSpace = THREE.NoColorSpace
        relief.anisotropy = renderer.capabilities.getMaxAnisotropy()
        relief.needsUpdate = true
        uniforms.uRelief.value = relief
        disposables.push(relief)

        const lineMat = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
        addLines(g.graticule, lineMat(0xffffff, 0.06))
        addLines(g.coasts, lineMat(0xffffff, 0.22))
        addLines(g.borders, lineMat(0xffffff, 0.3))

        stops = places.map((place, i) => {
          // A group (the EU) leaves out members that are stops of their own, so they keep their own colour
          const others = new Set(places.filter((q) => q !== place && q.ids.length === 1).flatMap((q) => q.ids))
          const ids = place.ids.length > 1 ? place.ids.filter((id) => !others.has(id)) : place.ids
          const features = ids.flatMap((id) => g.byId.get(id) ?? [])
          const focus = mainland(features)
          const { tex, box } = countryMask(features)
          ;(uniforms as unknown as Record<string, { value: THREE.Texture }>)[`uMask${i}`].value = tex
          uniforms.uBox.value[i] = box
          disposables.push(tex)
          const outline = lineMat(new THREE.Color(GLOBE_COLORS[i % GLOBE_COLORS.length]).lerp(new THREE.Color('#ffffff'), 0.35).getHex(), 0)
          const rings = features.flatMap(polygonsOf).flatMap((poly) => poly) as Coords[][]
          addLines(lineSegments(rings, 1.0016), outline)
          const spot = emblemSpot(features)
          const center = geoCentroid(focus) as Coords
          return {
            focus,
            center,
            mark: spot.center,
            size: spot.size,
            emblem: marks[i],
            outline,
            alpha: 0,
          }
        })
        setEmblemUrls(marks.map((m) => m?.url ?? null))
        setFlagUrls(flags)
        tour()
      },
      () => !disposed && setFailed(true),
    )

    const api: GlobeController = { flyTo: (i) => void flyTo(i), replay: () => void tour() }
    if (typeof controller === 'function') controller(api)
    else if (controller) controller.current = api

    return () => {
      disposed = true
      run++
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (typeof controller === 'function') controller(null)
      else if (controller) controller.current = null
    }
    // places is stable per article (memoised by the caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, reduce])

  if (failed) return null
  return (
    <div ref={wrap} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* A soft shadow under the dark globe so it sits on the light page instead of floating */}
      <div
        ref={shadow}
        className="pointer-events-none absolute left-0 top-0 rounded-full will-change-transform"
        style={{ opacity: 0, boxShadow: '0 40px 120px -20px rgba(28,33,30,0.45), 0 0 0 1px rgba(28,33,30,0.08)' }}
      />
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 size-full" style={{ opacity: 0 }} aria-hidden />
      {places.map((p, i) => (
        <img
          key={`e-${p.code}`}
          ref={(n) => {
            emblems.current[i] = n
          }}
          src={emblemUrls[i] ?? undefined}
          alt=""
          className="pointer-events-none absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0, display: emblemUrls[i] ? undefined : 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}
          aria-hidden
        />
      ))}
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
