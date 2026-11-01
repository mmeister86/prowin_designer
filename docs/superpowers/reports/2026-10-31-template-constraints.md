# TASK-30 implementation and verification

## Outcome

Implement the approved protected-template design on branch `task/30-template-constraints`.
Keep TASK-30 **In Progress**, pending user acceptance. PR #7 is open and monitored at the user's request; do not merge.

- Enforce one parser-backed contract for update, append commit, restore, create/import and frame delete/resize.
- Preserve trusted source provenance through clipboard, duplicate, redo, REST, MCP and Resident creation.
- Buffer append chunks until one identity/revision-bound, authorized commit.
- Reject invalid metadata for all roles; reject unauthorized template modifications before store/history side effects.
- Keep TASK-31 UI, optional font/size locks, general sanitization and lifecycle ownership policy outside scope.

## Verification

Pre-PR production commit: `d560519` (four own-review fixes after initial implementation at `6772c12`).

| Check                         | Verified result                                  |
| ----------------------------- | ------------------------------------------------ |
| `bun run test --maxWorkers=4` | 190 files / **1601 tests PASS**, 192.88 seconds  |
| `bun run typecheck`           | PASS                                             |
| `bun run lint`                | PASS                                             |
| `bun run build`               | PASS; existing large-chunk notice                |
| `git diff --check`            | PASS                                             |
| `bun run doc-lint`            | PASS; one stale `.context` documentation warning |

Node localStorage ExperimentalWarnings also existed in the unchanged baseline.
The initial unconstrained-parallel baseline had six timeouts; all affected files passed with bounded workers. Final full verification has no failed tests.

Manual browser testing was not performed. A happy-dom save regression and real MCP/Resident transport harnesses are included.

## Review and correction record

All delegated implementers and independent reviewers used **Muse Spark 1.3**, as requested. The subsequent own-review fixes were implemented inline by the controller.

- Task 1: parser guard; initial review found dropped document wrappers/doctype, fixed and independently re-reviewed.
- Task 2: action guards and atomic streams; independent review approved without Important/Critical issues.
- Task 3: provenance callers, transport tests and docs; independent review approved. Confirmed production editor serialization preserves the doctype.
- Broad branch review: found an existing-event-handler mutation bypass; controller also reproduced a constrained-color removal bypass that the reviewer had incorrectly dismissed. One combined fix wave and scoped re-review addressed both.
- Final scoped re-review at `b218ff6`: all findings addressed, no new Important/Critical issues.
- Controller subsequently verified the deferred shorthand observation with four failing regression cases: legacy background/border/outline removal and text-decoration color injection. Fixed locally in `6772c12` under the harness instruction to handle small review findings directly. This small follow-up received TDD/self-review and full verification, **not another independent review round**.

### Own-review follow-up approved by the user

- The controller's requested independent read of the final code reproduced four missed cases: existing script/style editing in open fields, duplicate CSS properties hiding `!important`, SVG attribute-namespace collisions and rejected ordinary fragment saves.
- Fixed in `d560519`, only in the existing shared guard. Legacy non-editable subtrees and script/style roots stay frozen, changed duplicate-property styles fail closed, attribute keys include namespace/prefix/local name, and only an additive standard editor doctype is permitted for stored documents without one.
- TDD: 15 expected failures before production changes, then 2 files /71 focused tests PASS. Sixteen new tests include real HTTP PATCH/append denials with unchanged frame snapshots/versions, accepted DOM fragment saves, creator overrides and unchanged legacy/namespace resaves.
- Final verification: 190 files /1601 tests PASS; typecheck/lint/build/format/diff checks PASS. Doc-lint PASS with the existing stale `.context` warning; Node localStorage and Vite chunk notices remain. No new delegate or manual browser test.

## Limits and accepted non-blocking observations

- Under color constraints, ambiguous removal of presentation is fail-closed: a member may need to empty text or ask a Creator instead of unwrapping a styled/classed element. Legacy CSS shorthands remain frozen; plain text and safe typography edits remain supported.
- Protected template clipboard entries require an accessible source; deleted/revoked sources make redo fail visibly. Old metadata-free entries still work.
- Append no longer publishes partial frame HTML, including for Creators.
- Inert comments inside editable interiors remain allowed; no production undefined-identity draft collision was found; deadline-bound version-settle test polling remains.
- This is structural template enforcement, not pixel invariance, HTML copy protection or a general HTML/CSS sanitizer.

## CodeRabbit follow-up — 2026-11-01

Review of `5edd418` in [PR #7](https://github.com/mmeister86/prowin_designer/pull/7):

- Close frozen-descendant deletion/replacement through editable wrappers in the shared guard. Nested script/style regressions cover empty/text/inline replacements, Creator overrides, unrelated sibling edits, and HTTP PATCH/append rejection without stored-frame/version changes.
- Keep plain clipboard entries independent of their sources. Store source IDs only for template-bearing clips and filter unnecessary provenance in `api.createFrame`, also covering old clips, duplicate callers and redo. Keep server-side provenance validation unchanged.
- Correct MCP creation/replacement/append instructions and the guide to describe buffering, atomic commit, and post-commit screenshots.
- Fix the source-access test to use an authorized destination and a private source. Disabling only the source ACL produces 200 instead of the asserted 403; restoring the ACL passes. The mutation was not retained.
- TDD: seven expected failures before production edits; 85 focused tests pass after the fixes. An additional clipboard/API caller run passes 18 tests across three files.
- Full verification: `bun run test --maxWorkers=2` passes **191 files /1609 tests** in 339.54 seconds. The final MCP-description-only edit also passes `tests/mcp-tools.test.ts` (5 tests); typecheck, lint, build, format and diff checks pass. Doc-lint passes with the existing stale `.context` warning. The full suite logs localStorage warnings and happy-dom connection/abort stderr without failed tests; build retains the existing chunk-size notice.
- Defer excessive HTML depth and cumulative append-draft limits to **TASK-77** (To Do). A 6,000-level tree reproduces a `RangeError`; the missing cumulative append budget predates this PR. This availability-hardening limitation remains open.
- Defer quote-aware CSS declarations to **TASK-78** (To Do). A `font-family:"A;B"` font-size edit fails closed with 403; unchanged legacy styles remain resavable, and approved proWIN font names do not need this compatibility case.

No new subagents or manual browser testing for this correction batch. No merge or task closure.

## Rulings I made

Chronological record, including the cost if wrong:

1. Treat the user's implementation request as approval of the recommended design — explicit SDD/model choice authorized execution — risk: local design/implementation rework; no publication authorized.
2. Save a concrete plan without a second approval pause — requested SDD requires continuous execution — risk: local plan/work may need revision.
3. Preserve safe typography rather than silently adding font/size locks — those locks were explicitly undecided — risk: stricter typography would need separate product approval.
4. Buffer append for all roles — one atomicity model avoids unchecked persisted chunks — cost: Creators lose partial live rendering before commit.
5. Add optional source-frame provenance to existing copy callers — preserve legal copies without permitting arbitrary constraint creation — cost: old protected clipboard entries may need recopying.
6. Deny non-Creator template-frame resize/delete while retaining canvas/account lifecycle policy — close direct element-protection bypasses without changing ownership — risk: product semantics may need adjustment.
7. Use Muse Spark 1.3 for final review too — user's model choice overrides skill tier preference — risk: less review depth than a flagship model.
8. Continue after resource-sensitive baseline failures pass in isolated bounded runs — failures were timeouts, not assertions — risk: a hidden pre-existing integration defect might need separation; final full suite subsequently passed.
9. Include source provenance in existing MCP/Resident create schemas — caller completeness for Task 2's contract, no new workflow — risk: two small schema additions might be unnecessary.
10. Reject the reviewer's claim that color removals are inherently safe — a real allowed-color-to-red reproduction disproved it — cost: some formatting removals require Creator action.
11. Fix the final deferred CSS-shorthand observation locally — harness instructions require small review fixes without another delegate; four RED cases proved actual bypasses — cost: additional legacy formatting removals fail closed; this last small hardening has no extra independent review round.
12. Execute the user's approved own-review fixes inline without a new delegate — harness instructions require small review fixes to be handled directly — cost: self-review/TDD/full verification rather than another independent reviewer.
13. Allow only an additive standard HTML doctype on a stored no-doctype document — production editor always emits it; existing doctypes and wrapper attributes remain protected — cost: a legacy no-doctype document can acquire standards-mode markup, matching its existing editor rendering.

## References

- [Design](../specs/2026-10-31-template-constraints-design.md)
- [Implementation plan](../plans/2026-10-31-template-constraints.md)
- [Implemented template contract](../../prowin/template-attribute.md)
