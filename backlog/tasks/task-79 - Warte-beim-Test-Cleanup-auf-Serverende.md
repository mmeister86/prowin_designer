---
id: TASK-79
title: Warte beim Test-Cleanup auf Serverende
status: In Progress
assignee: []
created_date: '2026-11-01T10:21:00Z'
updated_date: '2026-11-01T11:53:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #7 auf f49fd6f ist durch wiederholtes ENOTEMPTY beim frameHidden-Test-Cleanup blockiert. tests/harness.ts stop() sendet proc.kill() und entfernt das PGlite-Verzeichnis sofort, ohne auf stopped zu warten. Korrigiere die gemeinsame Shutdown-Reihenfolge separat von TASK-30 und pruefe alle Stop-/Reboot-Caller, statt nur eine Suite zu umgehen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Das Test-Datenverzeichnis wird erst nach dem Ende des schreibenden Serverprozesses entfernt.
- [x] #2 Bestehende Stop-/Reboot-Caller behalten ihre KeepData- und Persistenzsemantik; asynchrone Fehler bleiben sichtbar.
- [ ] #3 Ein deterministischer Regressionstest belegt die Shutdown-/Cleanup-Reihenfolge, und der betroffene CI-Shard besteht ohne erhoehte Timeouts.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Cleanup-Reihenfolge mit deterministischem Regressionstest reproduzieren
2. Gemeinsamen Stop-Pfad minimal korrigieren und alle Stop-/Reboot-Caller pruefen
3. Gesamtsuite und CI verifizieren; TASK-30/79 bis Nutzerabnahme offen lassen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nutzer fordert am 01.11.2026 weiteres Babysitting bis alle Tests durchlaufen. Minimaler Harness-Fix als notwendiger CI-Blocker fuer PR #7; kein Merge. CI-Versuche 1 und2 auf f49fd6f scheitern beide bei frameHidden-Testteardown mit ENOTEMPTY; Shard4 besteht beim zweiten Versuch.

TDD: Neuer Realserver-Test reproduziert vor dem Fix deterministisch zu fruehes Entfernen des Datenverzeichnisses (erwartet vorhanden, tatsaechlich entfernt); KeepData-/Authentifizierungs-Reboot-Test besteht bereits. Fix: stop() wartet auf Prozessende vor rmSync und liefert die Cleanup-Promise zurueck. Alle 62 bestehenden Stop-Aufrufe geprueft: direkt zurueckgegebene Hooks warten automatisch; Block-Hooks, finally- und Reboot-Caller warten jetzt explizit auf stop(). Keine Produktionsdatei und kein Timeout geaendert. Fokussiert 4 Dateien /9 Tests PASS; Typecheck/Lint/Format/Build/Diff PASS. Gesamtsuite und CI noch ausstehend.

Erster Gesamtlauf nach Fix: 191 Dateien bestanden /1 fehlgeschlagen; 1610 Tests bestanden /1 fehlgeschlagen. Unveraenderte Suite elementPanelBrowser.test.ts scheitert bei Drag-Cancel an detached Frame (Zeile903); sie nutzt den geaenderten Server-Harness nicht. Kein erneuter ENOTEMPTY-Fehler. Isolierter Nachlauf und frische Gesamtsuite laufen; AC3 erst nach gruener CI verifiziert. Fehler wird nicht durch fokussierte gruene Nachlaeufe ersetzt.
<!-- SECTION:NOTES:END -->
