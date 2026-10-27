---
id: TASK-71
title: Behebe iOS- und Undo-CI-Fehler
status: Done
assignee: []
created_date: '2026-10-27T11:37:00Z'
updated_date: '2026-10-27T12:49:00Z'
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
- [x] #1 Die native Kontingent-Meldung und ihre Swift-Contract-Prüfung stimmen semantisch überein; DoopCoreChecks bestehen auf einem Swift-fähigen System.
- [x] #2 Inline-Text und Geometrie bleiben beim Scrub/Undo getrennte, datenverlustfreie Schritte; der betroffene Browsertest ist deterministisch abgesichert.
- [x] #3 Gezielte Regressionen, vollständige verfügbare Qualitätsprüfungen und tatsächliche GitHub-CI-Ergebnisse sind dokumentiert; native Prüfgrenzen werden offen benannt.
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

PR erstellt und Fix gepusht: https://github.com/mmeister86/prowin_designer/pull/3, Head651a79742a3d1d386321664c0b0352b2c4196e22. GitHub-CI40504394710 vollständig erfolgreich: alle vier Test-Shards, Sammelcheck, Typecheck, Lint, Build und Commit-Titel. Native CI40504394715 vollständig erfolgreich: Blitz-Bridge, Check core contracts (DoopCoreChecks), Canvas-Verbindungen und iPhone-/iPad-App-Build. Damit native Prüfung auf Swift-fähigem macOS tatsächlich belegt, nicht nur aus dem Literal abgeleitet.
Abschlussaudit nach Watcher-Ereignis: neu abgefragter PR-Head unverändert651a797, mergeable/CLEAN,0Commits hinter frisch gefetchtem origin/main,0unaufgelöste Threads; keine neuen Review-Befunde. CodeRabbit übersprang automatisches Review (advisory, kein Gate); Leia hat unabhängig geprüft.
T3-Link-/Listen-Tools sind im aktuellen Harness unbekannt; T3-Verknüpfung wurde NICHT bestätigt. Installiertes babysit-pr/pr-wait diente als einzelner Ersatz-Watcher. Dessen erste Ausführung scheiterte an System-gh2.46 ohne checks--json. Offizielles gh2.103.3 nur unter /tmp/opencode/task-71-gh heruntergeladen, SHA256 gegen Release-Checksummen geprüft; kein Systemupgrade. Zweiter Watcher endete erfolgreich:9pass (gleichnamige Build-Jobs zusammengefasst), CodeRabbit skipped, CLEAN,0behind.
Alle AC technisch verifiziert; Status bleibt ausdrücklich In Progress bis zur manuellen Nutzerabnahme. Kein Merge. Diese abschließenden CLI-Task-Nachweise bleiben lokal zur Abnahme; der verifizierte Produkt-Commit wurde danach nicht verändert.

Nutzerabnahme und Abschlussfreigabe erhalten. GitHub bestätigt PR #3 als MERGED, Merge-Commit adda011f490531f05402cf3081a7a8c16ff4614c. Status auf Done gesetzt; keine weiteren Produktänderungen oder erneuten Testläufe für diesen reinen Metadatenabschluss.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Beide CI-Ursachen behoben: iOS-Contract auf Agentenkontingent korrigiert; korrelierte Edit-Exit-Barriere wartet vor Undo auf Snapshot und PATCH, vermeidet redundante Writes und wird beim Unmount freigegeben. Deterministische Regressionen, 1345 lokale Tests und Web-/iOS-CI erfolgreich; unabhängiges Review ohne Befunde. PR #3 am 27.10.2026 um 12:45:25 UTC als adda011f490531f05402cf3081a7a8c16ff4614c gemergt. Nutzer hat mit „PR ist gemerged, task done“ ausdrücklich abgenommen und den Task-Abschluss freigegeben. Vereinfachung geprüft: bestehendes trackSave wiederverwendet, keine neue Abhängigkeit und keine Testtimeout-Erhöhung.
<!-- SECTION:FINAL_SUMMARY:END -->
