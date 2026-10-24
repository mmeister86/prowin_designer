---
id: TASK-14
title: Creator-Rolle und Berechtigungsmodell festlegen (Q4)
status: In Progress
assignee: []
created_date: '2026-10-23T09:49:00Z'
updated_date: '2026-10-24T14:21:00Z'
labels:
  - prowin
  - decision
milestone: m-4
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
  - docs/prowin/rollen-berechtigungen.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Template-Sperren und Local-Agent-Zugriff benötigen eine belastbare serverseitige Rolle. Die Workspace-Rolle ist eine Empfehlung, noch keine beschlossene Lösung.

Quellen: Umsetzung §§ 7.3, 9.3, 17 (Q4); Referenz R1.2–R1.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Admin, Creator, Beraterin und Viewer sind abgebildet; Creator-Kontostatus und Workspace-Rechte sowie Eigentumsgrenzen sind dokumentiert.
- [x] #2 Creator-Selbstregistrierung ist ohne Instanz-Adminrechte möglich. Workspace-Rollen vergibt nur der Owner; Member können ihre eigene Workspace-Rolle nicht erhöhen. Serverseitige Autorisierung ist getestet.
- [x] #3 Der Creator-Aktivierungs- und Einladungsablauf für die Testgruppe ist dokumentiert und technisch geprüft; Veröffentlichung, Frame-Sperränderungen und Local Agent sind auf berechtigte Rollen begrenzt. Reale Testgruppen-Freischaltung folgt mit benannten Konten in TASK-51/52.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Kontostatus und Workspace-Rechte getrennt implementieren und migrieren. 2. Veröffentlichung, vorhandene Frame-Sperren und Local Agent absichern. 3. UI und Q4-Dokumentation aktualisieren; Tests, Typecheck, Lint, Build und unabhängiges Review durchführen.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Entwurf am 24.10.2026 vom Nutzer freigegeben: einziger Instanz-Admin bleibt Matthias; Beraterinnen dürfen Creator selbst aktivieren, Workspace-Owner laden Creator und normale Beraterinnen ein. Umsetzung auf feat/prowin-creator-permissions. Vollständiger Template-Guard bleibt TASK-29 bis TASK-31.

Auf Nutzerentscheidung angepasst: Creator-Selbstregistrierung ausdrücklich erlaubt; normale Beraterinnen können als Member mitarbeiten. Keine produktiven Nutzerrechte verändert. Gezielte Tests für API, Migration und Warteschlangen-Rechteentzug bestehen; Gesamtprüfung und unabhängiges Review laufen.

Verifiziert: explizite Creator-Registrierung ohne Adminrechte, Owner-only Workspace-Rollen, Mitarbeit normaler Beraterinnen, Publish/Sperränderungen/MCP und Local Agent einschließlich Warteschlangen-Rechteentzug. Migration mit PGlite geprüft. Produktions-Browser-Smoke: Registrierung und Workspace-Anlage erfolgreich. Typecheck, Lint und Build erfolgreich. Trinity-Review: keine Critical/Important-Funde, ein zusätzlicher durchgehender Local-Agent-Rechteentzugstest als Minor dokumentiert. CodeRabbit-Prüfung abgeschlossen; bedingter Major-Hinweis wegen garantierter Workspace-Mitgliedschaft sachlich nicht zutreffend. Finaler Gesamttest läuft. Status bleibt gemäß AGENTS.md bis zur ausdrücklichen Abnahme In Progress.

Abschlussprüfung: 936/936 Tests in 132 Dateien erfolgreich (187 Sekunden). bun run typecheck, bun run lint, bun run build und git diff --check erfolgreich; bekannter Build-Hinweis zur Chunkgröße. Isolierter Produktions-Browser-Smoke: Creator-Aktivierung mit admin=false und anschließende Workspace-Anlage als Owner erfolgreich, keine Browser-Konsolenfehler. Rollenentscheidung und Rollout: docs/prowin/rollen-berechtigungen.md. Alle Abnahmekriterien technisch geprüft; Taskstatus bleibt bis ausdrücklicher Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
