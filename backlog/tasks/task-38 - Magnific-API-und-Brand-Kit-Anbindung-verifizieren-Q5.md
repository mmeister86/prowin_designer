---
id: TASK-38
title: Magnific-API und Brand-Kit-Anbindung verifizieren (Q5)
status: Done
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-27T21:30:45Z'
labels:
  - prowin
  - decision
  - ai
milestone: m-5
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Endpunkte, Authentifizierung und asynchrone Task-Verarbeitung sind in den Projektquellen nicht spezifiziert und dürfen nicht geraten werden.

Quellen: Umsetzung §§ 11, 17 (Q5); Referenz R4.4, R4.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Offizielle API-Dokumentation und ein kontrollierter Test belegen Auth, Endpunkte, Statusmodell, Limits und Fehlerfälle.
- [x] #2 Brand-Kit-Referenzierung ist belegt oder der Brand-Bildsprache-Prompt als Fallback festgehalten.
- [x] #3 Bekannter Stand zu Kosten, Nutzungsrechten und Verarbeitungsregionen ist samt Lücken in docs/prowin/magnific-pruefung.md dokumentiert; fehlende Nachweise sind in TASK-84 ausgelagert. Stockfoto-Nutzung bleibt eine separate offene Entscheidung.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Offizielle Magnific-OpenAPI und Rechts-/Kostenquellen verifizieren
2. Isolierte Probe und Offline-Tests mit DeepSeek V4.1 Flash 1017 implementieren
3. GPT-6.1 Terra: Task- und Branch-Review
4. Kontrollierten Live-Test nur mit Secret und ausdrücklicher Kostenfreigabe ausführen; offene Evidenz sichtbar dokumentieren
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Council: Claude Opus 5.5 7/10, GPT-6.1 Sol 8/10, Muse Wonder 8/10 (Vorgehensreife). Empfehlung: reine API-Verifikation, keine TASK-39-Integration. TASK-37 bleibt unabgenommen.

Implementiert: docs/prowin/magnific-pruefung.md, isolierte kostenpflichtig gesperrte Probe und 38 Offline-Tests. DeepSeek V4.1 Flash 1017: 3d8f703. Terra-Taskreview 7/10; alle drei Befunde korrigiert in fc04cf7, Terra-Fixreview 9/10 freigegeben.
Verifikation: 240 Dateien / 2200 Tests bestanden; Typecheck, Lint, Doc-Lint (1 Freshness-Warning), gezielte Formatprüfung und Dry-Run bestanden.
AC2 belegt: Brand-Bildsprache aus DESIGN-prowin.md §7 als expliziter Fallback; keine globale Behauptung, Brand Kits seien überall unverfügbar.
Blocker AC1: kein autorisierter Live-Lauf/kein API-Key. Blocker AC3: Preis medium/1k passt nicht zur offiziellen Preistabelle; Account-Preis/Cap, API-Nutzungsrechte/Attribution, DPA, Subprozessoren, Regionen und Retention noch zu bestätigen. Kein API-Aufruf, kein Secret gelesen. TASK-37 bleibt unberührt/unabgenommen. Stock-Entscheidung bleibt separat offen.
Status bleibt In Progress: Projekt erlaubt kein Blocked; Blocker stehen daher in diesen Notizen.

Abschlussprüfung: Terra-Gesamtreview 7/10 fand UUID-Schlüssel-Echo und verlorene Teilevidenz. In 5d24167 mit Regressionstests behoben; Terra-Abschlussreview 9/10, beide Befunde adressiert, keine neuen Findings. Finale Verifikation: 43 Probe-Tests; 240 Testdateien / 2205 Tests; Typecheck/Lint/Format/Doc-Lint/Dry-Run erfolgreich (1 Doc-Freshness-Warning, bekannte Testausgabe-Warnungen). Kein echter Provider-Aufruf, kein echter Key, kein Push/PR/Merge. TASK-38 bleibt In Progress; AC1/3 offen, AC2 verifiziert. Bericht: docs/superpowers/reports/2026-11-06-magnific-verification.md.

2026-11-09: Nutzer autorisiert genau einen kostenpflichtigen Live-Test und bestätigt ein für ihn akzeptables Credit-Ausgabenlimit im Magnific-API-Keys-Dashboard. Key ausschließlich über private T3-Datei bereitgestellt. Exakter medium/1k-Preis bleibt unbekannt; Test erfolgt auf Basis des ausdrücklich bestätigten Anbieter-Limits, ohne POST-Wiederholung. Live-Ergebnis folgt separat.

2026-11-09 Live-Ergebnis: bestehende Probe genau einmal mit privater Key-Datei ausgeführt, Exit 0. Ein POST + sieben GETs, alle HTTP 200; CREATED → IN_PROGRESS → COMPLETED; generatedCount=1. Kein POST-Retry, kein Bilddownload, kein Runtime-Code geändert. Bereinigter Nachweis: docs/prowin/evidence/magnific-live-2026-11-09.json.
AC1 verifiziert durch offizielle Doku plus kontrollierten erfolgreichen Live-Lauf; Limits und Fehlerfälle bleiben Doku-/Mock-Evidenz, kein Lasttest. AC2 bleibt verifiziert. AC3 bleibt offen: konkrete Credit-Abbuchung/Preis nicht unabhängig nachgewiesen; Nutzer bestätigt akzeptables Anbieterlimit, dessen Betrag hier nicht bekannt ist; Rechts-/Attributions-/DPA-/Regionsnachweise weiterhin offen. TASK-38 bleibt In Progress; keine implizite Abnahme, TASK-37 unverändert.

2026-11-27: Nutzerabnahme. AC3 auf dokumentierten Kenntnisstand eingegrenzt; offene Nachweise (Credit-Preis/Abbuchung, Output-Rechte und Attribution, DPA/Subprozessoren/Regionen/Retention) in TASK-84 ausgelagert, die TASK-41 (M5) blockiert. Brand-Kit-Frage Q5 bleibt offen, Fallback DESIGN-prowin.md §7. TASK-39 nicht begonnen.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Magnific-One-API anhand offizieller Doku, 43 Offline-Tests und eines autorisierten Live-Laufs (09.11.2026, CREATED → IN_PROGRESS → COMPLETED) verifiziert. Brand-Bildsprache-Fallback festgehalten. Kosten-, Rechts- und DPA-Lücken dokumentiert und an TASK-84 übergeben.
<!-- SECTION:FINAL_SUMMARY:END -->
