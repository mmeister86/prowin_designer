---
id: TASK-19
title: M1 abnehmen und erhaltene Kernfunktionen prüfen
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-25T09:07:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies:
  - TASK-3
  - TASK-4
  - TASK-5
  - TASK-6
  - TASK-7
  - TASK-8
  - TASK-9
  - TASK-10
  - TASK-11
  - TASK-12
  - TASK-13
  - TASK-18
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Einzelne Entfernungen können gemeinsame Funktionen treffen. M1 benötigt deshalb eine gemeinsame Abnahme über alle beschlossenen Bereinigungen.

Quellen: Umsetzung §§ 6, 14 (M1)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Keine entfernte Integration bleibt über UI, API, MCP oder Konfiguration aktiv; Ausnahmen aus den Vorschlägen sind begründet.
- [x] #2 bun run typecheck und die Testsuite bestehen.
- [x] #3 Local Agent, Web/Desktop/iOS, APNs, Webhooks, Workspaces, Gallery, Memory und MCP sind erhalten; optionale Pexels-Suche bleibt key-gesteuert.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. M1-Entfernungen und begründete Ausnahmen über UI, API, MCP und Konfiguration prüfen.
2. Erhaltene Kernfunktionen und Screenshot der Einstellungen gegen Rollen- und Funktionsverträge prüfen.
3. Typecheck und vollständige Testsuite in isolierten Prüfgruppen ausführen; konkrete Regressionen beheben.
4. Abnahmematrix, Nachweise und native beziehungsweise Live-Testgrenzen dokumentieren; unabhängige Nachprüfung durchführen.
5. Nutzerabnahme einholen; Status bis dahin In Progress belassen.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Statische Audits durch Spock (Entfernungen) und Furiosa (Kernfunktionen) ohne aktivierbaren Restpfad oder konkrete Kernfunktionsregression. Screenshot ist laut Nutzer aktueller Prüfstand: Branding M3, zentrale Bildmodelle bis TASK39, proWIN-Desktop-Auslieferung TASK50.
Pexels-Key-Gating/MCP und Memory-Annahme/Ablehnung samt Rechten, Referenzen und Neustart neu getestet (4 Tests grün). Bisherige komplette Suite 976+4 Tests grün.
CodeRabbit-Runde1: 89 Dateien, ein Minor zu leerer Systemnachricht; mit zwei roten Fetch-Grenztests reproduziert, Transport lässt leere/Whitespace-Systemnachrichten nun weg. Gezielter Green-Lauf 65/65 Tests. Abschließende Gesamtsuite und Nachprüfung laufen.
Abnahmematrix: docs/prowin/m1-abnahme.md. Standard-Lint weiterhin mit 14 bekannten no-undef-Altfehlern in ignorierter lokaler data/requesty-evaluation/run-checks.mjs; keine native oder produktive Abnahme behauptet.

Leia-Nachprüfung: beide Minor geschlossen (positive Referenzpersistenz über Neustart, konsistente zentrale Bildkostenhinweise); keine konkreten neuen Findings. Statische M1-Prüfung AC1/AC3 verifiziert; native Build-/Geräteausführung und Live-Provider-Garantien ausdrücklich nicht behauptet. CodeRabbit-Runde2 Minor zur alten Kontenpriorität in .env.example korrigiert, finale Nachprüfung läuft.

CodeRabbit-Runde3 vollständig (94 Dateien): vier Major-Verdachtsfälle geprüft. Admission-Catch und beide Modell-Default-Verdachtsfälle sind bereits durch residentAdmission/env geschützt. Providerfehlergrund hingegen bestätigt: generisches Retry bei 401/Policy-404. Zwei neue Resident-Integrationstests rot reproduziert; typisierte Fehler ergeben nun festen Administratorhinweis ohne interne Details. Gezielter Green-Lauf 25/25 Tests samt Typecheck.
Eine parallel gestartete Build-Paketierung störte einen Zwischenlauf der Browserfixtures; danach strikt isolierter Lauf 136 Dateien/982 Tests plus Extension4 grün. Finale Prüfung mit den beiden neuen Providerfehlertests läuft nun vollständig und sequenziell einschließlich anschließendem Build. Keine Änderungen an Fixtures/Code während dieses finalen Laufs geplant.

Abschließender sequenzieller Green-Lauf nach allen Codekorrekturen: bun run typecheck; Hauptsuite 136 Dateien/984 Tests (106,90s); Claude-Extension1Datei/4Tests (16,27s); bun run build; Gesamtprozess Exit0. Gesamt137Dateien/988Tests, keine Skips. Oxlint und ESLint ohne genau das lokale Evaluationsskript grün; Standardlint14Altfehler unverändert. Prettier, diffcheck und doclint ohne Warnungen grün.
Leia-Runde3 PASS: Providerfehlerklassifizierung ohne Leak, Fixture/Tests und Triage der drei bereits abgefangenen Major-Verdachtsfälle bestätigt; keine neuen Findings.
Alle drei Akzeptanzkriterien technisch verifiziert. Bericht docs/prowin/m1-abnahme.md enthält Umfang, Screenshot-Einordnung, erhaltene Kernfunktionen, Testkommandos, Review-Triage und native/Live-Grenzen. Nutzerabnahme offen, Status bewusst In Progress. Keine Commits, keine produktiven Migrationen oder bezahlten Inferenzaufrufe.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

M1-Bereinigung und erhaltene Kernfunktionen geprüft; begründete TASK-12-Ausnahmen sowie native und Live-Testgrenzen in docs/prowin/m1-abnahme.md dokumentiert. Pexels-Key-Gating, Memory-Routen und Persistenz abgesichert; leere Requesty-Systemnachrichten und Providerfehlerhinweise korrigiert. Abschließend 988 Tests in 137 Dateien, Typecheck und Build bestanden; unabhängige Nachprüfung PASS. Bekannte 14 Lint-Altfehler im lokalen Evaluationsskript separat dokumentiert. Vom Nutzer am 25.10.2026 ausdrücklich zur Schließung als Done abgenommen.
<!-- SECTION:FINAL_SUMMARY:END -->
