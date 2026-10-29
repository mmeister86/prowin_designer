---
id: TASK-25
title: Markenschriften selbst hosten und Renderer-Parität prüfen (Q8)
status: Done
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-28T13:08:00Z'
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
- [x] #1 Freigegebene WOFF2-Fonts (Sofia Sans, Sofia Sans Condensed, Roboto, LTKai-Regular) mit ihren Lizenzdateien liegen versionsgesichert unter /fonts und im Docker-Export; für die ungeklärte LumiosBrush-Rolle (TASK-74) liefert Kaushan Script 400 als dokumentierter Platzhalter Latin und Latin-Ext unter eigenem Familiennamen.
- [x] #2 Browser und Chromium rendern dieselbe Referenz; Export wartet auf document.fonts.ready.
- [x] #3 Blitz-URL-Laden ist geprüft und die notwendige URL- oder Bundle-Lösung dokumentiert und umgesetzt; externe Font-Requests bleiben aus.
- [x] #4 Die Übergangslösung ist in DESIGN-prowin.md und docs/prowin/doop-fork-umsetzung.md als Platzhalter benannt, und die offene LumiosBrush-Lizenz ist als TASK-74 erfasst.
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

2026-10-28 Beschaffungsrecherche (nur Recherche, keine Dateien bezogen):
- LTKai-Regular: LyonsType (Daniel Lyons), SIL OFL 1.1, kommerziell frei. Offizielle Quelle lyonstype.neocities.org/fonts.html → LTKai.zip, 58.405 Bytes, Download-URL geprüft erreichbar. Keine Kosten, kein Mirror nötig. Damit ist "besorgen" hier ein normaler Download.
- LumiosBrush-Regular: My Creative Land (Elena Genova) / The Type Founders LLC, mycreativeland.com/family/lumios-brush/. Shop-Preise (1 Style Regular): Desktop 1 User 24,99 USD einmalig; 5 User 89,96; 20 User 287,39. Web-Abo 1 Jahr: 10k PV/Monat 24,99 USD; 100k 124,95; 1 Mio 499,80. App-Abo 1 Jahr: 1 App-Titel 499,80 USD (bis 25.000 MAU).
- BLOCKER Lumios: Web-EULA v1.4 untersagt (a) Einbettung außerhalb eigener Website (SaaS/Online-Produkt) und (b) Nutzung für Authoring-Tools, in denen Nutzer selbst Designs erstellen. Das trifft proWIN Designer exakt. App-EULA deckt nur Mobile-Einbettung, nicht Web/Desktop-Editor. Standardlizenzen sind damit nicht ausreichend; Custom-/OEM-Lizenz bei The Type Founders anfragen (Kontakt über mycreativeland.com/contact/), Umfang: Web-SaaS + macOS-Desktop + iOS-Blitz, Nutzer-/MAU-Zahl nennen.
- WOFF2: Web-Lizenz liefert WOFF2 direkt, Desktop-Lizenz nur OTF; eine eigene Konvertierung wäre laut EULA "modify the Software" und damit unzulässig.
- Nicht getan: keine Downloads von LumiosBrush, keine Spiegel, keine PDF-Extraktion. AC1 bleibt offen.

2026-10-28 LT Kai integriert (Restarbeit LumiosBrush offen):
- Nutzer lieferte public/fonts/LTKai-1.ttf + OFL.txt. Geprüft mit fontTools 4.68.0: name ID1 "LT Kai", ID2 "Regular", ID6 "LTKai-Regular", 219 Glyphen, 218 Codepoints (Basic Latin, Latin-1, Teile Latin-Ext-A, U+20AC, U+2122), fsType 4, OFL-Text in ID13/14. Lizenz passt zum Font (Reserved Font Name "LT Kai").
- Erzeugt: public/fonts/lt-kai-latin-400-normal.woff2 (39.720 Bytes, TTF 108.216). Lizenz als public/fonts/lt-kai-LICENSE abgelegt. Original-TTF nach /tmp/opencode/prowin-fonts/LTKai-1.ttf verschoben, damit keine Rohschrift im ausgelieferten public/-Verzeichnis liegt.
- server/prowin/brandTokens.ts: Face "LT Kai" 400 mit aus dem cmap abgeleiteter unicode-range. Damit liefert /fonts/* und dist/fonts den Font automatisch mit (Express-Static + Vite-Public-Copy, keine Whitelist).
- Tests angepasst und grün: tests/prowinFrameBrand.test.ts (13 Faces, nur Lumios bleibt verboten), tests/prowinFonts.test.ts (neuer Asset-/Lizenzcheck), tests/prowinFontsBrowser.test.ts (LT Kai im Browser/Chromium-Paritätsreferenz, 13 Font-Requests). Beide Browserfälle bestehen. Nachbarfälle: 13/14 prowin-Testdateien grün, 84 Tests grün; offen bleibt nur der vorbestehende Fehler in prowinMigration.test.ts. typecheck, oxlint und eslint sauber.
- Dokumentation nachgezogen: docs/prowin/doop-fork-umsetzung.md (13 Faces, LT Kai integriert) und DESIGN-prowin.md (Typografie-Tabelle).
- AC1 damit für LT Kai erfüllt, für LumiosBrush nicht. Kein Done.

2026-10-28 Lumios-Marker.woff NICHT integriert:
- Nutzer legte public/fonts/Lumios-Marker.woff ab ("Lumios ähnliche Marker Schrift"). Metadaten: name ID1 "Lumios Marker", Copyright 2019 Elena Genova / My Creative Land, Trademark, keine eingebettete Lizenz (kein ID13/14), 1.374 Glyphen. Das ist die echte kommerzielle Lumios Marker, kein Free-Lookalike.
- Zwei Gründe gegen Integration: (a) es ist nicht LumiosBrush-Regular aus den Magazinen, und per Plan sind Ersatzschriften ausgeschlossen; (b) dieselbe Foundry-EULA verbietet SaaS-/Authoring-Nutzung, Lizenznachweis fehlt.
- Datei vorsorglich nach /tmp/opencode/prowin-fonts/Lumios-Marker.woff verschoben, weil /fonts öffentlich ausgeliefert wird.
- Nötig: Lizenznachweis (Rechnung/Lizenztext) für Lumios Marker UND/ODER Custom-Lizenz für Lumios Brush, sonst bleibt die Brush-Rolle offen.

2026-10-28 Nutzerentscheid: bis zur Lizenzklärung ist eine dokumentierte Alternative für die Lumios-Rolle zulässig. Bisherige "keine Ersatzschrift"-Regel damit bewusst aufgehoben, aber nur für diese Rolle.
- Gewählt: Kaushan Script 400 (Pablo Impallari, Matt McInerney / Igino Marini, SIL OFL 1.1). Begründung: verbundene Brush-Pinsel-Anmutung wie LumiosBrush, Latin + Latin-Ext, selbst gehostet, kein CDN.
- Bezug: @fontsource/kaushan-script@5.3.0 (exakt gepinnt, wie die Kernfonts). Dateien kopiert: kaushan-script-latin-400-normal.woff2, kaushan-script-latin-ext-400-normal.woff2, kaushan-script-LICENSE.
- server/prowin/brandTokens.ts: zwei Faces "Kaushan Script" 400 (Latin-Ext, Latin). Damit 15 @font-face im kanonischen Frame-Block.
- Bewusst NICHT als "Lumios Brush" benannt: eigener Familienname, weil "Lumios Marker" eine Marke von My Creative Land ist und eine Umbenennung fremder Schriften unzulässig wäre. Kosten der Entscheidung: Frames, die den Platzhalter nutzen, tragen später einen anderen Familiennamen als die echte Markenschrift.
- Tests angepasst und grün: tests/prowinFrameBrand.test.ts (15 Faces), tests/prowinFonts.test.ts (Byte-Gleichheit mit dem gepinnten Fontsource-Paket plus OFL-Lizenz), tests/prowinFontsBrowser.test.ts (Kaushan in der Browser/Chromium-Parität, 15 Font-Requests). typecheck, oxlint und prettier sauber.
- Dokumentation: docs/prowin/doop-fork-umsetzung.md (15 Faces, Platzhalter benannt) und DESIGN-prowin.md (Typografie-Tabelle).
- Verworfen: Satisfy (Apache-2.0, nur Latin), Grand Hotel (zu retro/formell), Caveat Brush (Buchstaben nicht verbunden). Vergleichsbild im Thread gezeigt.
- Restarbeit unverändert: LumiosBrush-Regular braucht eine Custom-Lizenz, AC1 dafür offen. Kein Done.

2026-10-28 Abschluss auf ausdrücklichen Nutzerwunsch:
- AC1 nach Nutzerentscheid angepasst: freigegeben sind die 12 Kern-WOFF2, LTKai-Regular und Kaushan Script als dokumentierter Platzhalter für die ungeklärte LumiosBrush-Rolle. Kaushan Script läuft unter eigenem Familiennamen, nicht als "Lumios Brush".
- AC4 neu aufgenommen: Übergangslösung in DESIGN-prowin.md und docs/prowin/doop-fork-umsetzung.md benannt; offene Lizenz als TASK-74 erfasst.
- Verifikation: bun run build grün, dist/fonts enthält lt-kai-* und kaushan-script-* (Docker-Export damit abgedeckt). Browser-/Chromium-Parität 2/2 grün mit 15 Font-Requests. prowinFrameBrand und prowinFonts 17/17 grün. typecheck, oxlint, prettier sauber.
- Grenze: AC2 host-seitig belegt. Die Blitz-URL-Lösung ist host-seitig verifiziert (docs/prowin/doop-fork-umsetzung.md, Q8); die Apple-Simulatorprüfung bleibt als manuelle Abnahme offen.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selbst gehostete Markenschriften unter /fonts mit Lizenzdateien: Sofia Sans 300/500, Sofia Sans Condensed 700, Roboto 300/500/900 (je Latin und Latin-Ext), LTKai-Regular (SIL OFL 1.1, aus Nutzer-TTF konvertiert) und Kaushan Script 400 (SIL OFL 1.1) als dokumentierter Platzhalter für die Brush-Rolle. Kanonischer Frame-Block mit 13 CI-Tokens und 15 Fontfaces, absolute URLs derselben Instanz, Browser-/Chromium-Parität und dist/fonts im Docker-Export belegt. LumiosBrush-Regular ist kommerziell und im Editor nicht lizenziert; die Lizenzklärung läuft in TASK-74.
<!-- SECTION:FINAL_SUMMARY:END -->
