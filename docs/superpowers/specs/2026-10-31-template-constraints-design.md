# TASK-30: Server-side template constraints

## Intent and approval

Enforce the stored template contract across server writes, including manipulated HTML and metadata. TASK-29 is complete according to the user. On 2026-10-31 the user approved implementing the recommended protected-template approach with subagent-driven development, using Muse Spark 1.3.

## Scope

- One shared guard in the action layer, before mutation, history changes, stream cancellation or broadcasts.
- Stored current HTML is the trusted constraint baseline; trusted server permission context supplies `manageLocks`. Actor names and request-supplied role flags never grant authority.
- Update, append commit, restore, create/import and frame delete are covered. Server-side unchanged page/canvas copies preserve their source metadata. Boot migrations and entire canvas/account deletion retain their existing lifecycle authorization.
- TASK-31 UI, prompts, new roles, font/size lock attributes, safe zones and general HTML sanitization are excluded.

## Approaches

1. Only compare locked subtrees and inline constrained values: smaller, but mutable surrounding CSS/scripts/overlays undermine the contract.
2. Freeze the template outside permitted field edits: recommended and approved direction. Uses a real HTML parser, not a homemade DOM parser. It rejects structural changes outside editable fields while preserving ordinary saves and explicitly allowed field styling.

This protects stored template structure and its surrounding styles/scripts, not pixel invariance or copy protection: valid text changes can reflow layout, and existing dynamic scripts are not sandboxed by this guard.

## Guard contract

- Invalid or duplicate template metadata returns 400 for everyone, preserving TASK-29 validation and German messages. Unauthorized modifications return 403.
- Use a production HTML parser (`parse5`) to traverse actual browser-style trees, including SVG, template contents, entities and malformed markup. Reuse shared metadata validation, not the scanner as a security parser.
- Canonicalize attribute order, equivalent entity spellings and `data-od-locked` presence values. Do not erase meaningful text whitespace, CSS text or script contents to make comparisons pass.
- Attribute identity includes namespace, prefix and local name. A stored no-doctype document may acquire the production editor's standard HTML doctype; existing doctypes and document attributes remain protected.
- Frames with no template fields remain freely editable, but non-Creators cannot introduce fresh template metadata without a trusted source.
- In a frame with fields, non-Creators retain IDs, metadata, tag names, ancestor/descendant relationships, surrounding styles/scripts and non-field structure. Locked subtrees are unchanged. Outer unlocked fields containing nested fields are not holes that permit replacing protected descendants.
- Editable leaf fields permit text and safe inline formatting (`br`, `b`, `strong`, `i`, `em`, `u`, `span`), not scripts, links, event attributes, nested metadata or layout overlays. Image fields also permit `src` and `alt` changes. Existing safe formatting remains resavable.
- Existing non-editable legacy elements in editable interiors stay frozen, including replacement/removal; script/style field roots stay frozen too. Changed styles with duplicate property names fail closed rather than discarding priority/fallback declarations; unchanged legacy styles remain resavable.
- Do not introduce optional font/size locks. Safe typography changes in unlocked fields remain allowed (`font-family`, `font-size`, `font-weight`, `font-style`, `text-decoration`, `text-align`, `line-height`, `letter-spacing`); reject layout/position/visibility styles, custom-property redefinitions, `url()`, CSS escapes/comments and `!important` in changed editable styles. Existing unchanged style declarations are preserved rather than newly forbidden.
- Color properties (`color`, `background-color`, `fill`, `stroke`, `border-color`) may change; when an applicable stored `allowed-colors` constraint exists, new color values must be exactly `var(--<allowed token>)`, with no fallback. Nested formatting cannot bypass ancestor constraints. Empty lists add no color restriction. The surrounding stylesheet and custom properties remain frozen.
- `max-length` counts Unicode codepoints in decoded text (including nested text), without trimming or whitespace collapsing. Check changed text against every applicable ancestor field constraint. Unchanged legacy over-limit content may be resaved; new violations are rejected.
- Creator permission bypasses content restrictions, not malformed metadata validation.
- For non-Creators, delete and dimensions of a template-bearing frame are forbidden; name, position, page and hidden state retain existing behavior. No new enforcement of the unrelated frame-level `locked` flag.

## Writes, copies and identity

- Normalize/repair once before validation; store exactly that candidate (normalization may be idempotently repeated by the existing store).
- Restore re-reads the current frame after asynchronous version retrieval and validates HTML and dimensions before all side effects.
- Add optional `sourceFrameId` to frame creation. When used by a non-Creator, fetch the trusted source, verify current access to its canvas, and validate the requested new frame against the stored source contract. Never trust client HTML or a supplied source identifier alone. Missing or inaccessible sources fail closed.
- Non-Creator fresh creation without source permits metadata-free HTML only. Creator creation still validates metadata. Existing server-side page/canvas copies retain metadata unchanged.
- Clipboard/duplicate request plumbing carries the source frame ID when available; old metadata-free clipboard entries continue working. Undo of free frames is unchanged; protected-frame deletion is already denied, so no special deleted-template resurrection privilege is introduced.
- Resident authorization must not inherit the canvas owner's privileges when the authenticated initiating user is absent. Billing ownership may retain its separate fallback. Keep changes limited to this write-authority boundary.

## Streaming

- Buffer raw chunks for all roles until `done=true`; keep the committed frame, timestamps and history unchanged before commit. No partial HTML broadcasts. Existing reveal may display a successful final commit.
- Bind drafts to trusted user identity and initial frame revision; missing identity has no privileged fallback. Other users cannot append, restart or cancel another user's draft.
- Validate current permissions and the final normalized candidate against the current committed frame at commit. A concurrent frame change is a 409 conflict; never silently overwrite it.
- Invalid final candidates, timeout and authorized explicit restart discard their draft without saving partial HTML. A successful full save by the same user may discard its old draft; a rejected save must not cancel it. Preserve existing escape-repair and chunk-splitting semantics.

## Verification

Unit cases cover metadata, canonicalization, nested locks, Unicode limits, token colors, CSS/script/overlay changes, namespaces and template nodes. Action and HTTP/MCP/Resident tests cover each reachable write, true roles and trusted identity, append split tags/timeout/conflicts and rejection without frame/history/persistence mutation. A DOM-reserialized editor-style save must succeed. Run focused tests per task and the complete suite, typecheck and relevant lint/build checks at the end. Manual browser testing is reported separately if not performed.

## Operational boundaries

Work only in the isolated `task/30-template-constraints` branch. Keep TASK-30 In Progress until user acceptance; do not push, open a PR or merge without a separate request.
