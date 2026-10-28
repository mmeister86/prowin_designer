import './prowin/guard.ts'
import { canvasCapabilities, CreatorPermissionError, withUserPermissions } from './prowin/permissions.ts'
import { creatorRouter, permissionIdentity } from './prowin/accounts.ts'
import { env } from './env.ts'
import { canvasPages, samePages } from '../shared/pages.ts'
import { FIRST_CANVAS_PATH } from '../shared/firstCanvas.ts'
import { localAgentRouter, handleLocalAgentMcp } from './localAgent.ts'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { eq, inArray } from 'drizzle-orm'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import { oAuthDiscoveryMetadata } from 'better-auth/plugins'
import { WebSocketServer, WebSocket } from 'ws'
import { PageLimitError, store } from './store.ts'
import { getImage } from './previews.ts'
import * as actions from './actions.ts'
import { liveActivitiesRouter, logLiveActivityRequests, startLiveActivityDelivery } from './liveActivities.ts'
import { onCanvasEvent } from './events.ts'
import * as commentNotifications from './commentNotifications.ts'
import { notificationsRouter } from './notifications.ts'
import * as webhooks from './webhooks.ts'
import { webhooksRouter } from './webhookRoutes.ts'
import { canAccessCanvas, canManageCanvas, hasDurableCanvasAccess, isAdmin } from './access.ts'
import { auth, initAuth, syncAdmins, getUserName, loginProvidersConfig } from './auth.ts'
import { adminRouter } from './admin.ts'
import { communityRouter, parseListing, publishableFrames } from './community.ts'
import { automationsRouter, startScheduler } from './automations.ts'
import { integrationsRouter } from './integrations.ts'
import { extensions } from './extensions.ts'
import * as workspaces from './workspaces.ts'
import * as billing from './billing.ts'
import * as demo from './demo.ts'
import { db, initDb } from './db/index.ts'
import * as authSchema from './db/auth-schema.ts'
import * as persist from './db/persist.ts'
import { handleMcpRequest } from './mcp.ts'
import {
  getAsset,
  reconcileAssetRefs,
  beginTicketUpload,
  endTicketUpload,
  createAsset,
  MAX_ASSET_BYTES,
  AssetInputError,
} from './assets.ts'
import * as agentKeys from './agentKeys.ts'
import * as backgrounds from './backgrounds.ts'
import * as storage from './storage.ts'
import { seed } from './seed.ts'
import * as allowance from './allowance.ts'
import { serverTierInfo } from './agentModel.ts'
import { imageModelAvailability, serverImageGenEnabled } from './imageGen.ts'
import { setImagePref } from './imagePrefs.ts'
import { mentionedRole } from '../shared/agents.ts'
import { activeAgentTasks } from '../shared/agentActivity.ts'
import { colorFor } from '../shared/types.ts'
import { isPeerViewport } from '../shared/viewport.ts'
import type { ClientMessage, Presence, ServerMessage } from '../shared/types.ts'

const PORT = env.PORT

/* Identifies the client bundle this process serves. Hashing dist/index.html
   works because Vite writes hashed asset names into it — any frontend change
   changes the hash, while server-only deploys and plain restarts do not.
   Clients compare it across reconnects to know their loaded bundle is stale. */
const BUILD_ID = (() => {
  try {
    return createHash('sha1')
      .update(readFileSync(path.join(process.cwd(), 'dist', 'index.html')))
      .digest('hex')
      .slice(0, 12)
  } catch {
    return 'dev'
  }
})()

/* boot: connect the DB, hydrate memory, import pre-DB store.json once */
await initDb()
await backgrounds.initBackgrounds()
initAuth()
await syncAdmins() // ADMIN_EMAILS -> user.role, for accounts that already exist
let data = await persist.hydrate()
if (data.canvases.length === 0 && (await persist.importLegacyJson())) {
  data = await persist.hydrate()
}
store.init(data.canvases)
await workspaces.hydrateWorkspaces() // before the first request: canAccessCanvas reads membership
await webhooks.hydrateWebhooks()
billing.reportBillingConfig()
actions.hydrateLogs(data)
seed()

/* Never-attempted queued cards get their first pickup after boot. Hydration
   marks interrupted claimed cards as failed, so they are excluded until a
   human explicitly retries them. */
{
  const pending = [...data.tasks.entries()]
    .filter(([, list]) => list.some((t) => t.queuedBy && !t.agentName && !t.endedAt))
    .map(([canvasId]) => canvasId)
  pending.forEach((canvasId, i) => {
    setTimeout(
      () => {
        import('./resident.ts').then((r) => r.onFeedback(canvasId)).catch(() => {})
      },
      5_000 + i * 30_000,
    )
  })
  if (pending.length) console.log(`[resident] ${pending.length} canvas(es) with new queued cards — starting after boot`)
}

/* asset bookkeeping (no deletion): every upload records its canvas, and
   asset_refs tracks which frames reference which assets — kept in sync on
   every durable frame write, rebuilt here from the frames hydrate just
   loaded. Nothing is ever deleted; asset_refs is the ledger any future
   cleanup would be built on. */
{
  const frames = data.canvases.flatMap((c) => c.frames)
  reconcileAssetRefs(frames)
    .then((n) => n && console.log(`[assets] reconciled ${n} asset ref(s)`))
    .catch((e) => console.error('[assets] reconcile failed', e))
}

/* One stray rejection must never take down the multiplayer server: Node's
   default is to exit, which turned a single aborted analytics upload into
   sitewide 502s (2026-08-20). Log loudly instead — a real bug shows up here
   as a stack trace, not an outage. */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandled-rejection]', reason)
})

/* flush debounced frame writes before the process dies — with a hard-exit
   timeout so a wedged DB can never keep the process (and the port) alive */
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    setTimeout(() => process.exit(0), 1500).unref()
    persist
      .flush((id) => store.getFrame(id))
      .catch((err) => console.error('flush on shutdown failed', err))
      .finally(() => process.exit(0))
  })
}

/* ------------------------------------------------- realtime rooms */

interface Conn {
  ws: WebSocket
  canvasId: string
  presence: Presence
  /** an admin viewing as someone else: receives updates, emits nothing.
   *  Showing their borrowed identity as a live cursor would tell the room
   *  the owner is here when they aren't. */
  silent?: boolean
}

const conns = new Map<WebSocket, Conn>()

function room(canvasId: string): Conn[] {
  return [...conns.values()].filter((c) => c.canvasId === canvasId)
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function broadcast(canvasId: string, msg: ServerMessage, excludeClientId?: string) {
  for (const c of room(canvasId)) {
    if (excludeClientId && c.presence.clientId === excludeClientId) continue
    send(c.ws, msg)
  }
}

/* Agents show up in presence while they are actively calling tools. */
interface AgentPresence extends Presence {
  lastSeen: number
}
const agentPresences = new Map<string, Map<string, AgentPresence>>() // canvasId -> name -> presence

function agentTouch(
  canvasId: string,
  agentName: string,
  frameId?: string | null,
  status?: string | null,
  owner?: string,
) {
  let byName = agentPresences.get(canvasId)
  if (!byName) agentPresences.set(canvasId, (byName = new Map()))
  let p = byName.get(agentName)
  const isNew = !p
  if (!p) {
    p = {
      clientId: `agent:${agentName}`,
      name: agentName,
      color: colorFor(agentName),
      kind: 'agent',
      owner,
      lastSeen: Date.now(),
      activeFrameId: frameId ?? null,
    }
    byName.set(agentName, p)
  }
  p.lastSeen = Date.now()
  if (owner && !p.owner) p.owner = owner
  if (frameId !== undefined) p.activeFrameId = frameId
  let statusChanged = false
  if (status !== undefined) {
    const next = status?.trim() || undefined
    if (p.status !== next) {
      p.status = next
      statusChanged = true
    }
  }
  if (isNew) {
    broadcast(canvasId, { type: 'presence:join', presence: p })
  } else {
    if (frameId !== undefined) {
      broadcast(canvasId, { type: 'editing', clientId: p.clientId, frameId: p.activeFrameId ?? null })
    }
    if (statusChanged) {
      broadcast(canvasId, { type: 'status', clientId: p.clientId, status: p.status ?? null })
    }
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [canvasId, byName] of agentPresences) {
    for (const [name, p] of byName) {
      /* an agent with a posted status is likely thinking between tool calls —
         keep it (and its status) on screen longer before expiring */
      if (now - p.lastSeen > (p.status ? 60_000 : 20_000)) {
        byName.delete(name)
        broadcast(canvasId, { type: 'presence:leave', clientId: p.clientId })
        actions.endAgentTasks(canvasId, p.name) // an agent that went silent is no longer "working on" anything
      }
    }
  }
}, 5000)

actions.wire(broadcast, agentTouch)
/* after the room has been told: email for the people who were not in it */
onCanvasEvent(commentNotifications.onCanvasEvent)
onCanvasEvent(webhooks.onCanvasEvent)

/* ------------------------------------------------- http api */

const app = express()

/* Railway/Fly terminate TLS in front of us; trust the proxy so req.protocol
   and secure cookies see https, and OAuth metadata echoes the right origin */
app.set('trust proxy', 1)

app.get('/healthz', (_req, res) => res.json({ ok: true }))

/* ------------------------------------------------------------------ */
/* Public frame images: /i/<frameId>.png|jpg — shareable/hotlinkable   */
/* (og:image etc). Unauthenticated by the same unguessable-id logic as */
/* canvas share links; renders the CURRENT frame, so embedded images   */
/* stay up to date as the design iterates. Caching, rate limiting and  */
/* render dispatch live in previews.ts — this route is HTTP only.      */
/* ------------------------------------------------------------------ */

app.get('/i/:id.:ext', async (req, res) => {
  const { id, ext } = req.params as { id: string; ext: string }
  if (ext !== 'png' && ext !== 'jpg') return res.status(404).end()
  const frame = store.getFrame(id)
  if (!frame) return res.status(404).end()

  let result: Awaited<ReturnType<typeof getImage>>
  try {
    result = await getImage(frame, {
      ext,
      scale: req.query.scale === '2' ? 2 : 1,
      quality: Math.min(100, Math.max(1, Number(req.query.quality) || 90)),
      /* ?preview — the dashboard-card variant; see previews.ts */
      preview: req.query.preview !== undefined,
      ip: req.ip ?? 'unknown',
      /* the render limit targets anonymous hotlink abuse — a logged-in user
         loading a dashboard of many canvases shouldn't hit it (and behind
         the Railway proxy many users can share one req.ip). Only called
         when the budget is exhausted, so cached serves stay auth-free. */
      isAuthenticated: async () =>
        !!(await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)),
    })
  } catch {
    return res.status(500).json({ error: 'Die Vorschau konnte nicht erstellt werden.' })
  }
  if (result.status === 'rate-limited') {
    res.set('Retry-After', '60')
    return res
      .status(429)
      .json({ error: 'Zu viele Vorschauanfragen. Bereits zwischengespeicherte URLs bleiben verfügbar.' })
  }
  const { buf } = result

  res.set('Content-Type', ext === 'jpg' ? 'image/jpeg' : 'image/png')
  res.set('Cache-Control', 'public, max-age=60')
  if (req.query.download !== undefined) {
    const safe = frame.name.replace(/[^\w\- ]+/g, '').trim() || 'frame'
    res.set('Content-Disposition', `attachment; filename="${safe}.${ext}"`)
  }
  res.send(buf)
})

/* ------------------------------------------------------------------ */
/* Uploaded assets: /a/<assetId>.<ext> — written once by the upload_asset */
/* MCP tool, immutable thereafter, so far-future caching is safe. Public  */
/* by the same unguessable-id logic as /i/ (frame HTML embedding these    */
/* URLs renders for anyone who can see the canvas).                       */
/* ------------------------------------------------------------------ */

app.get('/a/:id.:ext', async (req, res) => {
  const { id, ext } = req.params as { id: string; ext: string }
  try {
    const found = await getAsset(id)
    if (!found || found.meta.ext !== ext) return res.status(404).end()
    res.set('Content-Type', found.meta.mime)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.set('X-Content-Type-Options', 'nosniff')
    /* svg can script when opened as a document — neuter it; <img> embeds
       are unaffected */
    if (found.meta.mime === 'image/svg+xml')
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
    if (req.query.download !== undefined) res.set('Content-Disposition', `attachment; filename="${id}.${ext}"`)
    res.send(found.buf)
  } catch {
    res.status(500).json({ error: 'Die Datei konnte nicht geladen werden.' })
  }
})

/* Curated background library (server/backgrounds.ts): /bg/<id>.webp and  */
/* /bg/<id>-t.webp straight from object storage. Public and immutable —  */
/* the catalog is checked in, the bytes are put there by the import      */
/* script and never rewritten under the same id.                         */
app.get('/bg/:file', async (req, res) => {
  const key = backgrounds.keyForFile(req.params.file)
  if (!key) return res.status(404).end()
  try {
    const buf = await storage.getObject(key)
    if (!buf) return res.status(404).end()
    res.set('Content-Type', 'image/webp')
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.set('X-Content-Type-Options', 'nosniff')
    res.send(buf)
  } catch {
    res.status(500).json({ error: 'Der Hintergrund konnte nicht geladen werden.' })
  }
})

/* ------------------------------------------------------------------ */
/* One-time asset uploads: the upload_asset MCP tool mints a ticket and */
/* the agent curls the file here (curl -T file /u/<token>), so bytes    */
/* go disk -> doop without ever passing through the model. Mounted      */
/* before express.json — the body IS the file. The token is the         */
/* capability: unguessable, single-use, 15-minute TTL.                  */
/* ------------------------------------------------------------------ */

app.put('/u/:token', async (req, res) => {
  const { token } = req.params
  const ticket = beginTicketUpload(token)
  if (!ticket)
    return res.status(410).json({
      error:
        'Die Upload-Freigabe ist ungültig, abgelaufen oder bereits verwendet. Fordere über upload_asset eine neue an.',
    })
  let success = false
  try {
    /* on any early rejection, destroy the request stream — otherwise curl
       keeps sending a body nobody reads and the connection deadlocks */
    if (Number(req.headers['content-length'] || 0) > MAX_ASSET_BYTES) {
      res.status(413).json({ error: 'Die Datei überschreitet die Grenze von 5 MB.' })
      req.destroy()
      return
    }
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of req) {
      total += (chunk as Buffer).length
      if (total > MAX_ASSET_BYTES) {
        res.status(413).json({ error: 'Die Datei überschreitet die Grenze von 5 MB.' })
        req.destroy()
        return
      }
      chunks.push(chunk as Buffer)
    }
    const asset = await createAsset(Buffer.concat(chunks), {
      canvasId: ticket.canvasId,
      ownerId: ticket.ownerId,
      uploadedBy: ticket.uploadedBy,
    })
    success = true
    const url = `${env.BETTER_AUTH_URL}/a/${asset.id}.${asset.ext}`
    res.json({
      ok: true,
      url,
      mime: asset.mime,
      size_bytes: asset.size,
      usage: `<img src="${url}" alt="">`,
      note: 'Permanent public URL — reference it in frame HTML.',
    })
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof AssetInputError ? e.message : 'Die Datei konnte nicht hochgeladen werden.' })
  } finally {
    endTicketUpload(token, success)
  }
})

/* better-auth handles /api/auth/* — mounted before express.json (it reads
   the raw body itself) and before the session gate below. Being mounted
   earlier means it also escapes the read-only rule on /api, so an admin
   who is viewing as someone else is filtered here instead:
     - the MCP OAuth flow authorises off the browser session, so it would
       mint a long-lived agent token belonging to the person being viewed,
       outliving the 15-minute view-as session entirely;
     - every other write (update-user, change-email, revoke-sessions, …)
       would edit the account of the person being viewed while the banner
       says "read only".
   An allowlist, not a blocklist: whatever endpoints a future better-auth
   plugin adds are refused by default rather than discovered later. */
const MCP_OAUTH_PATHS = /^\/api\/auth\/(mcp\/|oauth2\/(authorize|consent|token))/
const VIEW_AS_ALLOWED = /^\/api\/auth\/(sign-out|admin\/stop-impersonating)$/
app.all('/api/auth/*', async (req, res, next) => {
  const restricted = MCP_OAUTH_PATHS.test(req.path) || (req.method !== 'GET' && !VIEW_AS_ALLOWED.test(req.path))
  if (restricted) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)
    if (session && (session.session as { impersonatedBy?: string | null }).impersonatedBy) {
      return res.status(403).json({ error: 'Du siehst das Konto einer anderen Person und kannst nur lesen.' })
    }
  }
  toNodeHandler(auth)(req, res).catch(next)
})

/* Stripe webhooks: the signature covers the exact bytes, so this route takes
   the raw body and sits ahead of the JSON parser; no session — Stripe is the
   caller. Everything it does is in server/workspaces.ts. */
app.post('/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  workspaces.handleStripeWebhook(req, res).catch((err) => {
    console.error('[billing] webhook crashed', err)
    if (!res.headersSent) res.status(500).json({ error: 'Der Webhook konnte nicht verarbeitet werden.' })
  })
})

for (const extension of extensions) {
  if (extension.webhookRouter) app.use(`/webhooks/${extension.id}`, extension.webhookRouter())
}

app.use(express.json({ limit: '10mb' }))
app.all('/local-agent/mcp/:id', (req, res, next) => {
  handleLocalAgentMcp(req, res).catch(next)
})

/* Where a brand-new account lands: the canvas signup created for it
   (server/auth.ts databaseHooks), where the demo agent is waiting to
   perform. better-auth sends new Google / Apple users here as
   their newUserCallbackURL and the email form comes here too, so every
   signup path shares one landing. Signed out, or without a canvas of their
   own any more, the dashboard will do. Ahead of the /api session guard:
   a browser arrives here, so a missing session is a redirect, not a 401. */
app.get(FIRST_CANVAS_PATH, async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)
  const canvas = session && store.firstCanvasOf(session.user.id)
  res.redirect(canvas ? `/c/${canvas.id}` : '/')
})

/* Public: does an account exist for this email? Drives the login page's
   "no account found — sign up instead" prompt. Existence is already
   observable through signup's "user already exists" error, so this
   endpoint reveals nothing new. */
app.post('/api/account-exists', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!email) return res.status(400).json({ error: 'Bitte gib eine E-Mail-Adresse ein.' })
  const [row] = await db
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(eq(authSchema.user.email, email))
  res.json({ exists: !!row })
})

/* Public: which social login providers are configured? Static
   build shared across self-hosted deploys can't know this at build time —
   see server/auth.ts loginProvidersConfig for what's safe to expose here. */
app.get('/api/login-providers', (req, res) => {
  res.json(loginProvidersConfig())
})

/* ------------------------------------------------------------------ */
/* everything else under /api requires a logged-in user; the session's user
   is authoritative for names — clients don't get to pick who they are */
interface SessionUser {
  id: string
  name: string
  email: string
  role?: string | null
}
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
      /** admin's user id when this session is a "view as" — see /api/admin */
      impersonatedBy?: string
    }
  }
}
app.use('/api/live-activities', logLiveActivityRequests)
app.use('/api', async (req, res, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) return res.status(401).json({ error: 'Bitte melde Dich an.' })
    req.user = session.user
    req.impersonatedBy = (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? undefined
    /* Viewing as someone else is read-only, full stop. Every doop mutation is
       a non-GET REST call — the websocket after `join` carries only cursor,
       editing and frame:drag — so this single rule covers the whole surface.
       better-auth's own routes are mounted earlier (/api/auth/*), so signing
       out and stop-impersonating are unaffected. */
    if (req.impersonatedBy && req.method !== 'GET') {
      return res.status(403).json({ error: 'Du siehst das Konto einer anderen Person und kannst nur lesen.' })
    }
    next()
  } catch (err) {
    next(err)
  }
})

app.use('/api', (req, _res, next) => {
  void withUserPermissions(req.impersonatedBy ? undefined : req.user!.id, next).catch(next)
})

app.use('/api/prowin', creatorRouter)

app.get('/api/me', async (req, res) => {
  const { id, name, email } = req.user!
  const capabilities = await permissionIdentity(id)
  res.json({
    id,
    name,
    email,
    admin: isAdmin(req.user),
    creator: capabilities.creator,
    canCreateWorkspace: capabilities.creator,
    /* 'team' while a member of a live paid workspace — the account menu's plan line */
    plan: workspaces.planFor(id),
    /* the SPA cannot infer this: impersonation swaps the session cookie
       outright, so everything else on this response describes the person
       being viewed, not the admin doing the viewing */
    impersonating: req.impersonatedBy ? { byName: (await getUserName(req.impersonatedBy)) ?? 'an admin' } : undefined,
  })
})

/* Resolve the application from the consent code itself, never a client name or
   id supplied by the page. Only the account authorizing the code may use it. */
async function mcpConsent(code: string, userId: string) {
  const [request] = await db.select().from(authSchema.verification).where(eq(authSchema.verification.identifier, code))
  if (!request || request.expiresAt <= new Date()) return null
  let value: { userId?: string; clientId?: string; requireConsent?: boolean } | null
  try {
    value = JSON.parse(request.value)
  } catch {
    return null
  }
  if (!value || value.userId !== userId || value.requireConsent !== true || typeof value.clientId !== 'string')
    return null
  const [client] = await db
    .select()
    .from(authSchema.oauthApplication)
    .where(eq(authSchema.oauthApplication.clientId, value.clientId))
  return client && !client.disabled ? { name: client.name } : null
}

app.get('/api/mcp-consent/:code', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const client = await mcpConsent(req.params.code!, req.user!.id)
    if (!client)
      return res
        .status(404)
        .json({ error: 'Diese Verbindungsanfrage ist abgelaufen. Starte sie erneut über Deinen Agenten.' })
    res.json(client)
  } catch (error) {
    next(error)
  }
})

app.post('/api/mcp-consent/:code', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    if (typeof req.body?.accept !== 'boolean')
      return res.status(400).json({ error: 'Wähle aus, ob Du die Verbindung erlauben möchtest.' })
    if (!(await mcpConsent(req.params.code!, req.user!.id)))
      return res
        .status(404)
        .json({ error: 'Diese Verbindungsanfrage ist abgelaufen. Starte sie erneut über Deinen Agenten.' })
    const result = await auth.api.oAuthConsent({
      headers: fromNodeHeaders(req.headers),
      body: { accept: req.body.accept, consent_code: req.params.code! },
    })
    res.json(result)
  } catch (error) {
    next(error)
  }
})

/* Canvas access on the REST surface: resolve the canvas (or the frame's
   canvas) and run it through canAccessCanvas before touching anything.
   Both helpers write the error response themselves and return null. */
function requireCanvas(req: express.Request, res: express.Response, canvasId: string) {
  const c = store.getCanvas(canvasId)
  if (!c) {
    res.status(404).json({ error: 'Nicht gefunden' })
    return null
  }
  if (!canAccessCanvas(req.user!.id, c)) {
    res.status(403).json({ error: 'Diese Arbeitsfläche ist privat. Bitte den Eigentümer um Zugriff.' })
    return null
  }
  return c
}

function requireFrame(req: express.Request, res: express.Response, frameId: string, expectedUpdatedAt?: unknown) {
  const frame = store.getFrame(frameId)
  if (!frame) {
    res.status(404).json({ error: 'Zeichenfläche nicht gefunden' })
    return null
  }
  const c = store.getCanvas(frame.canvasId)
  if (!c || !canAccessCanvas(req.user!.id, c)) {
    res.status(403).json({ error: 'Diese Arbeitsfläche ist privat. Bitte den Eigentümer um Zugriff.' })
    return null
  }
  if (expectedUpdatedAt !== undefined) {
    if (typeof expectedUpdatedAt !== 'number' || !Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 0) {
      res.status(400).json({ error: 'expectedUpdatedAt muss eine nicht negative ganze Zahl sein.' })
      return null
    }
    // PATCH and DELETE mutate the store synchronously after this check.
    if (frame.updatedAt !== expectedUpdatedAt) {
      res
        .status(409)
        .json({ error: 'Die Zeichenfläche wurde während Deiner Bearbeitung geändert. Versuche es erneut.', frame })
      return null
    }
  }
  return frame
}

app.use('/api/local-agent', localAgentRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/admin', adminRouter)
app.use('/api/community', communityRouter)
app.use('/api/automations', automationsRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/workspaces', workspaces.workspacesRouter)
app.use('/api/live-activities', liveActivitiesRouter)
startLiveActivityDelivery()
app.use('/api/billing', billing.billingRouter)

/* free-tier meter for the resident team: {used, limit, connected, localAgent} */
app.get('/api/agent-allowance', (req, res) => {
  allowance
    .getAllowance(req.user!.id)
    .then((a) => res.json(a))
    .catch(() => res.status(500).json({ error: 'Das Aufgabenkontingent ist derzeit nicht verfügbar.' }))
})

/* Retired account API: never accept credentials or fall through to the SPA. */
app.use('/api/model-account', (_req, res) => {
  res.status(410).json({ error: 'Private Modellkonten wurden entfernt.' })
})

/* ---- which image model generate_image draws with (the shared registry;
   entries the payer cannot run are shown but disabled) */

app.get('/api/image-model', (req, res) => {
  imageModelAvailability(req.user!.id)
    .then((models) => res.json({ models }))
    .catch(() => res.status(500).json({ error: 'Bildmodelle sind derzeit nicht verfügbar.' }))
})

app.put('/api/image-model', async (req, res) => {
  try {
    const model = String(req.body?.model ?? '')
    const models = await imageModelAvailability(req.user!.id)
    const entry = models.find((m) => m.id === model)
    if (!entry) return res.status(400).json({ error: 'Unbekanntes Bildmodell' })
    if (!entry.available)
      return res.status(400).json({ error: 'Dieses Bildmodell ist für Dein Konto oder diesen Server nicht verfügbar.' })
    await setImagePref(req.user!.id, model)
    res.json({ models: await imageModelAvailability(req.user!.id) })
  } catch {
    res.status(400).json({ error: 'Das Bildmodell konnte nicht geändert werden.' })
  }
})

/* ---- Agent keys: account-scoped bearer credentials for /mcp, the headless
   agent path (see server/agentKeys.ts). The secret appears exactly once, in
   the create response; the list carries only each key's start. The /api
   session gate above means impersonating admins can look but not mint. */

app.get('/api/agent-keys', async (req, res) => {
  res.json(await agentKeys.listAgentKeys(req.user!.id))
})

app.post('/api/agent-keys', async (req, res) => {
  const key = await agentKeys.createAgentKey(req.user!.id, String(req.body?.name ?? ''))
  if (!key)
    return res.status(400).json({
      error: 'Die maximale Anzahl an Agentenschlüsseln ist erreicht. Widerrufe einen nicht mehr benötigten Schlüssel.',
    })
  res.json(key)
})

app.delete('/api/agent-keys/:id', async (req, res) => {
  if (!(await agentKeys.deleteAgentKey(req.user!.id, req.params.id)))
    return res.status(404).json({ error: 'Agentenschlüssel nicht gefunden' })
  res.json({ ok: true })
})

app.get('/api/canvases', async (req, res) => {
  const list = workspaces.canvasesFor(req.user!.id)
  /* the people on each canvas (owner first, then invited members) resolve
     to names in one query — the home tiles wear them as an avatar stack */
  const peopleIds = new Set<string>()
  for (const c of list) for (const id of canvasPeopleIds(c.id)) peopleIds.add(id)
  const names = new Map<string, string>()
  if (peopleIds.size) {
    const rows = await db
      .select({ id: authSchema.user.id, name: authSchema.user.name })
      .from(authSchema.user)
      .where(inArray(authSchema.user.id, [...peopleIds]))
    for (const r of rows) names.set(r.id, r.name)
  }
  res.json(
    list.map((c) => {
      /* which agents have worked on this canvas (most recent first), with
         the user whose token they connected under and when they last worked */
      const seen = new Map<string, { owner?: string; lastAt: number }>()
      for (const t of actions.getTasks(c.id)) {
        if (!t.agentName) continue // unclaimed board cards have no agent yet
        if (!seen.has(t.agentName)) seen.set(t.agentName, { owner: t.owner, lastAt: t.startedAt })
      }
      return {
        ...c,
        people: canvasPeopleIds(c.id).map((id) => ({ id, name: names.get(id) ?? 'Unbekannt' })),
        agents: [...seen].slice(0, 8).map(([name, v]) => ({ name, owner: v.owner, lastAt: v.lastAt })),
        activeTasks: activeAgentTasks(actions.getTasks(c.id)),
      }
    }),
  )
})

/** owner first, then invited members, each once */
function canvasPeopleIds(canvasId: string): string[] {
  const c = store.getCanvas(canvasId)
  if (!c) return []
  return [...new Set([...(c.ownerId ? [c.ownerId] : []), ...(c.memberIds ?? [])])]
}

/* A workspace canvas needs membership and a workspace that may still grow —
   the 402 is what every client turns into the upgrade modal. */
function requireGrowableWorkspace(req: express.Request, res: express.Response, workspaceId: string) {
  const ws = workspaces.getWorkspace(workspaceId)
  if (!ws || !workspaces.isWorkspaceMember(ws.id, req.user!.id)) {
    res.status(404).json({ error: 'Arbeitsbereich nicht gefunden' })
    return null
  }
  if (!workspaces.isActive(ws)) {
    workspaces.planRequired(res, ws)
    return null
  }
  return ws
}

app.post('/api/canvases', (req, res) => {
  const name = String(req.body?.name || 'Unbenannte Arbeitsfläche')
  const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : undefined
  if (workspaceId && !requireGrowableWorkspace(req, res, workspaceId)) return
  res.json(store.createCanvas(name, req.user!.id, workspaceId))
})

app.post('/api/canvases/:id/duplicate', async (req, res) => {
  const source = store.getCanvas(req.params.id)
  if (!source) return res.status(404).json({ error: 'Nicht gefunden' })
  if (!hasDurableCanvasAccess(req.user!.id, source)) return res.status(403).json({ error: 'Zugriff verweigert' })
  /* a copy stays in the workspace when the copier is a member of it and the
     workspace may still take canvases; otherwise it lands in their personal space */
  const sourceWs = source.workspaceId ? workspaces.getWorkspace(source.workspaceId) : undefined
  const workspaceId =
    sourceWs && workspaces.isWorkspaceMember(sourceWs.id, req.user!.id) && workspaces.isActive(sourceWs)
      ? sourceWs.id
      : undefined
  try {
    const copy = await store.duplicateCanvas(source.id, req.user!.id, req.user!.name, { workspaceId })
    res.json(copy)
  } catch (error) {
    console.error('[canvas] duplicate failed', error)
    res.status(500).json({ error: 'Die Arbeitsfläche konnte nicht dupliziert werden.' })
  }
})

app.get('/api/canvases/:id/capabilities', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (c) res.json(canvasCapabilities(c))
})

app.get('/api/canvases/:id', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (c) res.json(c)
})

/* Community gallery listing — the owner's call alone, like link access.
   PUT both lists and re-describes; DELETE takes it down. */
app.put('/api/canvases/:id/publish', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  if (!canvasCapabilities(c).publish)
    return res
      .status(403)
      .json({ error: 'Nur ein Eigentümer mit Creator-Rolle kann eine Arbeitsfläche veröffentlichen.' })
  if (!publishableFrames(c).length)
    return res.status(400).json({ error: 'Füge vor dem Veröffentlichen eine Zeichenfläche hinzu.' })
  const listing = parseListing(req.body)
  if (typeof listing === 'string') return res.status(400).json({ error: listing })
  const published = store.publishCanvas(c.id, listing)!
  res.json({ publishedAt: published.publishedAt, description: published.description, category: published.category })
})

app.delete('/api/canvases/:id/publish', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  if (!canvasCapabilities(c).publish)
    return res
      .status(403)
      .json({ error: 'Nur ein Eigentümer mit Creator-Rolle kann die Veröffentlichung zurücknehmen.' })
  store.unpublishCanvas(c.id)
  res.json({ ok: true })
})

/* Move a canvas into a workspace (its owner, who must be a member, while it
   may grow) or back out to its owner's personal space (the owner, or a
   workspace admin). Moving is an access change, not an edit: every member
   of the target workspace can open it from now on. */
app.put('/api/canvases/:id/workspace', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  const target = req.body?.workspaceId
  if (target !== null && typeof target !== 'string')
    return res.status(400).json({ error: 'workspaceId muss die ID eines Arbeitsbereichs oder null sein.' })
  if (!canManageCanvas(req.user!.id, c))
    return res.status(403).json({
      error: 'Nur der Eigentümer der Arbeitsfläche oder die Administration des Arbeitsbereichs kann sie verschieben.',
    })
  if (target !== null) {
    if (target === c.workspaceId) return res.json({ ok: true })
    /* an admin's say over a workspace canvas ends at moving it out: re-homing
       it into another workspace — one the owner may not even belong to — is
       the owner's call alone */
    if (c.ownerId !== req.user!.id)
      return res
        .status(403)
        .json({ error: 'Nur der Eigentümer kann die Arbeitsfläche in einen Arbeitsbereich verschieben.' })
    if (!requireGrowableWorkspace(req, res, target)) return
  }
  store.setWorkspace(c.id, target ?? undefined)
  res.json({ ok: true })
})

app.post('/api/canvases/:id/claim', (req, res) => {
  const c = store.claimCanvas(req.params.id, req.user!.id)
  if (!c) return res.status(409).json({ error: 'Nicht gefunden oder bereits einem Eigentümer zugeordnet' })
  res.json({ ok: true })
})

/* recent activity across all of the user's canvases, for the home dashboard */
app.get('/api/home/activity', (req, res) => {
  const canvases = workspaces.canvasesFor(req.user!.id)
  const items = canvases.flatMap((c) =>
    actions
      .getActivity(c.id)
      .slice(0, 20)
      .map((a) => ({ ...a, canvasId: c.id, canvasName: c.name })),
  )
  items.sort((a, b) => b.at - a.at)
  res.json(items.slice(0, 14))
})

app.delete('/api/canvases/:id', (req, res) => {
  const c = store.getCanvas(req.params.id)
  if (!c) return res.status(404).json({ error: 'Nicht gefunden' })
  /* only the owner (or an admin of its workspace) may delete; unclaimed
     (legacy) canvases are reachable only by direct link and must be claimed
     before they can be destroyed */
  if (!c.ownerId) return res.status(403).json({ error: 'Übernimm zuerst die Arbeitsfläche.' })
  if (!canManageCanvas(req.user!.id, c)) return res.status(403).json({ error: 'Diese Arbeitsfläche gehört Dir nicht.' })
  actions.deleteCanvas(c.id)
  res.json({ ok: true })
})

app.patch('/api/canvases/:id', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  const { name, linkAccess } = req.body ?? {}
  /* the link policy is the owner's alone — collaborators can rename, not lock */
  if (linkAccess !== undefined) {
    if (c.ownerId !== req.user!.id)
      return res.status(403).json({ error: 'Nur der Eigentümer kann den Linkzugriff ändern.' })
    if (linkAccess !== 'edit' && linkAccess !== 'none')
      return res.status(400).json({ error: 'linkAccess muss "edit" oder "none" sein.' })
    store.setLinkAccess(c.id, linkAccess)
  }
  if (typeof name === 'string' && name.trim()) {
    const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
    actions.renameCanvas(c.id, name.trim(), actor)
  }
  res.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* Collaborators: Figma-style invites. The owner invites existing doop */
/* accounts by email; members get full edit access regardless of the   */
/* link setting. Management is owner-only (members may remove          */
/* themselves); the people list is visible to anyone with access.      */
/* ------------------------------------------------------------------ */

app.get('/api/canvases/:id/members', async (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  const ids = [...(c.ownerId ? [c.ownerId] : []), ...(c.memberIds ?? [])]
  const rows = ids.length
    ? await db
        .select({ id: authSchema.user.id, name: authSchema.user.name, email: authSchema.user.email })
        .from(authSchema.user)
        .where(inArray(authSchema.user.id, ids))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  res.json(
    ids.map((id) => ({
      userId: id,
      name: byId.get(id)?.name ?? 'Unbekannt',
      email: byId.get(id)?.email ?? '',
      owner: id === c.ownerId,
    })),
  )
})

app.post('/api/canvases/:id/members', async (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  if (c.ownerId !== req.user!.id) return res.status(403).json({ error: 'Nur der Eigentümer kann Personen einladen.' })
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!email) return res.status(400).json({ error: 'Bitte gib eine E-Mail-Adresse ein.' })
  const [row] = await db
    .select({ id: authSchema.user.id, name: authSchema.user.name, email: authSchema.user.email })
    .from(authSchema.user)
    .where(eq(authSchema.user.email, email))
  if (!row)
    return res.status(404).json({
      error: 'Für diese E-Mail-Adresse gibt es kein doop-Konto. Bitte die Person, sich zuerst zu registrieren.',
    })
  if (row.id === c.ownerId) return res.status(400).json({ error: 'Der Eigentümer hat bereits Zugriff.' })
  store.addMember(c.id, row.id, req.user!.id)
  res.json({ userId: row.id, name: row.name, email: row.email, owner: false })
})

app.delete('/api/canvases/:id/members/:userId', (req, res) => {
  const c = requireCanvas(req, res, req.params.id)
  if (!c) return
  if (c.ownerId !== req.user!.id && req.params.userId !== req.user!.id)
    return res.status(403).json({ error: 'Nur der Eigentümer kann Mitarbeitende entfernen.' })
  if (!store.removeMember(c.id, req.params.userId))
    return res.status(404).json({ error: 'Diese Person arbeitet hier nicht mit.' })
  res.json({ ok: true })
})

/* upsert a named design doc; empty markdown deletes it (same permission
   model as rename: any signed-in user with access) */
/* doc history, newest first — '' markdown rows mark deletions */
app.get('/api/canvases/:id/guidelines/:name/history', async (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const rows = await persist.listGuidelineVersions(req.params.id, req.params.name.toLowerCase())
  res.json(rows.map((v) => ({ markdown: v.markdown, savedAt: v.savedAt, savedBy: v.savedBy })))
})

app.put('/api/canvases/:id/guidelines/:name', (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  const { markdown, x, y, title } = req.body ?? {}
  /* no markdown = metadata patch (position/title): content and history untouched */
  if (markdown === undefined) {
    const patch = {
      ...(x !== undefined || y !== undefined ? { x: Number(x), y: Number(y) } : {}),
      ...(typeof title === 'string' ? { title } : {}),
    }
    if (!actions.patchGuideline(req.params.id, req.params.name, patch, actor))
      return res.status(404).json({ error: 'Nicht gefunden' })
    return res.json({ ok: true })
  }
  try {
    const pos = typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined
    const doc = actions.setGuideline(
      req.params.id,
      req.params.name,
      String(markdown ?? ''),
      actor,
      pos,
      typeof title === 'string' ? title : undefined,
    )
    if (doc === undefined) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json(doc ? { ok: true, doc } : { ok: true, deleted: true })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Ungültiges Dokument' })
  }
})

/* design memory: pin/unpin reference frames, accept/dismiss rule proposals */
app.post('/api/canvases/:id/references', (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  try {
    const ref = actions.pinReference(req.params.id, String(req.body?.frameId ?? ''), actor)
    if (!ref) return res.status(404).json({ error: 'Arbeitsfläche oder Zeichenfläche nicht gefunden' })
    res.json(ref)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Die Referenz konnte nicht angeheftet werden.' })
  }
})

app.delete('/api/canvases/:id/references/:refId', (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  if (!actions.unpinReference(req.params.id, req.params.refId, actor))
    return res.status(404).json({ error: 'Referenz nicht gefunden' })
  res.json({ ok: true })
})

app.post('/api/canvases/:id/proposals/:pid', (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  const proposal = actions.resolveProposal(req.params.id, req.params.pid, !!req.body?.accept, actor)
  if (!proposal) return res.status(404).json({ error: 'Vorschlag nicht gefunden' })
  res.json(proposal)
})

/* Browser asset uploads (paste / drop): raw image bytes in, permanent /a/
   URL out. Same createAsset pipeline as the MCP ticket flow — the bytes are
   sniffed for the real type and capped at 5 MB. express.json ignores the
   image content-type, so express.raw here sees the untouched stream. */
app.post(
  '/api/canvases/:id/assets',
  express.raw({ type: () => true, limit: MAX_ASSET_BYTES + 1024 }),
  async (req, res) => {
    const c = requireCanvas(req, res, req.params.id)
    if (!c) return
    try {
      const asset = await createAsset(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), {
        canvasId: c.id,
        ownerId: req.user!.id,
        uploadedBy: req.user!.name,
      })
      /* absolute like the MCP flow: frame HTML renders inside sandboxed
         srcdoc iframes where root-relative URLs don't resolve */
      res.json({ url: `${env.BETTER_AUTH_URL}/a/${asset.id}.${asset.ext}`, mime: asset.mime, size: asset.size })
    } catch (e) {
      res
        .status(400)
        .json({ error: e instanceof AssetInputError ? e.message : 'Die Datei konnte nicht hochgeladen werden.' })
    }
  },
)

app.put('/api/canvases/:id/pages', (req, res) => {
  const canvas = requireCanvas(req, res, req.params.id)
  if (!canvas) return
  const pages = req.body?.pages
  if (
    !Array.isArray(pages) ||
    !pages.length ||
    pages.length > 100 ||
    pages.some(
      (p) =>
        !p ||
        typeof p.id !== 'string' ||
        !p.id.trim() ||
        p.id.length > 100 ||
        typeof p.name !== 'string' ||
        !p.name.trim() ||
        p.name.length > 100,
    ) ||
    new Set(pages.map((p) => p.id)).size !== pages.length
  ) {
    return res
      .status(400)
      .json({ error: 'Gib 1–100 Seiten mit eindeutigen IDs und Namen mit höchstens 100 Zeichen an.' })
  }
  if (!samePages(req.body?.expectedPages, canvasPages(canvas)))
    return res
      .status(409)
      .json({ error: 'Die Seiten wurden seit dem Öffnen geändert. Versuche es erneut.', pages: canvasPages(canvas) })
  const firstId = canvas.pages?.[0]?.id ?? `${canvas.id}:page1`
  if (canvas.frames.some((f) => !pages.some((p) => p.id === (f.pageId ?? firstId)))) {
    return res
      .status(400)
      .json({ error: 'Verschiebe die Zeichenflächen auf eine andere Seite, bevor Du diese Seite löschst.' })
  }
  const clean = pages.map((p) => ({ id: p.id, name: p.name.trim() }))
  store.setPages(canvas.id, clean)
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  broadcast(canvas.id, { type: 'canvas:pages', pages: clean, actor })
  res.json(clean)
})

app.post('/api/canvases/:id/pages/:pageId/duplicate', async (req, res) => {
  const canvas = requireCanvas(req, res, req.params.id)
  if (!canvas) return
  if (!canvasPages(canvas).some((page) => page.id === req.params.pageId))
    return res.status(404).json({ error: 'Seite nicht gefunden' })
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  try {
    const copy = await actions.duplicatePage(canvas.id, req.params.pageId, actor)
    if (!copy) return res.status(404).json({ error: 'Seite nicht gefunden' })
    res.json({ page: copy.page, pages: copy.pages, frames: copy.frames })
  } catch (e) {
    if (e instanceof PageLimitError) return res.status(400).json({ error: e.message })
    console.error('[pages] duplicate failed', e)
    res.status(500).json({ error: 'Die Seite konnte nicht dupliziert werden. Versuche es erneut.' })
  }
})

app.post('/api/canvases/:id/frames', (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const { name, pageId, x, y, width, height, html, hidden, locked } = req.body ?? {}
  if (pageId !== undefined && !store.getCanvas(req.params.id)?.pages?.some((p) => p.id === pageId))
    return res.status(400).json({ error: 'Seite nicht gefunden' })
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  /* `hidden` and `locked` let undo bring a deleted frame back as it was */
  const frame = actions.createFrame(
    req.params.id,
    {
      name: String(name || 'Zeichenfläche'),
      pageId,
      x,
      y,
      width,
      height,
      html,
      hidden: hidden === true,
      locked: locked === true,
    },
    actor,
  )
  if (!frame) return res.status(404).json({ error: 'Arbeitsfläche nicht gefunden' })
  res.json(frame)
})

app.patch('/api/frames/:id', (req, res) => {
  const current = requireFrame(req, res, req.params.id, req.body?.expectedUpdatedAt)
  if (!current) return
  const { actor: _ignored, expectedUpdatedAt: _version, ...patch } = req.body ?? {}
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  if (
    patch.pageId !== undefined &&
    !store.getCanvas(store.getFrame(req.params.id)!.canvasId)?.pages?.some((p) => p.id === patch.pageId)
  )
    return res.status(400).json({ error: 'Seite nicht gefunden' })
  const allowed = ['name', 'pageId', 'x', 'y', 'width', 'height', 'html'] as const
  const clean: Record<string, unknown> = {}
  for (const k of allowed) if (patch[k] !== undefined) clean[k] = patch[k]
  /* the eye in the Layers panel: anything but a literal true shows the frame */
  if (patch.hidden !== undefined) clean.hidden = patch.hidden === true
  if (patch.locked !== undefined) clean.locked = !!patch.locked
  const frame = actions.updateFrame(req.params.id, clean, actor)
  if (!frame) return res.status(404).json({ error: 'Zeichenfläche nicht gefunden' })
  res.json(frame)
})

app.post('/api/frames/:id/append', (req, res) => {
  if (!requireFrame(req, res, req.params.id)) return
  const { html_chunk, start, done } = req.body ?? {}
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  const frame = actions.appendFrameHtml(req.params.id, String(html_chunk ?? ''), actor, {
    start: !!start,
    done: !!done,
  })
  if (!frame) return res.status(404).json({ error: 'Zeichenfläche nicht gefunden' })
  res.json({ ok: true, htmlBytes: frame.html.length })
})

app.delete('/api/frames/:id', (req, res) => {
  if (!requireFrame(req, res, req.params.id, req.body?.expectedUpdatedAt)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  const frame = actions.deleteFrame(req.params.id, actor)
  if (!frame) return res.status(404).json({ error: 'Zeichenfläche nicht gefunden' })
  res.json({ ok: true })
})

/* design history: the states a frame had before later edits replaced them,
   newest first and without HTML; one version in full; restore (same
   permission model as editing — anyone with access to the canvas) */
app.get('/api/frames/:id/versions', async (req, res) => {
  if (!requireFrame(req, res, req.params.id)) return
  res.json(await persist.listFrameVersions(req.params.id))
})

app.get('/api/frames/:id/versions/:versionId', async (req, res) => {
  if (!requireFrame(req, res, req.params.id)) return
  const version = await persist.getFrameVersion(req.params.id, req.params.versionId)
  if (!version) return res.status(404).json({ error: 'Version nicht gefunden' })
  res.json(version)
})

app.post('/api/frames/:id/versions/:versionId/restore', async (req, res) => {
  if (!requireFrame(req, res, req.params.id)) return
  const actor = actions.resolveActor({ name: req.user!.name, kind: 'user' })
  const restored = await actions.restoreFrameVersion(req.params.id, req.params.versionId, actor)
  if (restored === null) return res.status(404).json({ error: 'Version nicht gefunden' })
  if (!restored) return res.status(404).json({ error: 'Zeichenfläche nicht gefunden' })
  res.json(restored)
})

app.post('/api/frames/:id/comments', async (req, res) => {
  if (!requireFrame(req, res, req.params.id)) return
  const { selector, snippet, text } = req.body ?? {}
  /* a comment that @mentions a resident agent is a new command to the team,
     so it's metered like a card; plain comments and replies stay free */
  let gate: Awaited<ReturnType<typeof allowance.consumeResidentTask>> | undefined
  if (mentionedRole(String(text ?? ''))) {
    gate = await allowance.consumeResidentTask(req.user!.id)
    if (!gate.ok) {
      return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
    }
  }
  const comment = actions.addElementComment(
    req.params.id,
    { selector: String(selector ?? ''), snippet: String(snippet ?? ''), text: String(text ?? '') },
    req.user!.name,
    req.user!.id,
    gate ? !gate.localAgent : undefined,
  )
  if (!comment) return res.status(404).json({ error: 'Zeichenfläche nicht gefunden oder Text leer' })
  res.json(comment)
})

/* a comment pinned to a point on the canvas (world coordinates on one of its
   pages) rather than to an element — metered exactly like an element comment */
app.post('/api/canvases/:id/comments', async (req, res) => {
  const canvas = requireCanvas(req, res, req.params.id)
  if (!canvas) return
  const { pageId, x, y, text } = req.body ?? {}
  if (typeof pageId !== 'string' || !canvasPages(canvas).some((page) => page.id === pageId)) {
    return res.status(400).json({ error: 'Seite nicht gefunden' })
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ error: 'x und y müssen Zahlen sein.' })
  const body = String(text ?? '')
  if (!body.trim()) return res.status(400).json({ error: 'Bitte gib einen Text ein.' })
  let gate: Awaited<ReturnType<typeof allowance.consumeResidentTask>> | undefined
  if (mentionedRole(body)) {
    gate = await allowance.consumeResidentTask(req.user!.id)
    if (!gate.ok) {
      return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
    }
  }
  const comment = actions.addCanvasComment(
    canvas.id,
    { pageId, x: Number(x), y: Number(y), text: body },
    req.user!.name,
    req.user!.id,
    gate ? !gate.localAgent : undefined,
  )
  if (!comment) {
    /* the page went away while the meter was being written: give the task
       back — a failed refund is logged, never turned into a 500 */
    if (gate) {
      await allowance.refundResidentTask(gate, req.user!.id).catch((err) => {
        console.error(`[comments] could not refund a resident task for ${req.user!.id}:`, err)
      })
    }
    return res.status(409).json({ error: 'Die Seite wurde inzwischen entfernt.' })
  }
  res.json(comment)
})

app.post('/api/comments/:id/replies', async (req, res) => {
  const found = actions.findComment(req.params.id)
  if (!found) return res.status(404).json({ error: 'Kommentar nicht gefunden' })
  if (!requireCanvas(req, res, found.canvasId)) return
  const text = String(req.body?.text ?? '')
  if (!text.trim() || !actions.openThread(req.params.id)) {
    return res.status(404).json({ error: 'Die Diskussion ist erledigt oder der Text ist leer.' })
  }
  /* same rule as a fresh comment: only an @mention costs a resident task */
  let gate: Awaited<ReturnType<typeof allowance.consumeResidentTask>> | undefined
  if (mentionedRole(text)) {
    gate = await allowance.consumeResidentTask(req.user!.id)
    if (!gate.ok) {
      return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
    }
  }
  const reply = actions.replyToComment(
    req.params.id,
    text,
    req.user!.name,
    req.user!.id,
    'user',
    gate ? !gate.localAgent : undefined,
  )
  if (!reply) {
    /* the thread closed while the meter was being written: give the task
       back — a failed refund is logged, never turned into a 500 */
    if (gate) {
      await allowance.refundResidentTask(gate, req.user!.id).catch((err) => {
        console.error(`[comments] could not refund a resident task for ${req.user!.id}:`, err)
      })
    }
    return res.status(409).json({ error: 'Die Diskussion wurde inzwischen erledigt.' })
  }
  res.json(reply)
})

app.post('/api/comments/:id/resolve', (req, res) => {
  const found = actions.findComment(req.params.id)
  if (!found) return res.status(404).json({ error: 'Kommentar nicht gefunden' })
  if (!requireCanvas(req, res, found.canvasId)) return
  res.json(actions.resolveComment(req.params.id, req.user!.name))
})

app.post('/api/comments/:id/retry', async (req, res) => {
  const found = actions.findComment(req.params.id)
  if (!found) return res.status(404).json({ error: 'Kommentar nicht gefunden' })
  if (!requireCanvas(req, res, found.canvasId)) return
  const gate = await allowance.consumeResidentTask(req.user!.id)
  if (!gate.ok) {
    return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
  }
  res.json(actions.retryComment(req.params.id, req.user!.name, !gate.localAgent))
})

app.post('/api/canvases/:id/cards', async (req, res) => {
  if (!requireCanvas(req, res, req.params.id)) return
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Bitte gib einen Titel ein.' })
  const gate = await allowance.consumeResidentTask(req.user!.id)
  if (!gate.ok) {
    return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
  }
  const card = actions.addQueuedCard(
    req.params.id,
    title,
    req.user!.name,
    req.body?.agents,
    req.body?.attachments,
    req.user!.id,
    req.body?.scope,
    !gate.localAgent,
  )
  if (!card) return res.status(404).json({ error: 'Arbeitsfläche nicht gefunden oder Titel leer' })
  res.json(card)
})

app.post('/api/canvases/:canvasId/cards/:id/done', (req, res) => {
  if (!requireCanvas(req, res, req.params.canvasId)) return
  const card = actions.completeCard(req.params.canvasId, req.params.id)
  if (!card) return res.status(404).json({ error: 'Aufgabenkarte nicht gefunden' })
  res.json(card)
})

app.post('/api/canvases/:canvasId/cards/:id/retry', async (req, res) => {
  if (!requireCanvas(req, res, req.params.canvasId)) return
  const gate = await allowance.consumeResidentTask(req.user!.id)
  if (!gate.ok) {
    return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
  }
  const card = actions.retryCard(req.params.canvasId, req.params.id, req.user!.name, !gate.localAgent)
  if (!card) return res.status(404).json({ error: 'Aufgabenkarte nicht gefunden' })
  res.json(card)
})

app.post('/api/tasks/:id/feedback', async (req, res) => {
  const canvasId = actions.taskCanvasId(req.params.id)
  if (!canvasId) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })
  if (!requireCanvas(req, res, canvasId)) return
  const text = String(req.body?.text ?? '').trim()
  if (!text) return res.status(400).json({ error: 'Bitte gib einen Text ein.' })
  const gate = await allowance.consumeResidentTask(req.user!.id)
  if (!gate.ok) {
    return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
  }
  const fb = actions.addTaskFeedback(req.params.id, req.user!.name, text, req.user!.id, !gate.localAgent)
  if (!fb) return res.status(404).json({ error: 'Aufgabe nicht gefunden oder Text leer' })
  res.json(fb)
})

app.post('/api/feedback/:id/retry', async (req, res) => {
  const found = actions.findFeedback(req.params.id)
  if (!found) return res.status(404).json({ error: 'Rückmeldung nicht gefunden' })
  if (!requireCanvas(req, res, found.canvasId)) return
  const gate = await allowance.consumeResidentTask(req.user!.id)
  if (!gate.ok) {
    return res.status(403).json({ error: 'resident_limit', used: gate.used, limit: gate.limit })
  }
  res.json(actions.retryTaskFeedback(req.params.id, req.user!.name, !gate.localAgent))
})

app.get('/api/frames/:id/screenshot.png', async (req, res) => {
  const frame = requireFrame(req, res, req.params.id)
  if (!frame) return
  try {
    const { renderFrame } = await import('./screenshot.ts')
    const png = await renderFrame(frame, req.query.scale === '2' ? 2 : 1)
    res.type('png').send(png)
  } catch {
    res.status(500).json({ error: 'Die Vorschau konnte nicht erstellt werden.' })
  }
})

/* MCP endpoint — point any MCP-capable AI at http://localhost:PORT/mcp.
   Protected by OAuth: unauthenticated calls get 401 + discovery pointers. */
app.all('/mcp', handleMcpRequest)

/* OAuth discovery metadata at the root, where MCP clients look for it
   (better-auth serves these under /api/auth; we bridge the web-standard
   handlers into Express) */
function bridge(handler: (req: globalThis.Request) => Promise<globalThis.Response>) {
  return async (req: express.Request, res: express.Response) => {
    const out = await handler(new globalThis.Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`))
    res.status(out.status)
    out.headers.forEach((v, k) => res.setHeader(k, v))
    res.send(await out.text())
  }
}
app.get('/.well-known/oauth-authorization-server', (req, res) => bridge(oAuthDiscoveryMetadata(auth))(req, res))
/* The same document under the OpenID Connect name: ChatGPT accepts either,
   but its Enterprise workspace-domain restriction reads only this one (it
   needs the userinfo_endpoint better-auth already lists there). */
app.get('/.well-known/openid-configuration', (req, res) => bridge(oAuthDiscoveryMetadata(auth))(req, res))

/* Protected-resource metadata must name the exact endpoint the CLIENT
   connected to (RFC 9728 §3.3 — strict clients such as Muse reject a `resource`
   that differs from the URL they called, so it is `<origin>/mcp`, never the bare
   origin), while the authorization server stays on the canonical origin. In dev
   the app may be reached via :4300, :4301 (vite port bump) or :4400 — all must
   validate, so the origin is echoed from the request. Both well-known paths
   serve the same document, the shape Linear ships. */
function protectedResourceMetadata(req: express.Request, res: express.Response) {
  res.json({
    resource: `${req.protocol}://${req.get('host')}/mcp`,
    authorization_servers: [env.BETTER_AUTH_URL],
    jwks_uri: `${env.BETTER_AUTH_URL}/api/auth/mcp/jwks`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: ['RS256'],
  })
}
app.get('/.well-known/oauth-protected-resource', protectedResourceMetadata)
/* path-aware variant some clients probe for a resource at /mcp */
app.get('/.well-known/oauth-protected-resource/mcp', protectedResourceMetadata)

/* robots + minimal sitemap for every deployment */
app.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain')
    .send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /c/\n\nSitemap: ${env.BETTER_AUTH_URL}/sitemap.xml\n`)
})
app.get('/sitemap.xml', (_req, res) => {
  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${env.BETTER_AUTH_URL}/</loc></url>\n</urlset>\n`,
    )
})

/* Public brand fonts also load in opaque-origin srcDoc frames, which require
   CORS even though the bytes come from this same instance. */
app.use(
  '/fonts',
  express.static(fileURLToPath(new URL(env.isProduction ? '../dist/fonts' : '../public/fonts', import.meta.url)), {
    setHeaders(res) {
      res.setHeader('Access-Control-Allow-Origin', '*')
    },
  }),
)

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof CreatorPermissionError) return res.status(403).json({ error: error.message })
  if (res.headersSent) return next(error)
  console.error('[api] request failed', error)
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500
  res.status(status).json({
    error:
      status < 500
        ? 'Die Anfrage enthält ungültige Daten. Prüfe Deine Eingabe.'
        : 'Die Anfrage konnte nicht verarbeitet werden. Versuche es erneut.',
  })
})

/* production: serve the built client */
if (env.isProduction) {
  const dist = path.join(process.cwd(), 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

/* ------------------------------------------------- websocket */

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, upgradeReq) => {
  /* the session cookie rides the upgrade request; resolve it once */
  const sessionPromise = auth.api.getSession({ headers: fromNodeHeaders(upgradeReq.headers) }).catch(() => null)

  ws.on('message', async (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    const conn = conns.get(ws)

    if (msg.type === 'join') {
      const session = await sessionPromise
      if (!session) {
        ws.close(4401, 'Bitte melde Dich an.')
        return
      }
      const canvas = store.getCanvas(msg.canvasId)
      if (!canvas) {
        /* a typo'd id or a canvas someone just deleted: say so and close,
           instead of leaving the socket open with nothing ever coming back.
           The client used to sit on a blank, unusable canvas UI forever
           waiting for an 'init' that would never arrive. */
        ws.close(4404, 'Nicht gefunden')
        return
      }
      if (!canAccessCanvas(session.user.id, canvas)) {
        ws.close(4403, 'no access')
        return
      }
      const presence: Presence = {
        clientId: msg.clientId,
        name: session.user.name, // session identity, not whatever the client claims
        color: colorFor(msg.clientId),
        kind: 'user',
        activeFrameId: null,
      }
      const silent = !!(session.session as { impersonatedBy?: string | null }).impersonatedBy
      conns.set(ws, { ws, canvasId: msg.canvasId, presence, silent })
      const others = room(msg.canvasId)
        .filter((c) => c.ws !== ws && !c.silent)
        .map((c) => c.presence)
      const agents = [...(agentPresences.get(msg.canvasId)?.values() ?? [])]
      send(ws, {
        type: 'init',
        canvas,
        presences: [...others, ...agents],
        activity: actions.getActivity(msg.canvasId),
        tasks: actions.getTasks(msg.canvasId),
        feedback: actions.getFeedback(msg.canvasId),
        comments: actions.getComments(msg.canvasId),
        decisions: actions.getDecisions(msg.canvasId),
        proposals: actions.getProposals(msg.canvasId),
        selfColor: presence.color,
        serverBuild: BUILD_ID,
      })
      /* An admin looking at a canvas must not act on it. Announcing presence
         would impersonate the owner in the room; maybePlay would have the
         demo agent perform on an untouched signup canvas; the card kick would
         start the resident agent working. All three are things the owner's
         own visit is supposed to trigger, not a support session. */
      if (silent) return
      broadcast(msg.canvasId, { type: 'presence:join', presence }, presence.clientId)
      demo.maybePlay(msg.canvasId) // first visit to a fresh signup canvas: the demo agent performs
      /* Start never-attempted cards. Failed/interrupted cards are excluded. */
      if (actions.getTasks(msg.canvasId).some((t) => t.queuedBy && !t.agentName && !t.endedAt)) {
        import('./resident.ts').then((r) => r.onFeedback(msg.canvasId)).catch(() => {})
      }
      return
    }

    if (!conn) return
    if (conn.silent) return // view-as connections receive updates but never emit
    const { canvasId, presence } = conn

    switch (msg.type) {
      case 'cursor':
        presence.cursor = { x: msg.x, y: msg.y }
        broadcast(canvasId, { type: 'cursor', clientId: presence.clientId, x: msg.x, y: msg.y }, presence.clientId)
        break
      case 'viewport':
        if (!isPeerViewport(msg.viewport)) break
        presence.viewport = msg.viewport
        broadcast(
          canvasId,
          { type: 'viewport', clientId: presence.clientId, viewport: msg.viewport },
          presence.clientId,
        )
        break
      case 'editing':
        presence.activeFrameId = msg.frameId
        broadcast(canvasId, { type: 'editing', clientId: presence.clientId, frameId: msg.frameId }, presence.clientId)
        break
      case 'frame:drag':
        broadcast(
          canvasId,
          {
            type: 'frame:drag',
            clientId: presence.clientId,
            frameId: msg.frameId,
            x: msg.x,
            y: msg.y,
            width: msg.width,
            height: msg.height,
          },
          presence.clientId,
        )
        break
    }
  })

  ws.on('close', () => {
    const conn = conns.get(ws)
    if (!conn) return
    conns.delete(ws)
    if (conn.silent) return // never announced a join, so nothing to leave
    broadcast(conn.canvasId, { type: 'presence:leave', clientId: conn.presence.clientId })
  })
})

server.listen(PORT, () => {
  console.log(`⟡ doop server     http://localhost:${PORT}`)
  console.log(`⟡ mcp endpoint      http://localhost:${PORT}/mcp`)
  console.log(`⟡ websocket         ws://localhost:${PORT}/ws`)
  /* The Doop Agent failing silently is the one "why is nothing happening?"
     a self-hoster cannot debug from the UI — board cards and @mentions just
     sit there. Say so at boot, not only when the first card is queued. */
  const tier = serverTierInfo()
  const tierLabel = {
    requesty: 'Requesty EU key',
    azure: 'Azure OpenAI deployment',
    anthropic: 'Anthropic key',
  }[tier.provider]
  const tierSetup = {
    requesty: 'REQUESTY_API_KEY',
    azure: 'the AZURE_OPENAI_* vars',
    anthropic: 'ANTHROPIC_API_KEY',
  }[tier.provider]
  console.log(
    tier.ready
      ? `⟡ doop agent        server tier ready on this server’s ${tierLabel} (RESIDENT_TASK_LIMIT=${env.RESIDENT_TASK_LIMIT}); eligible Local Agent selection takes priority`
      : `⟡ doop agent        no server ${tierLabel} — set ${tierSetup} and RESIDENT_TASK_LIMIT>0; eligible Local Agents and MCP clients work independently`,
  )
  console.log(
    serverImageGenEnabled()
      ? '⟡ image generation  on — operator-configured server credentials'
      : '⟡ image generation  off — no server image provider configured',
  )
  /* automations fire from here: one tick a minute over the due rows */
  startScheduler()
  for (const extension of extensions) extension.startWorker?.()
})
