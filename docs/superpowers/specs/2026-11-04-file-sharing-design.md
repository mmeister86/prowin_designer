# TASK-35 — PNG/JPG file sharing

## Intent and acceptance

Share an exported design file, not an image URL. Preserve all existing downloads when file sharing is unavailable. Cancelled or merely opened sharing must never claim delivery. Add native iOS file sharing using the existing export surface. Backlog TASK-35 is the acceptance authority; its native/manual criterion stays open without real device evidence.

The user delegates open questions and approvals to controller recommendations. This design incorporates read-only consultation by Claude Opus 5.5, GPT-6.1 Sol and Muse Wonder, all at high effort.

## Approaches

1. **Automatic share after rendering:** smallest-looking change but loses transient user activation during a slow server render. Rejected.
2. **Prepare, then explicitly share:** recommended and selected under delegated decision authority. One extra click keeps browser activation reliable; prepared bytes also serve retries and download. iOS uses its existing SwiftUI ShareLink pattern with an explicit file representation for image attachments.
3. **Native bridge/UIActivityViewController and delivery telemetry:** unnecessary wrappers and ambiguous completion semantics. Rejected; no share success metrics or delivery toast are introduced.

## Web design

- Keep existing PNG/JPG download buttons and Inspector/clipboard behavior, including 120-second render boundary, server filenames/errors, desktop save-panel behavior and ten-minute blob URL lifetime.
- Extract only a reusable preparation function and prepared-blob save entry point from `src/lib/frameExport.ts`. New proWIN share logic/component lives in `src/prowin/`; existing modal gets a thin hook/import.
- Offer PNG/JPG sharing preparation where file sharing is supported; check `navigator.share` and guarded `navigator.canShare({files})` using a tiny probe and the real file. Unsupported browsers still see normal downloads and a short explanation.
- Build a File with correct `.png`/`.jpg` extension and explicit `image/png`/`image/jpeg` MIME. Preserve server filename where valid, sanitize path/control characters and bound the basename without losing the extension.
- UI states: idle, preparing, ready, sharing. Keep one prepared snapshot, display filename, and invalidate it on frame/version/format change. Abort/ignore obsolete or dismissed preparation. No global sharing spinner/notice collision.
- Explicit second share click calls `navigator.share({files:[file]})` before any asynchronous work. Disable repeated prepare/share actions while pending. `AbortError` is neutral (can also mean no targets); other failures show safe German messages. Keep prepared bytes and download for retry, including when real-file capability fails. Never auto-download on cancellation or error; never claim delivery on resolve.
- Download from prepared state saves the exact same bytes without fetching again. Keyboard dismissal/focus/accessibility stay consistent with the current modal.

## Native iOS design

- Extend the existing selected-frame export panel, preserving HTML export and canvas-link sharing. New focused image-export sheet/view may live alongside it; use narrow wiring in NativeCanvasView.
- Reuse DoopClient's cookie session/request and same-server response validation with export-specific Accept MIME and a 120-second per-request timeout. Request `/i/<encoded-id>.<png|jpg>?download` without scale. This endpoint is public by unguessable ID; do not change or misdescribe its access policy.
- Validate HTTP status and expected image MIME, do not write arbitrary error/HTML bytes as images. Native export errors stay visible within the sheet. Map known server export errors safely, never display arbitrary server text.
- Core format/filename/response rules are testable under `ios/Doop/Core` and `DoopCoreChecks`; avoid a new networking abstraction. Local frame name is sufficient for native filename; isolate/sanitize via ExportDirectory and preserve file extension after length limiting.
- Share an explicit file representation via ShareLink (CoreTransferable FileRepresentation) so targets receive actual PNG/JPG bytes, not a URL string. No success reporting means cancellation cannot count as success.
- Capture selected frame identity/version for preparation; cancel obsolete work and keep late responses from changing a new or dismissed sheet. Keep files alive while the system may read them. Use existing UUID temp isolation and platform temporary-directory lifetime rather than immediate deletion that races share consumers; document this bounded-by-OS cleanup limit.
- Include German photo-library add usage description in Debug and Release for optional Save Image action. No photo-library access is proactively requested.

## Constraints and non-goals

No dependencies, server rendering/auth/cache policy changes, new formats, PDF, telemetry, broad export framework, or unrelated cleanup. Code implementation exclusively Muse Spark 1.3; independent task/final code review GPT-6.1 Terra. No pushes or merges; TASK-35 stays In Progress pending user manual acceptance. Unrelated original working-tree edits remain untouched.

## Verification

- TDD web preparation/share/UI tests: both formats, bytes/MIME/name, unsupported/throwing capability, server/timeout errors, cancel/no delivery claim, retry, duplicate-click prevention, stale/dismissed preparation and prepared download without refetch. Existing export/clipboard/modal tests remain green.
- Swift core assertions: safe image filenames/long extensions, MIME mismatch/HTTP errors, known-safe error mapping, request path/timeout policy where practical; register in existing core check runner. Compile/build on Apple toolchain when available, otherwise explicitly report unavailable.
- Final web test suite/typecheck/lint/build, real exported PNG/JPG bytes via existing Chromium renderer tests and sharing preparation tests. Record any baseline failures separately.
- Manual acceptance: supported browser PNG and JPG file share/open/cancel/retry; desktop unsupported fallback; native iOS Share Sheet attachments, Save to Files/Photos, cancel, offline error, slow rendering and existing HTML/link sharing. Do not mark this performed without evidence.

## Council rulings

- Prefer local native filenames over parsing Content-Disposition: same requested artifact with less duplicated parsing; server naming remains unchanged on web.
- Preserve existing temp directory lifetime instead of immediate deletion; file consumers can read lazily after sheet dismissal. No unbounded permanent cache.
- Check share support before expensive preparation and again for the actual file. Do not special-case desktop beyond capability checks.
- Native manual execution is a verification limitation, not permission to omit native code or falsely close AC3.

## User-requested revision follow-up (2026-11-04)

After handback of the residual native revision bug, the user explicitly requested a new Council solution. This authorizes a new, narrowly scoped continuation, not another unbounded final-review loop. Round1 scoped correctness: Claude Opus5.5 **5/10**, GPT-6.1 Sol **5/10**, Muse Wonder **4/10**.

- Decode `DesignFrame.updatedAt` as optional `Double` (missing/null legacy fixtures remain valid) and add an explicit optional-revision marker to the existing export identity. Keep content/name/dimensions/id too: reveal HTML can change under an equal committed version.
- Synthesized frame equality must include updatedAt, so existing live-frame `.onChange` invalidates pending/prepared exports even for revision-only updates. Existing success AND error completion guards must compare the revision-bearing identity.
- Server `store.updateFrame` already guarantees strictly monotonic versions with `Math.max(Date.now(), frame.updatedAt + 1)`. No new server/API/cache/version protocol is needed.
- Sol additionally identified out-of-order native full-frame responses: protect the common canvas assignment boundary with a small pure merge rule. For a frame present in both incoming/current state, retain the current frame ONLY when both revisions are known and current > incoming. Allow equal versions for reveal HTML, newer versions, and legacy unknown versions. Apply to all full-frame assignments/reconnect snapshots via the existing canvas observer, preserving pending-move overlay behavior. Never resurrect a frame absent from an incoming snapshot, never mix different canvas IDs, and preserve authoritative nil/deletion semantics.
- Use a small production-used core merge function, not per-frame event trackers, transport wrappers, or a broader model refactor. Add executable Swift checks for exact numeric/missing/null decoding, equality/identity revision-only and A1→B2→A3, same-version changed HTML, delayed older responses, and snapshot deletion/new-frame behavior. Source assertions verify actual wiring only and are not native runtime proof.
- Explicit limits: old payloads without updatedAt retain content-only protection; an export HTTP response can precede knowledge of a WebSocket revision. Closing request/response version correlation would require a separate protocol change and is not part of this scoped received-revision bug. Existing renderer/cache concerns from Council are unverified pre-existing observations, not accepted TASK-35 scope.
- Muse Spark1.3 implements; Terra reviews the fix; the three original Council members perform a fresh scoped round2 and provide scores. Apple core/build/manual acceptance remains open without actual evidence.
