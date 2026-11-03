import { env } from './env.ts'
import type { Frame } from '../shared/types.ts'
import { defaultExportScale } from '../shared/prowin/formats.ts'
import * as thumbs from './thumbs.ts'

/**
 * Everything behind GET /i/<frameId>.<ext> except HTTP: the in-process
 * image cache, the render rate limit, and the dispatch between the three
 * ways an image can be produced (persisted thumbnail, preview render,
 * full-size render). The route stays thin — params, auth callback,
 * headers — and this module stays testable without a server.
 *
 * Freshness model, one layer per lifetime:
 *  - imgCache: per-process, ~minutes. Holds the render *promise*, not the
 *    buffer, so concurrent requests for the same key share one render.
 *    May serve a just-revalidated thumb's previous bytes for up to
 *    IMG_CACHE_MS — accepted, previews only claim minutes-freshness.
 *  - thumbs (previews only): persisted across deploys, stale-while-
 *    revalidate. See thumbs.ts.
 *  - a full-size render is never persisted; it exists for og:image embeds
 *    and downloads, and is only ever cached here.
 */

const imgCache = new Map<string, { buf: Promise<Buffer>; updatedAt: number; at: number }>()
const IMG_CACHE_MS = 5 * 60_000
const IMG_CACHE_MAX = 200

/* Renders boot Chromium pages; cached serves and persisted-thumb serves are
   cheap and never metered. The budget is per IP because its purpose is
   anonymous hotlink abuse — authenticated users bypass it (verified by the
   caller, and only checked when the budget is actually exhausted). */
const renderHits = new Map<string, number[]>()
const RENDERS_PER_MIN = env.PREVIEW_RENDERS_PER_MIN

export interface ImageRequest {
  ext: 'png' | 'jpg'
  /** explicit density; omitted: downloads use the preset default, views 1 */
  scale?: 1 | 2
  /** download intent: resolves the preset default scale, never the persisted thumb */
  download?: boolean
  quality: number
  /** dashboard-card variant: small, clipped, jpeg, persisted. Only
   *  meaningful for jpg — a png?preview would serve jpeg bytes under an
   *  image/png content-type, so the flag is ignored there. */
  preview: boolean
  ip: string
  /** consulted only when the render budget is exhausted */
  isAuthenticated: () => Promise<boolean>
}

export type ImageResult = { status: 'ok'; buf: Buffer } | { status: 'rate-limited' }

/** May reject when the render itself fails — the caller owns the 500. */
export async function getImage(frame: Frame, req: ImageRequest): Promise<ImageResult> {
  /* explicit scale wins; otherwise downloads render at the preset default
     (free frames 2x) and plain views at 1x */
  const scale = req.scale ?? (req.download ? defaultExportScale(frame.preset) : 1)
  /* a download is the full-size render, never the persisted card thumb */
  const preview = req.preview && req.ext === 'jpg' && !req.download
  /* Strict settled-font exports are preset downloads only (explicit scale
     included); free-frame downloads keep the lenient bounded fallback. The
     strict intent joins the cache key so primed/lenient bytes at the same
     scale can never satisfy a strict download. */
  const strict = req.download === true && frame.preset !== undefined
  const key = imageKey(frame.id, req.ext, scale, req.ext === 'jpg' ? req.quality : '', preview, strict)
  const fresh = (): Promise<Buffer> | null => {
    const cached = imgCache.get(key)
    return cached && cached.updatedAt === frame.updatedAt && Date.now() - cached.at < IMG_CACHE_MS ? cached.buf : null
  }
  let pending = fresh()

  /* previews first try the persisted thumbnail: survives redeploys, serves
     instantly even when stale (thumbs revalidates in the background), and
     costs no Chromium boot — so it isn't metered either */
  if (!pending && preview) {
    const stored = await thumbs.getStored(frame)
    if (stored) {
      pending = Promise.resolve(stored)
      remember(key, pending, frame.updatedAt)
    } else {
      /* a render may have started while storage was awaited — share it */
      pending = fresh()
    }
  }

  if (!pending) {
    /* The charge must not yield: concurrent duplicates that miss the cache in
       the same tick share one budget slot and one render instead of each
       consuming a slot. Only an exhausted budget resolves authentication
       (async) — and then re-checks, because a render may have started while
       auth resolved. */
    if (chargeRenderBudget(req.ip)) {
      pending = fresh()
    } else if (await req.isAuthenticated()) {
      pending = fresh()
    } else {
      return { status: 'rate-limited' }
    }
    if (!pending) {
      pending = preview
        ? /* renders AND persists — the next cold start serves from storage */
          thumbs.create(frame)
        : loadScreenshot().then(({ renderFrame }) =>
            renderFrame(frame, scale, {
              type: req.ext === 'jpg' ? 'jpeg' : 'png',
              quality: req.quality,
              ...(strict ? { requireSettledFonts: true as const } : {}),
            }),
          )
      remember(key, pending, frame.updatedAt)
    }
  }

  return { status: 'ok', buf: await pending }
}

function imageKey(
  id: string,
  ext: 'png' | 'jpg',
  scale: number,
  quality: number | '',
  preview: boolean,
  strict: boolean,
): string {
  return `${id}:${ext}:${scale}:${quality}:${preview ? 'p' : ''}${strict ? 's' : ''}`
}

/** Seeds the cache with a render another path already paid for. The MCP
 *  screenshot tool renders through `renderFrame` directly, and the ChatGPT
 *  preview card loads `/i/<id>.png` right after it from a cookie-less sandbox
 *  iframe — anonymous, so metered. Priming turns that load into a free
 *  cached serve instead of a second render against the per-IP budget.
 *  Lenient 1x/2x captures only — never fractional export scales, and never
 *  strict: a primed render proves nothing about settled fonts. */
export function primeImage(frame: Frame, scale: 1 | 2, png: Buffer): void {
  remember(imageKey(frame.id, 'png', scale, '', false, false), Promise.resolve(png), frame.updatedAt)
}

function remember(key: string, pending: Promise<Buffer>, updatedAt: number) {
  imgCache.set(key, { buf: pending, updatedAt, at: Date.now() })
  /* a failed render must not be served for IMG_CACHE_MS — drop it so the
     next request retries */
  pending.catch(() => {
    if (imgCache.get(key)?.buf === pending) imgCache.delete(key)
  })
  if (imgCache.size > IMG_CACHE_MAX) {
    const oldest = [...imgCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) imgCache.delete(oldest[0])
  }
}

/* Synchronous: charging must not yield, so concurrent duplicates that miss the
   cache in the same tick share one budget slot and one render instead of each
   consuming a slot. Returns whether a slot was consumed; when the per-minute
   budget for this IP is exhausted the caller resolves authentication. */
function chargeRenderBudget(ip: string): boolean {
  const now = Date.now()
  const hits = (renderHits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= RENDERS_PER_MIN) return false
  hits.push(now)
  renderHits.set(ip, hits)
  return true
}

/* lazy so dev never pays for puppeteer-core until the first render;
   single-flight because concurrent import() of one module can serialize */
let screenshot: Promise<typeof import('./screenshot.ts')> | undefined
const loadScreenshot = () => (screenshot ??= import('./screenshot.ts'))
