---
id: TASK-71
title: Behebe iOS- und Undo-CI-Fehler
status: In Progress
assignee: []
created_date: '2026-10-27T11:37:00Z'
updated_date: '2026-10-27T12:30:00Z'
labels: []
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach dem Push von ef9a37d scheitern GitHub Actions: iOS DoopCoreChecks in NativeMessagesTests.swift:11 und CI-Test-Shard 2 in elementPanelBrowser.test.ts:913. Ursachen belegen und minimal korrigieren; keine Tests deaktivieren, keine pauschalen Timeout-Erhöhungen und kein Upstream-Sync als Nebeneffekt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Die native Kontingent-Meldung und ihre Swift-Contract-Prüfung stimmen semantisch überein; DoopCoreChecks bestehen auf einem Swift-fähigen System.
- [x] #2 Inline-Text und Geometrie bleiben beim Scrub/Undo getrennte, datenverlustfreie Schritte; der betroffene Browsertest ist deterministisch abgesichert.
- [ ] #3 Gezielte Regressionen, vollständige verfügbare Qualitätsprüfungen und tatsächliche GitHub-CI-Ergebnisse sind dokumentiert; native Prüfgrenzen werden offen benannt.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan: docs/superpowers/plans/2026-10-27-backlog-71.md
1. Browser-Race durch echte zurückgehaltene Exit-Nachricht und PATCH-Antwort rot reproduzieren.
2. Korrelierte Exit-Speicherbarriere vor Undo registrieren; Render-Sperre bis Persistierung, identische Snapshots überspringen.
3. iOS-Testliteral korrigieren; unveränderte Produktmeldung erhalten.
4. Lokale Prüfungen und unabhängiges Review, PR pushen und mit T3 babysit-pr überwachen. Kein automatischer Merge/Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CI-Belege für ef9a37d: CI-Run 40495927117, iOS-Run 40495927206. Drei rote Checks entsprechen zwei Ursachen: test(2) schlägt fehl, tests ist der davon abhängige Sammelcheck. Browserfall: tests/elementPanelBrowser.test.ts:913 wartet nach Undo auf width120px und läuft nach5000ms ab (1/381Tests im Shard).
iOS: Swift-Kompilation von DoopCoreChecks bestanden, danach Precondition-Trap in ios/Tests/NativeMessagesTests.swift:11. Prüfung contains("Kontingent") passt nicht zu NativeMessages.api(resident_limit) = "Dein Agentenkontingent ist aufgebraucht..."; Groß-/Kleinschreibungsfehler im Test, kein belegter Compilerfehler. Swift ist auf dem Linux-Host nicht installiert; native Ausführung muss über passende Umgebung/CI erfolgen. Spock untersucht Browser-Test, Fixture und verbundene Undo-/Editing-Pfade rein lesend. Noch keine Produktänderung.

Spock-Diagnose abgeschlossen, verbundene Codepfade vom Controller gelesen: FrameView.exitEdit sendet doop:edit(false) asynchron, schließt den Edit-Button sofort; frameRuntime.setEdit(false) erzeugt noch einen finalen Snapshot. Der doop:edited-Handler überschreibt den Store ungeprüft. history.trackSave kennt nur bereits registrierte Saves, nicht diese ausstehende Nachricht. Spock reproduzierte bei unveränderten Quellen die PATCH-Folge150->120->150, indem die echte finale Nachricht bis nach Undo zurückgehalten wurde; bei Flush-vor-Undo blieb120px korrekt. Damit belegtes Produkt-Race plus unzureichende Testbarriere, nicht nur pauschaler Timing-Flake.
Kleinster vorgeschlagener Produktfix: Exit-Flush synchron als ausstehende History-Arbeit registrieren und bis Serialisierung UND Persistierung auflösen; deterministischer Message-Holding-Regressionsfall für Text-/Geometrie-Undo. Keine Timeout-Erhöhung und keine Test-Deaktivierung. iOS separat ein Testliteral/Case-Vertrag. Umsetzung/Commit/Push noch nicht freigegeben. Neue fremde research_notes/Android Pipeline im bestehenden Repo/ bleiben unangetastet.

Nutzer hat die Umsetzung und Push ausdrücklich freigegeben und babysit-pr angefordert. Umsetzung im isolierten Worktree, anschließender Fix-PR mit T3-Watcher; keine automatische Zusammenführung. Neue AGENTS-/Android-Rechercheänderungen im Hauptcheckout bleiben unangetastet.

Isolierter Worktree task-71-ci-fixes und Branch fix/task-71-ci auf ef9a37d angelegt. Eigene CLI-erzeugte TASK-71-Metadaten unverändert in den Worktree übernommen; weitere Taskänderungen nur per CLI. Belege zu Escape-/Unmount-/Persistenzbarriere werden im begrenzten Fix mitgeprüft.

Browser-RED/GREEN belegt: vier deterministische Fälle auf unveränderten Produktionsquellen rot (redundanter PATCH, gehaltene Abschlussnachricht, gehaltene PATCH-Antwort über Button/Escape), mit Fix grün. Exit registriert korrelierten Snapshot synchron über bestehendes trackSave und löst erst nach PATCH auf; identische Snapshots werden nicht erneut gespeichert. Unmount-Regressionsfall ebenfalls grün.
Verifikation: 81 fokussierte Browser-/Runtime-Tests und CI-Shard2 mit42Dateien/385Tests bestanden. Typecheck, Lint, Format-Check, Produktionsbuild und Doc-Lint bestanden. Bekannte Warnungen: Vite-Chunkgröße, Doc-Lint stale-context und Node-localStorage. Native Ausführung weiter nur über macOS-CI möglich. Unabhängiges Gesamt-Review durch Leia und vollständige Suite laufen.
Tooling-Grenze nach Harness-Wechsel: T3-PR-/Watcher-Tools im Katalog nicht vorhanden; direkter orchestrator_capabilities-Versuch unbekannt, ACP-Fallback hat keine Node-Transportvariable. Falls dies so bleibt, nutze den vorhandenen babysit-pr/pr-wait-Einzelwatcher statt eigener Polling-Schleife; T3-Verknüpfung kann dann nicht bestätigt werden.

Vollständige Suite frisch bestanden:167Dateien/1345Tests in160.67s; initialer Gesamtlauf war vom Shell-Limit120s beendet worden, danach mit ausreichender Shell-Laufzeit vollständig grün. Keine Testtimeouts verändert. Alle verbundenen History-Tests sind in der Gesamtsuite enthalten.
Leia hat das gesamte Produktions-/Testdiff unabhängig rein lesend geprüft: keine Critical-, Important- oder Minor-Befunde. Geprüft: keine zyklische trackSave-Abhängigkeit, Snapshot/PATCH vor Undo, Legacy-no-ID-Aufrufe, Escape und Lifecycle.
Lokaler Fix zur PR-Erstellung freigabefähig; echte GitHub-CI/native Nachweise bleiben ausstehend. TASK-71 bleibt In Progress und wird ohne ausdrückliche Nutzerabnahme nicht geschlossen.
<!-- SECTION:NOTES:END -->
