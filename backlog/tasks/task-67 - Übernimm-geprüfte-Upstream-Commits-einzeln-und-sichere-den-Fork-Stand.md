---
id: TASK-67
title: Übernimm geprüfte Upstream-Commits einzeln und sichere den Fork-Stand
status: In Progress
assignee: []
created_date: '2026-10-25T12:19:00Z'
updated_date: '2026-10-25T17:39:00Z'
labels: []
dependencies: []
priority: high
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Den Stand 2272d9d als Backup erhalten und die 17 geprüften Web-/Server-Commits bis aa04e95 einzeln mit Tests und unabhängigen Reviews in einem isolierten Branch übernehmen. iOS bf3ebac bleibt bis zu einem iOS-Build zurückgestellt. Keine Wiederaufnahme entfernter Integrationen; kein Push oder Merge nach main.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backup-Branch und externes Git-Bundle sind erstellt und verifiziert
- [x] #2 Alle 17 ausgewählten Upstream-Commits sind einzeln mit Herkunft und gezielten Testergebnissen dokumentiert
- [x] #3 Requesty, PII-Redaktion, Boot-Guard, Creator-Rechte und entfernte Integrationen bleiben erhalten
- [x] #4 Abschließende Tests, Typecheck, Lint, Build und unabhängiges Gesamt-Review sind dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Backup verifizieren und isolierten Branch mit sauberer Test-Baseline vorbereiten
2. Die 17 Web-/Server-Commits bis aa04e95 einzeln mit gezielten Tests und Reviews übernehmen
3. Vollständige Tests und Fork-Regressionsprüfungen ausführen
4. Gesamt-Review und Übergabe ohne Push/Merge; Status bis manueller Bestätigung In Progress lassen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backup: refs/heads/backup/pre-upstream-2026-10-25-2272d9d; externes und verifiziertes Bundle /home/matthias/code/prowin_designer-backups/pre-upstream-2026-10-25-2272d9d.bundle. Ausgangs-HEAD 2272d9d3056588c92af5c1a28974bdb04d90fe5c. Git-Backup enthält Versionshistorie; ignorierte .env-/Laufzeitdaten werden nicht verändert und sind nicht Teil des Bundles.

Backup zusätzlich wiederhergestellt: Bundle in separates Bare-Repository /tmp/opencode/task67-restore-check-0unXBk/repo.git geklont; git fsck --full erfolgreich, HEAD exakt 2272d9d3056588c92af5c1a28974bdb04d90fe5c. Unreferenzierte T3-Checkpoint-Commits im Single-Branch-Restore sind erwartete zusätzliche Bundle-Objekte, keine Integritätsfehler.

Alle17Source-SHAs eindeutig separaten lokalen Commits zugeordnet, Autoridentitäten geprüft; iOSbf3ebac ausgelassen. Controller-Gesamtsuite147Dateien/1148Tests bei4Workern erfolgreich, Typecheck0. Geschützte Requesty/Auth/PII/Guard/Creator/Schema/Migrations-/Dependency-/iOS-Dateien bytegleich Ausgangsstand; entfernteModule weiterhin abwesend, main unverändert. Controller-Lint findet in FrameView:611 fehlendeEffect-Abhängigkeit probe; wird in finaler Fixwelle behoben, Abschluss-AK4 noch OFFEN. Finales Gesamt-Review folgt.

Finale Fixwelle1ec5dc3: drei reproduzierte Important-Befunde und zwei inertePostHog-Mocks behoben; gezielt269Tests, gesamte4Worker147Dateien/1159Tests, Typecheck/FULLLint/Build/DocLint/Format erfolgreich. Nachreview bestätigt I1-I3/M1 ADDRESSED, findet aber NEUEN ImportantI4: Transfer→eigenesLock/Hide→UndoSchalter→UndoTransfer erzeugt falschen Konflikt/Duplikat wegen undefined!==false in sameTransferState. Reproduziert, echter Funktionsfehler; KEINE Merge-Freigabe/keinAbschluss-AK4. Vorgesehene kleine Korrektur: !!hidden/!!locked vergleichen, Version/andereFelder unverändert, eigener Regressionstest. Nach begrenzter finalerFixwelle+Nachreview bleibt I4 zur Benutzerentscheidung offen; Branch/Logs/Backup erhalten, main unberührt. NeuerMinorM2: RectRefresh öffnet bewusst geschlossenesDesignpanel. Dokumentation docs/prowin/upstream-adoption-2026-10-25.md aktualisiert.

Benutzer hat I4-Fix ausdrücklich freigegeben und weitere unnötige Prozessstopps beanstandet. TASK67.11 übernimmt nur Boolean-Normalisierung+Regression, ein enges Review und finale Prüfungen; keine neue breite Reviewwelle und kein Funktionsausbau. Vorherige Gesamtwellen-Grenze gilt nicht als Stop für diese neue explizite Freigabe.

Abschlussfreigabe zur manuellen Abnahme: I4 in e4d38b7 korrigiert und gezielt unabhängig freigegeben (Spec/QualityPASS, keine offenen Critical/Important). Letzte vollständige4Worker-Suite147Dateien/1161Tests0, Typecheck/FULLLint/Build/DocLint0; geänderteSource- und Übergabedokumente formatiert. Alle17individuellenUpstream-Commits/Backup/main unverändert erhalten. Keine weiteren Produktänderungen, keinPush/Merge. Dokumentierte Minor-/Plattformgrenzen bleiben: Designpanel-Reopen, nativeiOS/WebKit/Clipboardnichtgeprüft. AlleACverifiziert; Status bleibtInProgress bis ausdrücklicherBestätigung nachmanuellemTest.
<!-- SECTION:NOTES:END -->
