# TASK-75: Umsetzung, Nachweise und Entscheidungen

**Stand: 28.10.2026 — lokal implementiert und unabhängig reviewt, nicht manuell abgenommen oder ausgeliefert.**

- **Branch:** `task/75-canvas-references`.
- **Worktree:** `/home/matthias/.local/share/opencode/worktree/9d3066/task-75-canvas-references`.
- **Code-HEAD:** `43d3e6934cd09c4db67950529ec008ad5cd2b23a`.
- **Branch-Basis:** `277aa2403db51098bfdc145d3e73eaba6e3b8524`.
- **Letzter Controller-Gesamtlauf: fehlgeschlagen.** 1463 Tests bestanden; eine unveränderte Browser-Fixture scheiterte beim Start, ein Test wurde deshalb übersprungen. Ein gezielter Nachlauf ersetzt diesen Befund nicht.
- **Eigenständiges Feature-Gate:** 17 Dateien / 219 Tests bestanden, keine Skips. Typecheck, Lint, Build und Doc-Lint bestanden mit den unten dokumentierten Warnungen.
- **TASK-75 bleibt `In Progress`.** Kein Push, PR, Merge, Release, produktiver Zugang oder bezahlter Modellaufruf wurde durchgeführt.

Grundlagen: [Design](../specs/2026-10-28-canvas-image-references-design.md), [freigegebener Plan](../plans/2026-10-28-canvas-image-references.md). Historische Baselines und damalige Planungsgrenzen in diesen Dateien sind keine aktuellen Testergebnisse; dieser Bericht beschreibt den Umsetzungsstand.

## Gelieferter Umfang

- Bilddateien über Hintergrund oder Frame-Shield importieren: PNG, JPEG, WebP, GIF, SVG; maximal 5 MiB je Datei; maximal 900 Weltpixel Frame-Kantenlänge, 40 Weltpixel Abstand. Originalasset-Auflösung bleibt erhalten.
- Drop-Position, Seite und Canvas vor asynchroner Arbeit festhalten. Stage-Overlay, fensterweiter Standardaktionsschutz und direkter Iframe-Schutz verhindern die getesteten synthetischen Datei-Standardaktionen. Panels sind keine Importflächen.
- Vorhandene Frames ausdrücklich über Composer oder Kontextmenü einem Auftrag zuordnen: Vorschau, Tastaturbedienung, Entfernen, Referenz-Badge und höchstens vier gemischte Datei-/Frame-Anhänge.
- Referenz und Bearbeitungsziel trennen, einschließlich Element-Scope. Ohne anderes Ziel ein separates Ergebnis anweisen; Quellen nicht automatisch als Bearbeitungsziel oder dauerhafte Guidelines übernehmen.
- Entwürfe pro Canvas ausschließlich im Client-Speicher behalten. Erfolgreiche Uploads anhand der File-Identität in Frame-Verweise umwandeln, Vorschau-URLs freigeben und bei Fehlern nur verbleibende Dateien erneut hochladen. Entfernen der Zuordnung löscht keine Quelle.
- Teilimporte in der laufenden Ursprungscanvas-Sitzung mit einem Undo-Schritt erfassen. Späte Upload-Antworten überschreiben keine neueren bereits eingetroffenen Frame-Edits.
- Anlegen und Retry vor Kontingentverbrauch validieren; ursprünglich geprüfte IDs bei späterem Quellenverlust behalten. Resident prüft vor und nach Admission und pausiert ungültige bzw. bekannt nicht visionfähige Referenzkarten.
- Automatisches Redesign-Preset für Referenz-/Mischläufe unterdrücken. Bestehende Brand-, Berechtigungs-, HTML-Redaktions- und Requesty-EU-Grenzen erhalten.
- Onboarding und wiederholten Composer-Hinweis präzisieren: **Bildpixel werden nicht redigiert.** Kontaktangaben im Bild können das konfigurierte Modell erreichen.
- Keine neuen Dependencies, Endpunkte, Datenbankfelder oder Migrationen.

## Implementierung und unabhängige Reviews

| Abschnitt                          | Commit               | Review und Evidenz                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vorbereitung                       | `2e72368`            | Isolierter Worktree, freigegebener Plan, TASK-75 In Progress; Baseline 175 Dateien / 1397 Tests bestanden.                                                                                                                                                                                                     |
| Task 1: Bildimport und Drop-Schutz | `dff7e10`            | Frischer Spec-/Qualitätsreview freigegeben. 176 Dateien / 1404 Tests bestanden. Rust-/OS-Gate offen.                                                                                                                                                                                                           |
| Task 2: Referenzentwurf und Senden | `ce5be09`, `86a3f73` | Initialer Review fand Radix-Fokuswiederherstellung. Echte Menüregression beobachtet rot, Fix mit 19 Tests grün und frischem scoped Review freigegeben. Zuvor 177 Dateien / 1413 Tests bestanden. Erweiterte UI-Tests waren nicht sämtlich test-first; diese Einschränkung wurde nicht nachträglich umgedeutet. |
| Task 3: Karten und Resident        | `f3c795c`            | Frischer Spec-/Qualitätsreview freigegeben; 88 gezielte Tests bestanden. Gesamtlauf scheiterte beim Serverstart auf Port 39347, siehe unten.                                                                                                                                                                   |
| Task 4: Browser und Datenschutz    | `a8431bf`            | Frischer Spec-/Qualitätsreview freigegeben; 126 + 89 gezielte Tests und 179 Dateien / 1460 Gesamttests bestanden, keine Skips.                                                                                                                                                                                 |
| Whole-Branch-Review                | bis `a8431bf`        | Unabhängiger Review fand drei wichtige Integrationsfehler und einen kleinen Validierungsfehler. Ein grüner Gesamtlauf widerlegte diese nicht abgedeckten Kombinationen nicht.                                                                                                                                  |
| Ein konsolidierter Fixlauf         | `43d3e69`            | Alle vier Befunde mit beobachteten RED-/GREEN-Regressionen behoben; 179 Dateien / 1464 Tests bestanden, keine Skips. Genau eine frische scoped Nachprüfung: alle vier **ADDRESSED**, keine neue Critical-/Important-Feststellung.                                                                              |

Implementer: Kaylee Frye, Shuri, Trinity, Ellen Ripley, Rocket Raccoon; unabhängige Reviewer: Spock und Gandalf. Die Namen sind Chat-Aliasse, keine zusätzlichen Modellanbieter. Implementierungen liefen mit Codex `gpt-6.1-sol`, Reviews mit OpenCode `openai/gpt-6.1-sol`; keine von Implementern gestarteten Zusatzreviewer.

### Korrekturen aus dem Gesamt-Review

1. **Stage → Panel:** Overlay lag über schwebenden Panels. Ein echter Hit-Test nach Overlay-Aktivierung schlug rot fehl; Overlay liegt nun unter Panels und über Frames. Kein Import bei Panel-/Composer-Drop, URL und Entwurf bleiben erhalten.
2. **Kontingentprüfung → Seiten-/Canvaswechsel:** Platzierung wurde zu spät erfasst. Zwei rote Composer-Tests mit echtem Upload-Helper zeigten neue/fremde Seiten-IDs und falsche Koordinaten. Platzierung wird nun vor dem ersten Await erfasst; Retry und fremde Canvas bleiben getrennt.
3. **Teilupload → neuere Zusammenarbeit:** Alte Create-Antwort überschrieb inzwischen gestreamten Inhalt, Geometrie und `updatedAt`. Rote verzögerte Geschwister-Regressionsprüfung; nun nur fehlende Frames lokal ergänzen und gruppiertes Undo erhalten.
4. **Ablehnung → Decoding:** Abgelehnte Dateien wurden bereits dekodiert. Rote Prüfung zeigte fünf statt drei Decoderaufrufe. Nun zuerst validieren; abgelehnte Dateien belegen keine Layout-Slots, Ergebnisreihenfolge und Teilfehler bleiben erhalten.

## Frische Controller-Verifikation

Alle Befehle liefen im oben genannten Worktree am unveränderten Code-HEAD `43d3e69`. Spätere Änderungen betreffen nur Dokumentation und Backlog-Nachweise.

| Befehl / Prüfung                                                                | Tatsächliches Ergebnis                                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `bun run test --maxWorkers=2 --testTimeout=30000`                               | **Exit 1**; 178 Dateien bestanden / eine Suite fehlgeschlagen; 1463 Tests bestanden / ein Skip; 340,87 s. |
| `bun run test --maxWorkers=1 --testTimeout=30000 tests/frameLocalEdits.test.ts` | Exit 0; unveränderter diagnostischer Nachlauf: eine Datei / ein Test bestanden; 10,24 s.                  |
| Unten aufgeführtes 17-Dateien-Feature-Gate                                      | Exit 0; **219 Tests bestanden, keine Skips**, 161,41 s.                                                   |
| `bun run typecheck`                                                             | Exit 0.                                                                                                   |
| `bun run lint`                                                                  | Exit 0, vollständiger type-aware Oxlint-/ESLint-Lauf.                                                     |
| `bun run build`                                                                 | Exit 0; bestehende Warnung für JS-Chunk über 500 kB. Hauptchunk: 960,94 kB minifiziert / 299,15 kB gzip.  |
| `bun run doc-lint`                                                              | Exit 0; Timestamp-Warnung zu neueren Browser-Tests gegenüber `CLAUDE.md` / `.context/`.                   |
| `git diff --check 277aa2403db51098bfdc145d3e73eaba6e3b8524..HEAD`               | Exit 0.                                                                                                   |
| `command -v cargo`                                                              | Exit 1: Cargo nicht verfügbar; keine Rust-Build-/Testbehauptung.                                          |

```bash
bun run test --maxWorkers=1 --testTimeout=30000 \
  tests/imageFrames.test.ts tests/frameClipboard.test.ts \
  tests/germanFinalBoundaries.test.tsx tests/composerReferences.test.ts \
  tests/promptComposer.test.tsx tests/cardPrompt.test.ts \
  tests/cardReferencesRoute.test.ts tests/prowinRedactWiring.test.ts \
  tests/requestyResident.test.ts tests/chatCompletionsAgent.test.ts \
  tests/serverAdmission.test.ts tests/localQueueAdmission.test.ts \
  tests/canvasReferencesBrowser.test.ts tests/frameRuntimeBody.test.ts \
  tests/pageCanvasBrowser.test.ts tests/drawingBrowser.test.ts \
  tests/elementPanelBrowser.test.ts
```

### Fehlgeschlagene Gesamtprüfungen nicht verschweigen

- **Task 3:** `tests/pageControlsBrowser.test.ts` scheiterte vor den Assertions: `Error: server did not bind port 39347`; 1450 Tests bestanden / zwei Skips. Unveränderter gezielter Nachlauf: zwei bestanden. Die ursprüngliche Ursache ist nicht belegt; Child-stderr wird vom bisherigen Harness verworfen.
- **Frischer Controller-Abschlusslauf:** `tests/frameLocalEdits.test.ts:32`, `beforeAll`: `TimeoutError: Waiting failed: 30000ms exceeded` bei `page.waitForFunction(() => !!window.elementPanelHarness)`. Der Testkörper lief nicht. Diese Testdatei und `tests/harness.ts` wurden im Branch nicht verändert. Der unveränderte Einzeltest und alle 219 gezielten Referenz-/Browser-/Visiontests bestanden danach.
- Ein unmittelbar vorausgehender Implementer-Gesamtlauf am selben Code-HEAD hatte **1464/1464** bestanden. Das macht den neueren Controller-Gesamtlauf **nicht grün** und belegt die genaue Ursache des Startfehlers nicht.
- **TASK-73, weiterhin To Do:** konkrete Startfehler, Diagnosegrenzen und Baseline-Node-/Fixture-Warnungen zur weiteren Untersuchung aufgenommen. Keine Parallelität erhöht, Timeouts pauschal angehoben oder Fehler unterdrückt.

### Verbleibende Warnungen

- Node: `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.` Bereits in der Baseline; Review verweist auf den Node-Getter in `tests/setup.ts`.
- Im vollständigen Lauf: `AggregateError`, `ECONNREFUSED ::1:3000` / `127.0.0.1:3000` sowie Happy-DOM-Fetch-/Teardown-`AbortError`. Beide Arten bereits in Baseline-Ausgaben; genauer verursachender Test bleibt unbewiesen. Der 219-Test-Controllerlauf enthält nur die localStorage-Warnungen.
- **TASK-76, To Do / niedrig:** Bundle-Größe messen und Nutzen einer Optimierung bewerten. Kein Nachweis eines aktuellen Performancefehlers und keine ungefragte Chunking-Änderung.
- Doc-Freshness bleibt eine Timestamp-Warnung, kein Nachweis falscher Dokumentation. `CLAUDE.md` / `.context/` wurden nicht nur zum Verstecken der Warnung angefasst.

## Rulings I made

Der Nutzer erlaubte ausdrücklich, Fragen und Herausforderungen selbst zu entscheiden, verlangte aber nachvollziehbare Widerrufsmöglichkeiten. Die folgenden acht Entscheidungen entsprechen sämtlichen `Ruling:`-Einträgen des Ausführungsledgers, in zeitlicher Reihenfolge.

1. **Ausführbare Rust-Entscheidungstests statt reinem Source-Texttest.** Verhalten ist belastbarer als Quelltextsuche. Cargo-/OS-Prüfung bleibt offen. **Risiko/Widerruf:** Native Verdrahtung kann noch falsch sein; auf Zielsystemen bauen, testen und nötigenfalls korrigieren. Es wurde kein automatisierter OS-Nachweis behauptet.
2. **Kleinen Kontextmenü-Fokusfix im Controller ausführen.** Vermeidet einen doppelten Implementierungsdispatch; beobachtete echte Menüregression und frischer scoped Review bleiben Pflicht. **Risiko/Widerruf:** Fokus-/Accessibility-Regression; Änderung in `86a3f73` gezielt ersetzen oder zurücknehmen, ohne den ursprünglichen Referenzentwurf zu verwerfen.
3. **Live-Referenzen ohne Snapshots oder neue technische Quell-Locks beibehalten.** Entspricht der bestätigten Spec. **Risiko/Widerruf:** Spätere Edits ändern die Referenzdarstellung; Snapshot-/Lock-Design wäre ein separates Feature mit möglichen Schemafolgen.
4. **Kontingente, Refunds und Capability-Erkennung nicht umbauen.** Vor-/Nachprüfungen erfüllen den Umfang, eine neue Abrechnungs-/Modellarchitektur nicht. **Risiko/Widerruf:** Ein bereits gebuchter Versuch kann bei späterem Quellenverlust oder fehlender Vision verbraucht bleiben; Administration bzw. ein gesondertes Refund-/Capability-Feature wäre erforderlich.
5. **Keine OCR oder automatische Pixelredaktion ergänzen.** Der Auftrag verlangt ehrlichen Hinweis, nicht eine weitere Verarbeitungspipeline. **Risiko/Widerruf:** Kontaktdaten in Bildern können das Modell erreichen; nur freigegebene, nicht sensible Bilder verwenden. Eine verlässliche Bildredaktion benötigt getrennte Planung und Prüfung.
6. **Geteilten Kartenkontext und anweisungsbasierte Screenshots beibehalten.** Keine neue Queue-Architektur oder erzwungene Screenshotplanung. **Risiko/Widerruf:** Referenzeinfluss kann Karten eines Batches übergreifen; ein Modell kann Anweisungen missachten. Strikte Kontext-/Tool-Isolation wäre ein separates Architekturvorhaben; Transporttests beweisen keine Ästhetik.
7. **Unveränderte Fixture-Startfehler und Baseline-Warnungen aus TASK-75 auslagern.** Keine nachgewiesene fehlgeschlagene Feature-Assertion; unveränderte Diagnose und Feature-Gate bestehen. TASK-73/TASK-76 bewahren die Follow-ups, Doc-Freshness ist heuristisch. **Risiko/Widerruf:** Eine zugrunde liegende Regression oder langsamer Start kann fortbestehen; Fehlstatus des letzten Gesamtlaufs offenhalten und bei Nachweis die priorisierte Fehlerbehebung wieder aufnehmen.
8. **Ignorierten Plan-Workspace samt Rohlogs vorerst behalten.** Fehlgeschlagener Gesamtlauf ist ungeklärt und Integration in main nicht freigegeben. **Risiko/Widerruf:** Nur lokaler Speicher-/Scratch-Verbrauch; nach gesicherter Evidenz und Abnahme ausschließlich das genaue Planverzeichnis löschen, nicht Nachbarpläne oder den Code-Worktree.

Zusätzlich wurden die bestätigten Produktgrenzen nicht erweitert: Drop importiert zunächst nur; Zuordnung gilt pro Auftrag; beliebige Frames sind als visuelle Quelle erlaubt; keine automatische Übernahme in dauerhafte Memory-Pins. Die vier finalen Korrekturen erfüllen diese bestehenden Anforderungen und ändern keine Produktentscheidung.

## Offene manuelle und native Abnahme

- [ ] Rust-Navigationstests ausführen und aktualisierte Tauri-Shell auf unterstützten Zielsystemen bauen; Cargo fehlt hier.
- [ ] Echte Dateimanager-Drops unter Windows und den tatsächlich ausgelieferten macOS-/Linux-Webviews prüfen, einschließlich Panels und interaktivem Iframe. Synthetische Chromium-Ereignisse beweisen keine OS-/Webview-Navigation.
- [ ] Im Web und in neuer Shell Pan/Zoom, zweite Seite, Teilfehler, erneutes Senden ohne Duplikate sowie gruppiertes Undo manuell prüfen.
- [ ] Mit ausdrücklich freigegebenem visionfähigem Modell eine freigegebene, nicht sensible Werbung prüfen: visuelle Orientierung, unveränderte Quelle, Brand-Vorrang und korrektes separates Ergebnis bzw. anderes Ziel. Kein Anspruch auf pixelgenaue Rekonstruktion.
- [ ] Ungeklärte Startdiagnosen aus TASK-73 einordnen; fehlgeschlagenen Gesamtlauf nicht nachträglich als bestanden darstellen.
- [ ] Ausdrückliche Nutzerabnahme einholen; erst danach TASK-75 schließen. Push/PR/Merge/Packaging/Release benötigen einen gesonderten Auftrag.

**Backlog-Nachweise:** AC 2–7 sind automatisiert bzw. durch diese Dokumentation belegt; AC 1 bleibt wegen der eingeschlossenen nativen/echten Drop-Abnahme offen. Ein Häkchen ist keine manuelle Produktabnahme; Taskstatus bleibt `In Progress`.

## Lokale Rohdaten und Wiederaufnahme

Alle Berichte, RED-/GREEN-Ausgaben, Reviewpakete und das vollständige Ledger liegen weiterhin unter:

```text
.superpowers/sdd/2026-10-28-canvas-image-references/
```

Relevante Abschlussdateien: `final-review.md`, `final-fix-report.md`, `controller-final-suite.log`, `controller-frame-local-diagnostic.log`, `controller-reference-gate.log`, `controller-typecheck.log`, `controller-lint.log`, `controller-build.log`, `controller-doc-lint-before-report.log`, `progress.md`.

Dieses Verzeichnis ist bewusst git-ignoriert und nicht transportabel garantiert. **Dieser versionierte Bericht bleibt der dauerhafte Entscheidungs- und Nachweisüberblick**, auch wenn die lokalen Rohdaten später entfernt werden.
