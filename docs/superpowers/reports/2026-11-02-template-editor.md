# Zeige Template-Sperren im Editor — TASK-31

## Ergebnis

- Branch `task/31-template-editor`, Basis `84d17ae` (gemergter TASK-30 / PR #7).
- TASK-30 auf ausdrückliche Nutzerbestätigung per Backlog CLI geschlossen.
- TASK-31 implementiert und automatisch geprüft; alle drei AC abgehakt.
  **Status bleibt In Progress bis zur ausdrücklichen Nutzerabnahme.**
- Kein Push, PR, Merge oder Deployment. Worktree bleibt erhalten.
- Design: [Template-Editor](../specs/2026-11-01-template-editor-design.md).
- Plan: [Umsetzung](../plans/2026-11-01-template-editor.md).

## Funktion

- Gemeinsame, in die iframe-Runtime serialisierte Client-Policy anhand
  `manageLocks`. Template-Sperren gelten für ganze Teilbäume; Nicht-Creator
  können sie nicht auswählen/bearbeiten. Creator behalten den Editor.
- Schloss-/Statushinweise in FrameView, LayersPanel und ElementPanel.
  Eingefrorene Bereiche bleiben zur Orientierung auswählbar, aber read-only;
  zentrale Layer-Kommandos und Runtime-Schreibpfade prüfen ebenfalls.
- Client-/Server-Kontrasttests sichern Feldwurzeln, sichere Inline-Ketten,
  eingefrorene Zwischenknoten, verschachtelte Felder und Namespaces ab.
- Tokenfarbwahl schreibt exakte `var(--token)`-Referenzen; verschachtelte
  Listen werden geschnitten. Keine Hex-/Alpha-Umgehung. Leere Attributlisten
  sind wie auf dem Server unbeschränkt, disjunkte nichtleere Listen sperren.
- Textlimits zählen dekodierte Unicode-Codepoints über ganze Felder und alle
  Vorfahren. Auswahlersetzung, Paste, Composition und eingefrorene Nachfahren
  werden berücksichtigt; keine stille Kürzung von Bestandsinhalten.
- Abgelehnte Saves zeigen deutsches Feedback und stellen Store und Live-DOM
  wieder her. Ein gemeinsamer per-Frame-Schreibpfad serialisiert/coalesced
  Inline-, Layer- und Feld-Saves; ungesendete Zwischenstände sind niemals
  Rollback-Ziele. Edit-Abbruch speichert abgelehnte Inhalte nicht erneut.
- `TEMPLATE_GUIDE` erreicht MCP und Resident wortgleich. Reale Transporttests
  prüfen erlaubte Änderungen, unverändertes HTML bei Ablehnung, Unicode-/
  Vorfahrenlimits, fehlgeschlagene `agent_name`-Eskalation und Creator-Authoring.
- Server-Guard, Metadaten-/Rollenvertrag und Dependencies bleiben unverändert.

## SDD und Review

Implementierung: **Muse Spark 1.3**. Reviews: **Muse Wonder**. Nach Ausfall der
T3-Tools hat der Nutzer native OpenCode-Delegation ausdrücklich freigegeben;
kein Modell wurde ersetzt. Kleine Review-Korrekturen erfolgten im Controller
gemäß Harness-Vorgabe, jeweils mit Tests und anschließendem Muse-Nachreview.

| Schritt                          | Commits            | Review-Ergebnis                                                                                                                  |
| -------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Auswahl / Sperrhinweise          | `4ca7ffc..0947230` | Freigegeben; Hide-Guard und Live-/Store-Policy korrigiert                                                                        |
| Eingabegrenzen / Rollback        | `0947230..822862e` | Freigegeben nach zwei Fix-Runden; Fence-Leak, Selection-Schutz, Rejection-Reihenfolge, Remote-Mismatch und Coalescing korrigiert |
| Agent / MCP                      | `822862e..c30cac5` | Freigegeben; Ablehnungstests verwenden unveränderliche HTML-Snapshots, Anleitung präzisiert                                      |
| Ganzer Branch + finale Fix-Welle | `84d17ae..c95d7ed` | Muse Wonder: **Ready to merge: Yes**, keine offenen Critical-/Important-Befunde                                                  |

Die finale Welle gleicht die Feld-Nachfahren-Policy an den Server an und
verbessert leere Farblisten, Composition-Handling und die strengere
Zusammenführung von gespeicherter und Live-Policy. Test-Fixtures wurden nicht
entschärft: alte unzulässige `<p>`-Nachfahren sind nun explizit read-only
getestet; Grenztests verwenden inhaltlich identische zulässige Inline-Felder.

## Verifikation

Frische Eltern-Verifikation auf Produktivcode `c95d7ed` am 02.11.2026:

| Prüfung                                        | Ergebnis                                                 |
| ---------------------------------------------- | -------------------------------------------------------- |
| `bun run test -- --maxWorkers=2`               | **201 Dateien / 1716 Tests PASS**, keine Skips, 373,31 s |
| `bun run typecheck`                            | PASS                                                     |
| `bun run lint`                                 | PASS                                                     |
| `bun run build`                                | PASS; bekannter Chunkgrößen-Hinweis                      |
| `bun run doc-lint`                             | PASS; ein bekannter Mtime-/Stale-Kontext-Hinweis         |
| Prettier für alle geänderten TS/TSX/MD-Dateien | PASS nach reinem Format-Fix in zwei Tests                |
| Tests nach Format-Fix                          | **2 Dateien / 13 Tests PASS**                            |
| `git diff --check`                             | PASS                                                     |

Baseline: 192 Dateien / 1611 Tests PASS vor Umsetzung. RED/GREEN-Belege
enthielten reale Browser-/Runtime-/Transporttests und gezielte Mutationschecks.
Insbesondere Composition ist mit vertrauenswürdigen Chromium-CDP-Ereignissen
(`Input.imeSetComposition`) getestet; Zielbereichs-Gutschrift ist zusätzlich
synthetisch geprüft, weil dieses Chromium dort keine TargetRanges liefert.

Testausgabe enthält bereits in der Baseline vorhandene Node-localStorage-
Warnungen und happy-dom-`ECONNREFUSED`-/`AbortError`-Ausgaben, ohne fehlgeschlagene
Tests. Diese Hinweise wurden nicht als fehlerfreie Ausgabe umetikettiert.

Logs im Sitzungs-Temp-Verzeichnis:

- `/tmp/opencode/task-31-baseline.log`
- `/tmp/opencode/task-31-final-suite.log`
- `/tmp/opencode/task-31-final-build.log`
- `/tmp/opencode/task-31-format-tests.log`

## Entscheidungen und vertagte Nebenbefunde

1. Nicht markierte/eingefrorene Bereiche bleiben auswählbar, aber read-only;
   Template-Sperren verhindern Auswahl. Grund: Orientierung bewahren.
   Falls falsch: Auswahl-UX nachbessern, keine gespeicherten Daten betroffen.
2. Agenten behandeln Vorlagen standardmäßig wie Nicht-Creator. Expliziter
   Authoring-Auftrag erlaubt einen Versuch, nie Selbstautorisierung; Server
   entscheidet und 403 beendet den Versuch. Falls falsch: Anleitung anpassen,
   Serverberechtigungen bleiben bestehen.
3. Nicht blockierende Restbefunde bleiben dokumentiert statt weiterer
   Refactor-Wellen: Layer-HTML-Parsing pro Zeile, fehlende isolierte
   Schloss-Chip-Render-Assertion, Save-Versuchshistorie während durchgehend
   beschäftigter Sequenz, strengere Behandlung von handgeschriebenem
   `data-od-role=" image "` sowie ein No-op-Toolbarbutton für skripterzeugte
   Template-Elemente. Risiko: bei großen/extremen Vorlagen Performance oder
   irreführender Hinweis; keine neue Berechtigungsumgehung. History-State wird
   beim Leerlauf freigegeben. Nicht pauschal kappen: das würde den
   nachgewiesenen Rollback-Schutz wieder öffnen.

TASK-77/78, generelle PATCH-Versionierung und neue Promptgrößen-Budgets bleiben
außerhalb dieses Tasks; keine neuen Anforderungen still entfernt.

## Manuelle Abnahme

- Als Beraterin gesperrtes Element per Canvas/Layers/Tastatur versuchen;
  Hinweise prüfen. Als Creator dieselbe Vorlage vollständig bearbeiten.
- Tokenfarbe, Textgrenze, Paste und eine physische IME nahe der Grenze prüfen.
  Überlange Composition darf während der Eingabe kurz sichtbar sein, wird beim
  Commit vor dem Speichern zurückgesetzt und erklärt.
- Ein Feld mit eingefrorenem `<p>`-Nachfahren und eines mit zulässigem
  `<span>`-Nachfahren vergleichen; Farben/Typografie nur im erlaubten Kontext.
- Visuelles Feedback auf Web/Desktop prüfen. Kein manuelles Browser-Testing
  oder Deployment wurde behauptet; automatisierte Browser-Tests liefen.
