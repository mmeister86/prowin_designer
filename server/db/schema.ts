import {
  pgTable,
  text,
  doublePrecision,
  bigint,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
} from 'drizzle-orm/pg-core'
import type { CanvasPageInfo } from '../../shared/types.ts'
import type { Schedule, Step } from '../../shared/automations.ts'

/** Opt-in Creator accounts; never an instance administration role. */
export const prowinCreators = pgTable('prowin_creators', {
  userId: text('user_id').primaryKey(),
  registeredAt: bigint('registered_at', { mode: 'number' }).notNull(),
})

/** ActivityKit tokens are delivery secrets: never return them through read APIs. */
export const liveActivities = pgTable('live_activities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  canvasId: text('canvas_id').notNull(),
  token: text('token').notNull().unique(),
  environment: text('environment').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  lastPayload: text('last_payload'),
  lastTimestamp: bigint('last_timestamp', { mode: 'number' }).notNull().default(0),
})

/** Push-to-start tokens (iOS 17.2+): one per device and server origin, so the
 *  server can start a Live Activity for an agent task on any canvas the user
 *  belongs to, app open or not. Delivery secrets like the update tokens above. */
export const liveActivityStarters = pgTable('live_activity_starters', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  environment: text('environment').notNull(),
  /** the server origin string the app uses, echoed into the activity's attributes */
  origin: text('origin').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
})

/**
 * One Postgres-dialect schema for every environment: PGlite (embedded, file
 * in ./data) during development, a managed Postgres via DATABASE_URL in
 * production. Timestamps are epoch-ms bigints to match the in-memory types.
 * No FK constraints — memory is the source of truth and writes are async
 * fire-and-forget, so we don't want ordering between them to matter.
 */

export const canvases = pgTable('canvases', {
  pages: jsonb('pages').$type<CanvasPageInfo[]>(),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id'),
  /** 'edit' | 'none'; null = 'none' (private — link sharing is opt-in) */
  linkAccess: text('link_access'),
  /** set when the owner has listed this canvas in the community gallery;
   *  null = private to its collaborators. Publishing grants read-only
   *  previews and copies, never access to the canvas itself. */
  publishedAt: bigint('published_at', { mode: 'number' }),
  /** gallery blurb and category — meaningful only while published */
  description: text('description'),
  category: text('category'),
  /** how many times the gallery has copied this canvas — the "trending" signal */
  copyCount: integer('copy_count').notNull().default(0),
  /** the shared workspace this canvas lives in; null = the owner's personal
   *  space. Every workspace member can open a workspace canvas. */
  workspaceId: text('workspace_id'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

/** A shared workspace: a team's home for canvases. Membership (below) grants
 *  access to every canvas inside it, so a workspace is the org-level unit
 *  the per-canvas invite model never had. Billing is per workspace, per
 *  seat (see shared/billing.ts): the Stripe columns are the mirror of the
 *  subscription, written by the webhook and the post-checkout sync — never
 *  by a UI request directly. Without Stripe configured (self-hosting) the
 *  status column is ignored and every workspace is active. */
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),
  /** 'inactive' (never paid) | 'trialing' | 'active' | 'past_due' | 'canceled' */
  status: text('status').notNull().default('inactive'),
  /** 'team'; null until a plan was chosen */
  plan: text('plan'),
  /** 'month' | 'year' */
  interval: text('interval'),
  /** the paid seat count Stripe is billing for */
  seats: integer('seats').notNull().default(0),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  /** epoch ms the current billing period ends (= the next renewal) */
  currentPeriodEnd: bigint('current_period_end', { mode: 'number' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  /** Stripe's `created` of the last subscription event applied (epoch s) —
   *  an older event arriving late must not roll the mirror back */
  billingEventAt: bigint('billing_event_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

/** Who is in a workspace, and as what. The owner IS listed here (role
 *  'owner'), unlike canvas_members — every seat is a row, so the seat count
 *  billed to Stripe is a plain count of this table. */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    /** 'owner' | 'admin' | 'member' */
    role: text('role').notNull(),
    addedBy: text('added_by').notNull(),
    addedAt: bigint('added_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index('workspace_members_user_idx').on(t.userId)],
)

/** An invitation to someone who has no doop account yet. Accepted
 *  automatically the moment an account with that email is created; a seat
 *  is only billed from then on. */
export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    invitedBy: text('invited_by').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    uniqueIndex('workspace_invites_workspace_email_idx').on(t.workspaceId, t.email),
    index('workspace_invites_email_idx').on(t.email),
  ],
)

/** Users invited to collaborate on a canvas (the owner is not listed).
 *  Access = owner ∪ members ∪ (everyone, when link_access = 'edit'). */
export const canvasMembers = pgTable(
  'canvas_members',
  {
    canvasId: text('canvas_id').notNull(),
    userId: text('user_id').notNull(),
    addedBy: text('added_by').notNull(),
    addedAt: bigint('added_at', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.canvasId, t.userId] })],
)

export const frames = pgTable(
  'frames',
  {
    pageId: text('page_id'),
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    name: text('name').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull(),
    html: text('html').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    updatedBy: text('updated_by').notNull(),
    /** product-made onboarding/example content; null = a real user frame */
    demo: boolean('demo'),
    /** hidden from the stage via the Layers panel; null = shown */
    hidden: boolean('hidden'),
    /** Figma-style lock; null = unlocked */
    locked: boolean('locked'),
  },
  (t) => [index('frames_canvas_idx').on(t.canvasId)],
)

/** Frame design history: the HTML (and size) a frame had before a burst of
 *  edits replaced it, so an agent's one-shot redesign or stream is never the
 *  only copy left. Append-only, pruned to the newest MAX_FRAME_VERSIONS per
 *  frame; `saved_by`/`saved_at` name who authored that state and when. Cold
 *  path: written on each burst boundary, read only by the history UI. */
export const frameVersions = pgTable(
  'frame_versions',
  {
    id: text('id').primaryKey(),
    frameId: text('frame_id').notNull(),
    canvasId: text('canvas_id').notNull(),
    html: text('html').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull(),
    savedAt: bigint('saved_at', { mode: 'number' }).notNull(),
    savedBy: text('saved_by').notNull(),
    /** 'user' | 'agent'; null when the author's kind was not known (a state
     *  authored before the server last booted) */
    savedByKind: text('saved_by_kind'),
  },
  (t) => [index('frame_versions_frame_idx').on(t.frameId), index('frame_versions_canvas_idx').on(t.canvasId)],
)

/** Agent keys: account-scoped bearer credentials for the /mcp endpoint — the
 *  headless counterpart to the MCP OAuth flow, for agents with no browser to
 *  approve in (Mastra, n8n, CI). A key acts as its owner: every MCP call it
 *  authenticates goes through the same canvas-access gate as an OAuth
 *  session. Unlike sync keys the secret is hashed at rest — it grants the
 *  account's full agent surface, not a single write-only drop box — and is
 *  shown once, at mint time. `start` keeps the first characters so the list
 *  UI can say which key is which. Revocation = row deletion, checked on
 *  every request. */
export const agentKeys = pgTable(
  'agent_keys',
  {
    id: text('id').primaryKey(),
    /** sha256 hex of the full secret; the secret itself is never stored */
    secretHash: text('secret_hash').notNull(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    start: text('start').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    lastUsedAt: bigint('last_used_at', { mode: 'number' }),
  },
  (t) => [index('agent_keys_user_idx').on(t.userId), uniqueIndex('agent_keys_hash_idx').on(t.secretHash)],
)

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    serverPaid: boolean('server_paid'),
    canvasId: text('canvas_id').notNull(),
    agentName: text('agent_name').notNull(),
    owner: text('owner'),
    color: text('color').notNull(),
    status: text('status').notNull(),
    startedAt: bigint('started_at', { mode: 'number' }).notNull(),
    endedAt: bigint('ended_at', { mode: 'number' }),
    auto: boolean('auto').notNull().default(false),
    queuedBy: text('queued_by'),
    claimedAt: bigint('claimed_at', { mode: 'number' }),
    failedAt: bigint('failed_at', { mode: 'number' }),
    failureReason: text('failure_reason'),
    /** comma-joined agent-role ids; null for status tasks and legacy cards */
    pipeline: text('pipeline'),
    stage: integer('stage'),
    /** comma-joined reference-frame ids uploaded with the prompt */
    attachments: text('attachments'),
    /** account id of the human who queued the card — picks the model credential */
    queuedByUserId: text('queued_by_user_id'),
    /** structured cards ('sketch', 'design-system'); null for prompt cards */
    kind: text('kind'),
    /** JSON payload of a structured card — what its runner needs, never a secret */
    payload: text('payload'),
    /** JSON CardScope: the frame/element the prompt was scoped to when queued */
    scope: text('scope'),
    /** comma-joined ids of the frames edited while the task was open, most recent last */
    frameIds: text('frame_ids'),
  },
  (t) => [index('tasks_canvas_idx').on(t.canvasId)],
)

export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    serverPaid: boolean('server_paid'),
    taskId: text('task_id').notNull(),
    canvasId: text('canvas_id').notNull(),
    agentName: text('agent_name').notNull(),
    targetAgent: text('target_agent'),
    fromName: text('from_name').notNull(),
    fromUserId: text('from_user_id'),
    text: text('text').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    deliveredAt: bigint('delivered_at', { mode: 'number' }),
    claimedBy: text('claimed_by'),
    completedAt: bigint('completed_at', { mode: 'number' }),
    failedAt: bigint('failed_at', { mode: 'number' }),
    failureReason: text('failure_reason'),
  },
  (t) => [index('feedback_canvas_idx').on(t.canvasId)],
)

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    serverPaid: boolean('server_paid'),
    canvasId: text('canvas_id').notNull(),
    /* element comment: the frame + selector + snippet; canvas comment: no
       frame, a page and a world point instead (selector/snippet empty) */
    frameId: text('frame_id'),
    selector: text('selector').notNull(),
    snippet: text('snippet').notNull(),
    pageId: text('page_id'),
    x: doublePrecision('x'),
    y: doublePrecision('y'),
    fromName: text('from_name').notNull(),
    fromUserId: text('from_user_id'),
    text: text('text').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    forAgent: boolean('for_agent').notNull().default(false),
    targetAgent: text('target_agent'),
    claimedBy: text('claimed_by'),
    claimedAt: bigint('claimed_at', { mode: 'number' }),
    failedAt: bigint('failed_at', { mode: 'number' }),
    failureReason: text('failure_reason'),
    resolvedBy: text('resolved_by'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    parentId: text('parent_id'),
  },
  (t) => [index('comments_canvas_idx').on(t.canvasId)],
)

/** Uploaded image assets: metadata only — bytes live in object storage (or
 *  ./data/assets in dev). canvas_id is a housekeeping hint, not ownership:
 *  liveness comes from asset_refs, so a URL copied to another canvas keeps
 *  its asset alive. */
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id'),
    ownerId: text('owner_id'),
    mime: text('mime').notNull(),
    ext: text('ext').notNull(),
    size: integer('size').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('assets_canvas_idx').on(t.canvasId)],
)

/** Which frames reference which assets — a projection of frame HTML, synced
 *  on every durable frame write (recomputed from the frame's full HTML, so
 *  it cannot drift like a counter would) and rebuilt at boot. GC is then an
 *  indexed anti-join here instead of a scan over all HTML. */
export const assetRefs = pgTable(
  'asset_refs',
  {
    assetId: text('asset_id').notNull(),
    frameId: text('frame_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.frameId] }), index('asset_refs_frame_idx').on(t.frameId)],
)

/** Named design docs per canvas (brand rules, style recipes) — markdown
 *  written mostly for agents. Small and cold-path; hydrated with the canvas. */
export const guidelines = pgTable(
  'guidelines',
  {
    canvasId: text('canvas_id').notNull(),
    name: text('name').notNull(),
    markdown: text('markdown').notNull(),
    /* pretty display name; null = show the slug */
    title: text('title'),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    updatedBy: text('updated_by').notNull(),
    /* world position of the card on the canvas; null = auto-placed */
    x: doublePrecision('x'),
    y: doublePrecision('y'),
  },
  (t) => [primaryKey({ columns: [t.canvasId, t.name] })],
)

/** Append-only history of guideline docs: one snapshot per save, an empty
 *  markdown marks a deletion. Capped per doc at write time; read on demand
 *  (cold path — no in-memory mirror). */
export const guidelineVersions = pgTable(
  'guideline_versions',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    name: text('name').notNull(),
    markdown: text('markdown').notNull(),
    savedAt: bigint('saved_at', { mode: 'number' }).notNull(),
    savedBy: text('saved_by').notNull(),
  },
  (t) => [index('guideline_versions_doc_idx').on(t.canvasId, t.name)],
)

/** Frames pinned to Memory as style exemplars: the HTML is a snapshot taken
 *  at pin time, deliberately decoupled from the (mutable, deletable) frame. */
export const memoryReferences = pgTable(
  'memory_references',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    frameId: text('frame_id').notNull(),
    title: text('title').notNull(),
    html: text('html').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull(),
    pinnedBy: text('pinned_by').notNull(),
    pinnedAt: bigint('pinned_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('memory_references_canvas_idx').on(t.canvasId)],
)

/** Resolved design decisions captured from addressed feedback/comments —
 *  the distiller's raw material. */
export const decisions = pgTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    text: text('text').notNull(),
    summary: text('summary'),
    source: text('source').notNull(),
    frameId: text('frame_id'),
    fromName: text('from_name').notNull(),
    agentName: text('agent_name'),
    at: bigint('at', { mode: 'number' }).notNull(),
    distilledAt: bigint('distilled_at', { mode: 'number' }),
  },
  (t) => [index('decisions_canvas_idx').on(t.canvasId)],
)

/** Rule edits the distiller proposed; humans accept (→ guide) or dismiss. */
export const memoryProposals = pgTable(
  'memory_proposals',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    guideName: text('guide_name').notNull(),
    guideTitle: text('guide_title'),
    rule: text('rule').notNull(),
    rationale: text('rationale').notNull(),
    /** comma-joined decision ids */
    basedOn: text('based_on').notNull(),
    at: bigint('at', { mode: 'number' }).notNull(),
    status: text('status').notNull(),
    resolvedBy: text('resolved_by'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
  },
  (t) => [index('memory_proposals_canvas_idx').on(t.canvasId)],
)

export const activity = pgTable(
  'activity',
  {
    id: text('id').primaryKey(),
    canvasId: text('canvas_id').notNull(),
    actorName: text('actor_name').notNull(),
    actorKind: text('actor_kind').notNull(),
    actorColor: text('actor_color').notNull(),
    message: text('message').notNull(),
    frameId: text('frame_id'),
    at: bigint('at', { mode: 'number' }).notNull(),
  },
  (t) => [index('activity_canvas_idx').on(t.canvasId)],
)

/* free-tier metering: how many resident-team tasks each user has initiated */
export const residentUsage = pgTable('resident_usage', {
  userId: text('user_id').primaryKey(),
  used: integer('used').notNull().default(0),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

/* The curated background library behind search_backgrounds
   (server/backgrounds.ts). Bytes live in object storage under bg/<id>.webp
   and bg/<id>-t.webp; this row is everything the search ranks on. */
export const backgrounds = pgTable('backgrounds', {
  id: text('id').primaryKey(),
  /** sha1 of the uploaded source file — re-uploads of the same image are skipped */
  source: text('source').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  tone: text('tone').notNull(),
  style: text('style').notNull(),
  avgColor: text('avg_color').notNull(),
  palette: jsonb('palette').$type<string[]>().notNull(),
  tags: jsonb('tags').$type<string[]>().notNull(),
  slots: jsonb('slots').$type<string[]>().notNull(),
  textZone: text('text_zone').notNull(),
  description: text('description').notNull(),
  /** off = kept but hidden from search; new uploads without tags start off */
  enabled: boolean('enabled').notNull().default(true),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
})

/** A user's connection to an outside service (Meta today). One row per
 *  user and provider; the token never leaves the server — API responses
 *  carry the account list and display fields only. Revocation = row
 *  deletion. Automations reference the provider, not the row, so a
 *  reconnect picks the same automations back up. */
export const integrations = pgTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** 'meta' */
    provider: text('provider').notNull(),
    accessToken: text('access_token').notNull(),
    /** epoch ms the token expires; null = the provider said it doesn't */
    expiresAt: bigint('expires_at', { mode: 'number' }),
    /** the provider-side identity the token belongs to — display only */
    accountName: text('account_name'),
    /** what the connection unlocks: Meta ad accounts the user may pull from */
    accounts: jsonb('accounts').$type<{ id: string; name: string }[]>().notNull(),
    connectedAt: bigint('connected_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('integrations_user_provider_idx').on(t.userId, t.provider)],
)

/** A scheduled workflow: `schedule` says when, `steps` say what (see
 *  shared/automations.ts). Owned by a user; every step names a canvas the
 *  owner must be able to reach. Cold path — read by the scheduler tick and
 *  the Automations pages, no in-memory mirror. */
export const automations = pgTable(
  'automations',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    schedule: jsonb('schedule').$type<Schedule>().notNull(),
    steps: jsonb('steps').$type<Step[]>().notNull(),
    /** when the scheduler fires it next; null while disabled or incomplete */
    nextRunAt: bigint('next_run_at', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('automations_owner_idx').on(t.ownerId), index('automations_next_run_idx').on(t.nextRunAt)],
)

/** One execution of an automation, kept as a slim log line. */
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: text('id').primaryKey(),
    automationId: text('automation_id').notNull(),
    startedAt: bigint('started_at', { mode: 'number' }).notNull(),
    endedAt: bigint('ended_at', { mode: 'number' }),
    /** 'running' | 'ok' | 'failed' */
    status: text('status').notNull(),
    summary: text('summary'),
    error: text('error'),
    canvasId: text('canvas_id'),
    /** 'reconnect' when the fix is re-authorising an integration */
    failure: text('failure'),
  },
  (t) => [index('automation_runs_automation_idx').on(t.automationId)],
)

/** Local execution preference; Claude credentials never leave the desktop. */
export const localAgentPreferences = pgTable('local_agent_preferences', {
  userId: text('user_id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  model: text('model').notNull().default('default'),
})

/** Per-user notification switches. No row means everything is on: comment
 *  email is opt-out, so the person who shared a review link hears about the
 *  feedback without first finding a setting. */
export const notificationPrefs = pgTable('notification_prefs', {
  userId: text('user_id').primaryKey(),
  commentEmails: boolean('comment_emails').notNull().default(true),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})

/** Outbound webhooks: per-user endpoints told about events on the canvases
 *  that user durably has access to (owner, invited, workspace). The secret
 *  signs every delivery (HMAC), so it is stored as-is, like an integration
 *  token. Delivery health lives on the row so the settings page can show it. */
export const webhooks = pgTable(
  'webhooks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    /** subscribed event names (shared/webhooks.ts WEBHOOK_EVENTS) */
    events: jsonb('events').$type<string[]>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    lastStatus: integer('last_status'),
    lastAt: bigint('last_at', { mode: 'number' }),
    lastError: text('last_error'),
    /** consecutive failed deliveries; the hook pauses itself past a ceiling */
    failures: integer('failures').notNull().default(0),
  },
  (t) => [index('webhooks_user_idx').on(t.userId)],
)

/** Which image model generate_image draws with, per user. Separate from
 *  model_accounts because a server-tier user (no account row) still picks
 *  among the server-enabled image models. */
export const imagePrefs = pgTable('image_prefs', {
  userId: text('user_id').primaryKey(),
  model: text('model').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
})
