/**
 * Liquid Glass — edge-refraction glass effect via SVG feDisplacementMap.
 *
 * Generates per-element displacement + specular maps on hidden canvases,
 * injects SVG <filter> definitions, and applies them as `backdrop-filter`.
 *
 * Chromium-only (SVG backdrop-filter).  Falls back to CSS blur elsewhere.
 *
 * Inspired by:
 *   - https://github.com/archisvaze/liquid-glass
 *   - https://github.com/dashersw/liquid-glass-js
 *
 * ── Quick-start ───────────────────────────────────────────────────────────────
 *
 * 1. Add the `rounded-glass-card` class to your root element.  The base
 *    styles are defined globally in `assets/css/glass-card.css` (registered
 *    in nuxt.config.ts), so any component can use them without importing
 *    anything.  For a fully custom card style, see TimeWidget.vue.
 *
 * 2. Grab a template ref for that element:
 *
 *      const cardEl = ref<HTMLElement | null>(null)
 *      // <div ref="cardEl" class="rounded-glass-card"> … </div>
 *
 * 3. Call `useLiquidGlass()` in <script setup> (outside onMounted — the
 *    composable is safe to construct during SSR, it only touches the DOM
 *    inside `init`):
 *
 *      const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
 *
 * 4. Initialise on mount and clean up on unmount:
 *
 *      onMounted(() => {
 *        nextTick(() => { if (cardEl.value) initGlass(cardEl.value) })
 *      })
 *      onUnmounted(() => destroyGlass())
 *
 *    The `nextTick` ensures the element has been painted and has a non-zero
 *    size before the filter maps are generated.  If your component fetches
 *    data before rendering, call initGlass *after* the first fetch resolves:
 *
 *      onMounted(async () => {
 *        await fetchData()
 *        nextTick(() => { if (cardEl.value) initGlass(cardEl.value) })
 *      })
 *
 * ── Custom config ─────────────────────────────────────────────────────────────
 *
 * Pass a partial `LiquidGlassConfig` to override any of the defaults:
 *
 *   const { init, destroy } = useLiquidGlass({
 *     bezelWidth:      15,   // narrower refraction band (default 25)
 *     maxDisplacement: 30,   // gentler warp (default 50)
 *     frostBlur:       0.8,  // near-clear glass (default 1.3)
 *     saturation:      1.2,  // slightly boosted colours (default 1.0)
 *     specularOpacity: 0.35, // stronger edge highlight (default 0.22)
 *     borderRadius:    12,   // match your CSS border-radius (default 20)
 *   })
 *
 * Only the properties you specify are overridden — the rest stay at defaults.
 * See the `LiquidGlassConfig` interface and `DEFAULTS` below for the full list
 * and a description of what each parameter controls.
 *
 * ── Each instance is independent ─────────────────────────────────────────────
 *
 * Every `useLiquidGlass()` call creates an isolated instance: its own SVG
 * element, its own filter IDs, and its own ResizeObserver.  This means
 * multiple components on the same page can each have different configs without
 * interfering with each other.  Always call `destroyGlass()` on unmount to
 * remove the injected <svg> from <body> and release the observer.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

export interface LiquidGlassConfig {
  /** Width of the refractive edge bezel in pixels (element space). */
  bezelWidth: number
  /** Maximum displacement at the glass edge (px). */
  maxDisplacement: number
  /** Frosted-glass Gaussian blur σ (px). */
  frostBlur: number
  /** Saturation multiplier (1.0 = unchanged). */
  saturation: number
  /** Specular highlight opacity (0–1). */
  specularOpacity: number
  /** Border-radius matching the CSS `.rounded-glass-card` (px). */
  borderRadius: number
  /** Maximum texture edge for generated maps (px). Smaller = faster & smaller data URLs. */
  mapMaxEdge: number
  /** CSS color string for an optional tint layer (e.g. `'#BA0C2F'` or `'rgb(5,88,135)'`). Has no effect when tintOpacity is 0. */
  tintColor: string
  /** Opacity of the tint layer (0 = none, 1 = fully opaque). Default 0 disables tinting. */
  tintOpacity: number
}

const DEFAULTS: LiquidGlassConfig = {
  bezelWidth: 25, // how wide the refractive edge "bezel" is (in element pixels) — controls how far from the edge the effect extends
  maxDisplacement: 50, // how strong the maximum refraction is at the bezel edge (in pixels) — controls how warped the view looks at the edges
  frostBlur: 1.3, // the σ for the Gaussian blur applied to the backdrop before refraction — controls how frosty vs clear the glass looks
  saturation: 1.0, // saturation multiplier for the refracted backdrop — controls how vibrant vs washed-out the view looks
  specularOpacity: 0.22, // opacity for the specular highlight layer (0–1) — controls how strong the edge highlights are
  borderRadius: 20, // should match the CSS border-radius of the target elements to avoid visual seams at the corners
  mapMaxEdge: 128, // maximum edge length for generated displacement/specular maps — controls performance & data URL size (maps are scaled to element size, so this is a max rather than fixed size)
  tintColor: '#ffffff', // CSS color used for the optional tint layer — only visible when tintOpacity > 0
  tintOpacity: 0 // opacity of the tint overlay (0 = disabled, 1 = fully opaque) — blends a colour wash over the refracted backdrop
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Signed distance from a rounded rectangle centred at (cx, cy).
 * Returns negative inside, positive outside.
 */
function sdfRoundRect(
  px: number, py: number,
  cx: number, cy: number,
  hw: number, hh: number,
  r: number
): number {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return (
    Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2)
    + Math.min(Math.max(qx, qy), 0)
    - r
  )
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ── Map dimension helper ──────────────────────────────────────────────────────

function mapSize(elW: number, elH: number, maxEdge: number): [number, number] {
  if (elW <= maxEdge && elH <= maxEdge) return [elW, elH]
  const ratio = elW / elH
  if (elW >= elH) {
    const w = maxEdge
    return [w, Math.max(2, Math.round(w / ratio))]
  }
  const h = maxEdge
  return [Math.max(2, Math.round(h * ratio)), h]
}

// ── Displacement map (SDF-based) ──────────────────────────────────────────────

function genDisplacementMap(
  mW: number, mH: number,
  elW: number, elH: number,
  radius: number, bezel: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = mW
  canvas.height = mH
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(mW, mH)
  const d = img.data

  const sx = elW / mW
  const sy = elH / mH
  const cx = elW / 2
  const cy = elH / 2
  const hw = elW / 2
  const hh = elH / 2
  const r = Math.min(radius, hw, hh)
  const eps = Math.max(sx, sy) * 0.5

  for (let my = 0; my < mH; my++) {
    for (let mx = 0; mx < mW; mx++) {
      const idx = (my * mW + mx) << 2

      // Neutral = no displacement
      d[idx] = 128
      d[idx + 1] = 128
      d[idx + 2] = 0
      d[idx + 3] = 255

      // Map pixel → element coordinates
      const ex = (mx + 0.5) * sx
      const ey = (my + 0.5) * sy
      const dist = sdfRoundRect(ex, ey, cx, cy, hw, hh, r)

      // Only process pixels inside the bezel zone
      if (dist > 0.5 || dist < -bezel) continue

      // t: 0 at edge → 1 at inner bezel boundary
      const t = Math.max(0, -dist) / bezel
      const strength = 1 - smoothstep(0, 1, t)

      // SDF gradient = outward normal
      const gx
        = sdfRoundRect(ex + eps, ey, cx, cy, hw, hh, r)
          - sdfRoundRect(ex - eps, ey, cx, cy, hw, hh, r)
      const gy
        = sdfRoundRect(ex, ey + eps, cx, cy, hw, hh, r)
          - sdfRoundRect(ex, ey - eps, cx, cy, hw, hh, r)
      const gm = Math.sqrt(gx * gx + gy * gy)
      if (gm < 1e-4) continue

      // Displacement points inward (glass refracts toward centre at edges)
      const nx = -gx / gm
      const ny = -gy / gm

      d[idx] = Math.max(0, Math.min(255, Math.round(128 + nx * strength * 127)))
      d[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + ny * strength * 127)))
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

// ── Specular highlight map ────────────────────────────────────────────────────

function genSpecularMap(
  mW: number, mH: number,
  elW: number, elH: number,
  radius: number, bezel: number,
  lightAngle = Math.PI * 0.28
): string {
  const canvas = document.createElement('canvas')
  canvas.width = mW
  canvas.height = mH
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(mW, mH)
  const d = img.data

  const sx = elW / mW
  const sy = elH / mH
  const cx = elW / 2
  const cy = elH / 2
  const hw = elW / 2
  const hh = elH / 2
  const r = Math.min(radius, hw, hh)
  const eps = Math.max(sx, sy) * 0.5
  const lx = Math.cos(lightAngle)
  const ly = Math.sin(lightAngle)

  for (let my = 0; my < mH; my++) {
    for (let mx = 0; mx < mW; mx++) {
      const idx = (my * mW + mx) << 2
      d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 0

      const ex = (mx + 0.5) * sx
      const ey = (my + 0.5) * sy
      const dist = sdfRoundRect(ex, ey, cx, cy, hw, hh, r)

      const zone = bezel * 1.2
      if (dist > 0.5 || dist < -zone) continue

      const t = Math.max(0, -dist) / zone
      const edge = 1 - smoothstep(0, 1, t)

      const gx
        = sdfRoundRect(ex + eps, ey, cx, cy, hw, hh, r)
          - sdfRoundRect(ex - eps, ey, cx, cy, hw, hh, r)
      const gy
        = sdfRoundRect(ex, ey + eps, cx, cy, hw, hh, r)
          - sdfRoundRect(ex, ey - eps, cx, cy, hw, hh, r)
      const gm = Math.sqrt(gx * gx + gy * gy)
      if (gm < 1e-4) continue

      const nx = gx / gm
      const ny = gy / gm
      const dot = Math.max(0, nx * lx + ny * ly)
      const spec = dot * dot * edge

      const v = Math.round(255 * spec)
      d[idx] = d[idx + 1] = d[idx + 2] = v
      d[idx + 3] = Math.round(220 * spec)
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

// ── SVG <filter> builder ──────────────────────────────────────────────────────

function buildSvgFilter(
  id: string,
  elW: number, elH: number,
  opts: LiquidGlassConfig
): string {
  const [mW, mH] = mapSize(elW, elH, opts.mapMaxEdge)

  const dispUrl = genDisplacementMap(mW, mH, elW, elH, opts.borderRadius, opts.bezelWidth)
  const specUrl = genSpecularMap(mW, mH, elW, elH, opts.borderRadius, opts.bezelWidth)

  // feDisplacementMap: offset = scale × (channelNorm − 0.5)
  // At full displacement channelNorm = 255/255 = 1 → offset = scale × 0.5
  // ⟹ scale = 2 × maxDisplacement
  const dispScale = 2 * opts.maxDisplacement

  // Blur padding so the Gaussian doesn't clip at element edges (3σ rule)
  const pad = Math.ceil(opts.frostBlur * 3)

  // Optional tint layer — flood-blend over the refracted+saturated backdrop
  // multiply mode tints like colored/stained glass rather than a flat opaque overlay
  const tintStep = opts.tintOpacity > 0
    ? `<feFlood flood-color="${opts.tintColor}" flood-opacity="${opts.tintOpacity}" result="tintFlood"/>
    <feBlend in="tintFlood" in2="sat" mode="multiply" result="tinted"/>`
    : ''
  const specIn = opts.tintOpacity > 0 ? 'tinted' : 'sat'

  return `<filter id="${id}"
      filterUnits="userSpaceOnUse"
      x="${-pad}" y="${-pad}"
      width="${elW + pad * 2}" height="${elH + pad * 2}"
      color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${opts.frostBlur}" result="frost"/>
    <feImage href="${dispUrl}"
             x="0" y="0" width="${elW}" height="${elH}"
             preserveAspectRatio="none" result="dmap"/>
    <feDisplacementMap in="frost" in2="dmap" scale="${dispScale}"
                       xChannelSelector="R" yChannelSelector="G" result="refracted"/>
    <feColorMatrix in="refracted" type="saturate" values="${opts.saturation}" result="sat"/>
    ${tintStep}
    <feImage href="${specUrl}"
             x="0" y="0" width="${elW}" height="${elH}"
             preserveAspectRatio="none" result="smap"/>
    <feComponentTransfer in="smap" result="specFade">
      <feFuncA type="linear" slope="${opts.specularOpacity}"/>
    </feComponentTransfer>
    <feBlend in="specFade" in2="${specIn}" mode="screen"/>
  </filter>`
}

// ── Feature detection ─────────────────────────────────────────────────────────

function supportsBackdropSvgFilter(): boolean {
  try {
    const el = document.createElement('div')
    el.style.cssText = 'backdrop-filter:url(#__test__)'
    return el.style.backdropFilter.includes('url')
  } catch {
    return false
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

// Incremented for every useLiquidGlass() call so each instance's SVG filter IDs
// are globally unique — backdrop-filter: url(#id) uses a document-wide ID lookup,
// so IDs must never collide across component instances.
let _instanceCounter = 0

function determineGlassMode(): 'svg' | 'css' {
  if (typeof window === 'undefined') return 'css'
  try {
    const userPref = localStorage.getItem('hkn-display-glass-mode')
    if (userPref === 'css') return 'css'
    if (userPref === 'svg') return 'svg'
  } catch {
    // noop
  }
  // Auto-detect mode: check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency ?? 2
  if (cores < 4) {
    console.info(`[LiquidGlass] Auto mode detected constrained hardware (${cores} cores) — using CSS Glass mode`)
    return 'css'
  }
  return 'svg'
}

export function useLiquidGlass(config: Partial<LiquidGlassConfig> = {}) {
  const opts: LiquidGlassConfig = { ...DEFAULTS, ...config }
  const _instanceId = _instanceCounter++

  let svgEl: SVGSVGElement | null = null
  let observer: ResizeObserver | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const cards: { el: HTMLElement, id: string }[] = []

  function rebuild(): void {
    if (!svgEl) return
    const defs = svgEl.querySelector('defs')
    if (!defs) return

    let markup = ''
    const pending: { el: HTMLElement, id: string }[] = []

    for (const c of cards) {
      const w = c.el.offsetWidth
      const h = c.el.offsetHeight
      if (w < 20 || h < 20) continue
      try {
        markup += buildSvgFilter(c.id, w, h, opts)
        pending.push(c)
      } catch (e) {
        console.warn('[LiquidGlass] filter build failed for', c.id, e)
      }
    }

    // Inject SVG defs first so IDs exist before CSS references them
    defs.innerHTML = markup

    for (const c of pending) {
      c.el.style.backdropFilter = `url(#${c.id})`
      const style = c.el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      style.webkitBackdropFilter = `url(#${c.id})`
    }
  }

  function scheduleRebuild(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(rebuild, 400)
  }

  /**
   * Initialise the effect.
   * @param target - An HTMLElement to apply the effect to, or a CSS selector
   *                 string to query all matching elements. Defaults to
   *                 '.rounded-glass-card' for backwards compatibility.
   */
  function init(target: HTMLElement | string = '.rounded-glass-card'): void {
    const mode = determineGlassMode()
    if (mode === 'css' || !supportsBackdropSvgFilter()) {
      console.info('[LiquidGlass] Using GPU-accelerated CSS Glass mode')
      const elements: HTMLElement[] = typeof target === 'string'
        ? Array.from(document.querySelectorAll<HTMLElement>(target))
        : [target]
      elements.forEach((el) => {
        el.style.backdropFilter = `blur(12px) saturate(1.3)`
        const style = el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
        style.webkitBackdropFilter = `blur(12px) saturate(1.3)`
      })
      return
    }

    try {
      svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svgEl.setAttribute('aria-hidden', 'true')
      Object.assign(svgEl.style, {
        position: 'absolute',
        width: '0',
        height: '0',
        overflow: 'hidden',
        pointerEvents: 'none'
      })
      svgEl.innerHTML = '<defs></defs>'
      document.body.appendChild(svgEl)

      const elements: HTMLElement[] = typeof target === 'string'
        ? Array.from(document.querySelectorAll<HTMLElement>(target))
        : [target]

      elements.forEach((el, i) => {
        cards.push({ el, id: `liquid-glass-${_instanceId}-${i}` })
      })

      if (!cards.length) {
        console.warn('[LiquidGlass] No elements matched:', target)
        return
      }

      rebuild()

      observer = new ResizeObserver(scheduleRebuild)
      cards.forEach(({ el }) => observer!.observe(el))
    } catch (e) {
      console.error('[LiquidGlass] init failed:', e)
    }
  }

  function destroy(): void {
    if (timer) clearTimeout(timer)
    observer?.disconnect()
    svgEl?.remove()

    for (const c of cards) {
      c.el.style.backdropFilter = ''
      const style = c.el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      style.webkitBackdropFilter = ''
    }

    cards.length = 0
    svgEl = null
    observer = null
  }

  return { init, destroy }
}
