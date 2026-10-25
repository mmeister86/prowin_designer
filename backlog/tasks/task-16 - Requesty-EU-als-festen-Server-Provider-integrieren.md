---
id: TASK-16
title: Requesty EU als festen Server-Provider integrieren
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-24T20:02:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-15
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der bestehende Chat-Completions-Transport soll den Agent-Loop über Requesty bedienen, ohne eine neue Provider-Abstraktion oder benutzerdefinierte Ziel-URLs einzuführen.

Quellen: Umsetzung §§ 7.1–7.3; Referenz R4.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Agent-Loop, Tool-Calls und Vision funktionieren über den geprüften EU-Endpunkt und die konfigurierte Policy.
- [x] #2 REQUESTY_API_KEY, Agent-Modell und Operator-URL sind dokumentiert; fehlender Key deaktiviert den Server-Tier kontrolliert.
- [ ] #3 RESIDENT_TASK_LIMIT ist für den Test nutzbar und Requesty begrenzt das Budget; Fehler und Fallbacks sind getestet.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Geprüfte Requesty-EU-Konfiguration und bestehende Server-/Resident-Pfade abgleichen.
2. Requesty als Standard-Serverprovider über den bestehenden Chat-Completions-Transport ergänzen; fehlenden Key und Serverfehler kontrolliert behandeln.
3. Providerwahl, Tool-/Vision-Rundlauf, Budgetfehler, Fallback-Antwort und Task-Limit testen.
4. Operator-Konfiguration dokumentieren, vollständige Checks ausführen und zur manuellen Abnahme bereitstellen; Status bis zur Bestätigung In Progress.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Implementiert: Requesty EU als Default-Serverprovider; vorhandener Chat-Completions-Transport mit policy/prowin-layout-gen, Tool-Calls und Vision. Fehlender Key deaktiviert den Server-Tier ohne Anthropic-/Azure-Fallback. EU-URL am Boot validiert; HTTP-Redirects abgelehnt. Explizites Anthropic behält Legacy-Modellstandard. Boot-Log zeigt Bereitschaft und Task-Limit.
Verifikation: 46 gezielte Tests grün (Provider, echte Resident-/Frame-/Screenshot-Integration mit simuliertem Upstream, Task-Limit und Budgetfehler), Typecheck und Build grün. Live-Smoke über den neuen Serverpfad: 2 EU-Requests, Tool-Call plus Bildcode korrekt, 0.00272525 USD; Evidenz docs/prowin/evidence/requesty-server-smoke-2026-10-24.json.
Review: Spock Analyse; Ellen Ripley fand Redirect-Risiko, durch redirect:error und nativen HTTP-Regressionstest behoben. CodeRabbit lieferte zwei major-Kontexthinweise: automatischen Legacy-Key-Fallback wegen bewusstem Requesty-Standard nicht übernommen; expliziten Upgradepfad dokumentiert. Policy-Provisionierung für aktuellen Key live bestätigt und Voraussetzung für andere Keys dokumentiert.
AC3: Task-Limit und simulierte HTTP-Fehler/Fallback-Antworten geprüft. Einrichtung des echten Key-Budgets laut Betreiber in TASK-15 bestätigt; echtes Budgetlimit und jede konkrete EU-Fallback-Stufe nicht erneut ausgelöst/geprüft. Daher AC3 bis zur manuellen Betriebsabnahme offen.
Lokale .env für Tests auf Requesty, geprüfte EU-URL, policy/prowin-layout-gen und RESIDENT_TASK_LIMIT=1000 gesetzt; vorhandener Key unverändert. Betriebsanleitung: docs/prowin/requesty-server.md, README und .env.example. Task17/18 (Distiller/BYO) nicht vorgezogen. Status bleibt In Progress bis zur ausdrücklichen Nutzerabnahme.

Abschließende Checks: Gesamtsuite 950 bestanden / 2 fehlgeschlagen (134 Dateien). Beide Ausfälle im unveränderten tests/drawingBrowser.test.ts: "types literal multiline text without triggering shortcuts, and cancels empty or escaped drafts" (drawingHarness undefined) und "preserves transformed shape geometry across moves: rotate(30deg) scale(1.5)" (Moving-drawing-Timeout). Baseline zeigte bereits einen anderen Timeout im selben Testfile; dieser frühere Fehler besteht beim Einzeltest nicht. Keine Task-16-Tests fehlgeschlagen.
Globales Lint: 14 bestehende no-undef-Fehler in data/requesty-evaluation/run-checks.mjs. ESLint/Oxlint für sämtliche Task-16-Code-/Testdateien grün; Formatcheck grün, git diff --check sauber. doc-lint bestanden mit Hinweis auf älteren .context-Stand. Build und Typecheck bestanden.

Isolation der beiden abschließenden Browser-Ausfälle: Beide gezielt zusammen erneut ausgeführt und bestanden (2 passed, 24 skipped). Gesamtsuite bleibt als nicht vollständig grün dokumentiert; wechselnde Ausfälle betreffen ausschließlich das unveränderte Browser-Testfile.

Ausdrückliche Nutzerabnahme: „sieht gut aus. task done“. TASK-16 wird auf dieser Grundlage geschlossen. Die technischen Prüfgrenzen zu AC3 bleiben dokumentiert; die Abnahme wird nicht als zusätzlich ausgeführter Budget-/Fallback-Livetest gewertet. Vereinfachung vor Abschluss geprüft: bestehender Transport und Providerauswahl weiterverwendet, keine zusätzliche Abstraktion erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Requesty EU als Standard-Serverprovider über den bestehenden Chat-Completions-Transport integriert, inklusive Tool-Calls, Vision, geprüfter Policy, kontrollierter Abschaltung ohne Key und Redirect-Schutz. Konfiguration und Upgradepfad dokumentiert; lokale Testkonfiguration vorbereitet. 46 gezielte Tests sowie Typecheck und Build bestanden; Live-Tool-/Vision-Smoke erfolgreich. Bestehende Gesamttest-/Lint-Befunde und fehlende vollständige Budget-/Fallback-Livenachweise bleiben dokumentiert. Vom Nutzer ausdrücklich abgenommen mit „sieht gut aus. task done“.
<!-- SECTION:FINAL_SUMMARY:END -->
