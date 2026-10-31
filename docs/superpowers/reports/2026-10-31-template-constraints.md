# TASK-30 implementation and verification

## Outcome

Implement the approved protected-template design on branch `task/30-template-constraints`.
Keep TASK-30 **In Progress**, pending user acceptance. Do not push, open a PR or merge.

- Enforce one parser-backed contract for update, append commit, restore, create/import and frame delete/resize.
- Preserve trusted source provenance through clipboard, duplicate, redo, REST, MCP and Resident creation.
- Buffer append chunks until one identity/revision-bound, authorized commit.
- Reject invalid metadata for all roles; reject unauthorized template modifications before store/history side effects.
- Keep TASK-31 UI, optional font/size locks, general sanitization and lifecycle ownership policy outside scope.

## Verification

Final production commit: `6772c12`.

| Check                         | Verified result                                  |
| ----------------------------- | ------------------------------------------------ |
| `bun run test --maxWorkers=4` | 190 files / **1585 tests PASS**, 205.59 seconds  |
| `bun run typecheck`           | PASS                                             |
| `bun run lint`                | PASS                                             |
| `bun run build`               | PASS; existing large-chunk notice                |
| `git diff --check`            | PASS                                             |
| `bun run doc-lint`            | PASS; one stale `.context` documentation warning |

Node localStorage ExperimentalWarnings also existed in the unchanged baseline.
The initial unconstrained-parallel baseline had six timeouts; all affected files passed with bounded workers. Final full verification has no failed tests.

Manual browser testing was not performed. A happy-dom save regression and real MCP/Resident transport harnesses are included.

## Review and correction record

All implementers and independent reviewers used **Muse Spark 1.3**, as requested.

- Task 1: parser guard; initial review found dropped document wrappers/doctype, fixed and independently re-reviewed.
- Task 2: action guards and atomic streams; independent review approved without Important/Critical issues.
- Task 3: provenance callers, transport tests and docs; independent review approved. Confirmed production editor serialization preserves the doctype.
- Broad branch review: found an existing-event-handler mutation bypass; controller also reproduced a constrained-color removal bypass that the reviewer had incorrectly dismissed. One combined fix wave and scoped re-review addressed both.
- Final scoped re-review at `b218ff6`: all findings addressed, no new Important/Critical issues.
- Controller subsequently verified the deferred shorthand observation with four failing regression cases: legacy background/border/outline removal and text-decoration color injection. Fixed locally in `6772c12` under the harness instruction to handle small review findings directly. This small follow-up received TDD/self-review and full verification, **not another independent review round**.

## Limits and accepted non-blocking observations

- Under color constraints, ambiguous removal of presentation is fail-closed: a member may need to empty text or ask a Creator instead of unwrapping a styled/classed element. Legacy CSS shorthands remain frozen; plain text and safe typography edits remain supported.
- Protected template clipboard entries require an accessible source; deleted/revoked sources make redo fail visibly. Old metadata-free entries still work.
- Append no longer publishes partial frame HTML, including for Creators.
- Inert comments inside editable interiors remain allowed; no production undefined-identity draft collision was found; deadline-bound version-settle test polling remains.
- This is structural template enforcement, not pixel invariance, HTML copy protection or a general HTML/CSS sanitizer.

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

## References

- [Design](../specs/2026-10-31-template-constraints-design.md)
- [Implementation plan](../plans/2026-10-31-template-constraints.md)
- [Implemented template contract](../../prowin/template-attribute.md)
