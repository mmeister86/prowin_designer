---
id: TASK-25
title: Markenschriften selbst hosten und Renderer-Parität prüfen (Q8)
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-28T12:35:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser, Chromium-Export und iOS/Blitz müssen dieselben Fonts darstellen, ohne Google-Fonts-CDN oder andere externe Font-Requests.

Quellen: Umsetzung §§ 8.3, 17 (Q8); Referenz R1.8
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Freigegebene WOFF2-Fonts mit Latin/Latin-Ext werden versionsgesichert unter /fonts ausgeliefert und im Docker-Export verfügbar gemacht.
- [ ] #2 Browser und Chromium rendern dieselbe Referenz; Export wartet auf document.fonts.ready.
- [ ] #3 Blitz-URL-Laden ist geprüft und die notwendige URL- oder Bundle-Lösung dokumentiert und umgesetzt; externe Font-Requests bleiben aus.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add pinned core WOFF2 assets and same-instance delivery
2. Prove delayed-font Browser/Chromium parity
3. Verify Blitz URL-loaded WOFF2 rendering
4. Integrate supplied LumiosBrush-Regular and LTKai-Regular
5. Run full verification and record evidence
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope decision: external font-request ban covers frames/exports only; app shell and Storybook stay unchanged.
Font decision: include static Sofia Sans, Sofia Sans Condensed, Roboto plus user-supplied LumiosBrush-Regular and LTKai-Regular. User owns license clearance for the two additional fonts; original files will be supplied under /tmp/opencode/prowin-fonts. No PDF extraction or fallback coverage.
Implementation plan: docs/superpowers/plans/2026-10-27-prowin-brand-fonts.md
Baseline: bun install succeeded. Full bun run test hit the 120s command limit; unrelated existing failures were drawingBrowser.test.ts "handles a drag that ends before its iframe hit test returns (cancel: false)", legacyPagesMigration.test.ts "persists legacy membership before reordering, including after reopening the database", and prowinMigration.test.ts "migrates legacy workspace authors and invitations without granting instance administration". No TASK-25 code has changed yet.

Progress: core font assets and same-instance delivery implemented (12 static WOFF2 + OFL licenses); Vite/Express CORS path and Docker-bound dist output verified. Browser/Chromium delayed-font reference is pixel-identical, Latin + Latin-Ext requests are same-instance only, and stalled-font waiting is bounded. Targeted suite: 3 files/6 tests PASS; typecheck, lint and build PASS.
Blitz: loopback render-vs-fallback ABI test added and Q8 URL solution documented, but execution is blocked by missing Linux build dependencies (pkg-config plus OpenSSL/fontconfig development files). Temporary Cargo changes were reverted; no Blitz runtime claim yet.
Additional fonts: /tmp/opencode/prowin-fonts is still empty. LumiosBrush-Regular and LTKai-Regular cannot be integrated until the user-supplied originals arrive. No acceptance criterion checked yet; task remains In Progress.

Blitz verification passed on 2026-10-28: prowin_brand_font_urls_render_real_woff2_instead_of_fallback fetched the expected WOFF2 files from a loopback server and rendered output differed from the missing-font control (1 passed, 0 failed). Used isolated Rust toolchain and /tmp/opencode sysroot; no system install and no retained Cargo dependency changes. Q8 host-side URL solution verified; Apple simulator/device presentation remains a separate manual check.

2026-10-28: Nutzer hat ausdrücklich das Zusammenführen der Ergebnisse von TASK-25 und TASK-26 nach main angefordert. Vorhandenen Stand einschließlich Kernfonts, Browser-/Chromium-Anbindung, Blitz-ABI-Test und Dokumentation dafür sichern. LumiosBrush-Regular und LTKai-Regular sowie manuelle Apple-Abnahme bleiben offen; kein automatisches Done.

2026-10-28 Integration: Ergebnisse als Commit 00deb31 gesichert und mit TASK-26 zusammengeführt. Die neueren Fonttests aus TASK-26 behalten ihre isolierten Vite-Caches; Kernfontdateien, Paketpins und Renderer-Code stimmen überein. Blitz-ABI-Test und Dokumentation aus TASK-25 werden vollständig übernommen. Status bleibt In Progress; zwei zusätzliche Fonts und manuelle Apple-Abnahme bleiben offen.

2026-10-28 Merge-Verifikation: zusammengeführter TASK-25/26-Stand besteht 14 Dateien/110 gezielte Tests sowie Typecheck, Lint und Build. Zwei Fonttest-Konflikte aufgelöst; keine offenen Konflikte. Keine erneute Rust-/Apple-Ausführung; vorhandene TASK-25-Evidenz bleibt unverändert.
<!-- SECTION:NOTES:END -->
