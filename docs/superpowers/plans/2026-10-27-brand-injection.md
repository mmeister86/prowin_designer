# Brand Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed the authoritative `DESIGN-prowin.md` into both agent entry points and editable memory on newly created canvases without overwriting local documents.

**Architecture:** Load the global Markdown once relative to the server module, not the working directory. Share that source between the resident system prompt, MCP guide and initial GuidelineDoc; keep global precedence explicit. Seed only at creation/copy time, never at hydration or reads.

**Tech Stack:** Existing TypeScript, Node/tsx, React, Drizzle persistence and Vitest; no new dependencies.

**Spec:** TASK-24 acceptance criteria; `docs/prowin/doop-fork-umsetzung.md` §8.2; approved chat scope on 2026-10-27, including the editor-limit increase.

## Global Constraints

- The authoritative source remains `DESIGN-prowin.md`; preserve its qualified distinction between CI, observations, proposals, open questions and project decisions.
- New canvases receive exactly one `{ name: 'prowin-brand', title: 'proWIN Brand', markdown }` document, visible and editable through existing memory UI.
- Global brand rules outrank conflicting local guidelines, references and general taste advice. Local edits or deletion must not remove global injection.
- Preserve local guideline content, title and position on duplication; seed only if `prowin-brand` is absent.
- Do not retrofit existing canvases, change fonts/tokens/renderers, install dependencies or add a new UI.
- Share a 64_000-character guideline limit between server validation and UI; MCP must use the same server limit. Keep over-limit rejection.
- Include the source in the Docker runtime image. Resolve paths independently of process.cwd(). Missing/empty source must fail clearly, not silently disable branding.
- Use Backlog CLI for all task changes and leave TASK-24 In Progress until explicit user acceptance. Do not touch unrelated root-checkout changes.

## Review Focus

- A duplicated legacy canvas without brand memory receives the default; a locally edited brand document is copied exactly once.
- Restart retains seeded and locally edited documents; deleted documents are not silently recreated.
- The complete source plus a small local addition can be saved through UI/API/MCP; oversized documents remain rejected.
- Both resident model paths (server model and local harness) retain global branding when canvas memory conflicts or is deleted.
- Startup from another working directory still loads the same source, including in the production image layout.

---

### Task 1: Integrate global branding and editable canvas defaults

**Files:**

- Create `server/prowin/brand.ts`: one-time source loading, global prompt and default document construction.
- Create `shared/guidelines.ts`: shared guideline-size constant.
- Modify `server/resident.ts`, `server/guide.ts`: source injection and explicit precedence.
- Modify `server/store.ts`: seed fresh canvases and missing defaults on copies; persist correctly.
- Modify `server/actions.ts`, `src/components/MemoryPanel.tsx`: consume the shared 64_000-character limit; preserve the actions export used by MCP.
- Modify `Dockerfile`: copy the source into the runtime root.
- Extend/add focused tests in `tests/brandInjection.test.ts`, `tests/memoryAcceptance.test.ts`, `tests/duplicatePersistence.test.ts`, `tests/access.test.ts` and existing resident/UI test harnesses as needed.
- Update only relevant runtime-status prose in `DESIGN-prowin.md` and implementation documentation after verification; preserve historical TASK-23 acceptance.

**Interfaces:**

- Consumes existing `GuidelineDoc`, `store.createCanvas`, `store.duplicateCanvas`, `persist.saveGuideline`, `persist.saveCanvasCopy` and existing MemoryPanel editor.
- Produces `MAX_GUIDELINE_CHARS` from `shared/guidelines.ts`, with existing `actions.MAX_GUIDELINE_CHARS` compatibility.
- Brand module exports `PROWIN_BRAND_MARKDOWN: string`, `PROWIN_BRAND_PROMPT: string`, and `createBrandGuideline(updatedAt: number, updatedBy: string): GuidelineDoc`.
- Consumers independently check existing document names; do not build a generic seeding framework for one default.

- [x] **Step 1: Write focused regression tests before implementation.** Read existing harnesses and the TDD test-quality reference. Check the real MCP `get_guide` output contains the full source, and capture resident model/harness system inputs to check global injection survives conflicting/deleted local memory. Test fresh creation, missing-brand copies, preservation of edited brand content/title/position and uniqueness. Exercise persistence with a restart and retained deletion. Test editing the complete source plus local text and rejecting 64_001 characters through existing boundaries; render the real editor for its size contract.
- [x] **Step 2: Run the focused tests and record expected missing-feature failures.** Use `bun run test <focused test files>`. Imports/setup errors are not sufficient RED evidence.
- [x] **Step 3: Implement the smallest integration.** Load `../../DESIGN-prowin.md` relative to `server/prowin/brand.ts` using Node fs/URL APIs. Mark its filename and precedence in both global and local wrappers. Seed before returning `createCanvas`, explicitly persisting the guideline after its canvas. Copy existing guidelines first and seed only missing brand documents before atomic `saveCanvasCopy`. Keep hydration/read behavior unchanged. Use existing cached resident blocks; include the global prompt in the local-harness path too. Add the full source to DOOP_GUIDE. Clarify any directly contradictory guide precedence without taking on font hosting or token implementation.
- [x] **Step 4: Run focused tests, fix connected fixtures, then verify the whole change.** Run `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build`, formatting for touched files and `git diff --check`. Report every failure with its test name; do not hide baseline/environment failures. Record whether a Docker build or real model call was performed.
- [x] **Step 5: Review and commit only this task's files.** Record tests and changes in the report. Controller performs independent code/spec review of the whole task diff and verifies final evidence before handback. Keep TASK-24 In Progress; no push/PR/merge is requested.

## Verification and decisions — 2026-10-27

- Implementation: `8b7f3a9`. Independent whole-task/branch review: no blocking findings. CodeRabbit completed review with one minor; both review findings corrected and independently rechecked with no remaining findings.
- Final full suite: `bun run test --maxWorkers=4` — **168 files, 1,352 tests passed**, 170.19 seconds. No tests excluded or deadlines increased.
- Earlier default-concurrency run: 13 five-second timeouts in `bootGuard`, `germanUiReview`, `legacyPagesMigration`, `prowinMigration`; all four files passed unchanged separately (22 tests). First bounded run overlapped verification/edit activity and hit browser navigation failures (`drawingBrowser`, `elementPanelBrowser`); the final bounded run ran without concurrent build/edit activity and passed. Do not claim these earlier failures were proven baseline failures.
- Review-fix RED: three expected failures (oversized seed and tool descriptions in both resident paths); GREEN: 20/20 focused tests.
- Typecheck, lint, build, touched-file format and diff checks pass. Doc-lint passes with zero warnings after adding the runtime source map to `.context/DESIGN.md`. Existing Node localStorage and build chunk-size warnings remain.
- Decisions: reuse existing prompt cache; retain established copy timestamp/author semantics; format only changed prose in the pre-existing brand source to avoid unrelated table rewrites. Revisit only if provider caching, metadata policy or repository-wide formatting changes are explicitly requested.
- Not checked: Docker image build, live paid model behavior, manual browser acceptance. Prompt injection does not enforce visual brand compliance; fonts/tokens/export validation remain separate work. Source refresh requires server restart, local copies are not resynchronized.
- TASK-24 remains **In Progress** pending explicit user acceptance. No push, PR or merge.
