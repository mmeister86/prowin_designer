---
id: TASK-2
title: proWIN-Konventionen und Upstream-Pflege dokumentieren
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-0
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Fork soll Upstream-Fixes weiterhin übernehmen können. Die vorhandenen proWIN-Dokumente müssen für Coding-Agents verbindlich auffindbar sein.

Quellen: Umsetzung §§ 6, 15; Referenz R7
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 CLAUDE.md benennt die proWIN-Quellen, Requesty-EU-Vorgabe, Datenschutz-Guard und isolierte prowin-Verzeichnisse.
- [x] #2 Upstream-Remote ist geprüft; separater Merge-Branch und Prüfungen im Rhythmus von zwei bis vier Wochen sind dokumentiert.
- [x] #3 Entfernungen erfolgen pro Feature in eigenem Branch und Commit mit Typecheck und passenden Tests; verworfene Architekturansätze bleiben ausgeschlossen.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

2026-10-23: Verbindliche proWIN-Regeln in `CLAUDE.md` ergänzt, einschließlich Quellen,
Requesty EU, geplantem Datenschutz-Guard, isolierten Verzeichnissen, Ausschlüssen und
Feature-Entfernungs-/Upstream-Ablauf. Offene Entscheidungen bleiben als solche gekennzeichnet.

Das zuvor fehlende lokale Remote `upstream` auf `https://github.com/kgoedecke/doop` eingerichtet.
`git remote -v` bestätigt die Zuordnung; `git ls-remote upstream refs/heads/main` bestätigt
Erreichbarkeit und Revision `0531b70ea127a7390e1d1b2fcbb6ecfc2cafe85c`.

Prüfung: `bun run doc-lint` ohne Warnungen, `git diff --check` erfolgreich.
Nur Dokumentation und lokale Remote-Konfiguration geändert; keine Laufzeit-Tests und kein
Upstream-Merge durchgeführt.
<!-- SECTION:NOTES:END -->
