# Task 2: Template-Farben und -Text begrenzen — Report

## Status

Implementiert, Tests grün, committet. Kein Backlog-Close (bleibt In Progress bis Nutzerabnahme).

## RED-Nachweis (vorher)

`bun run test -- tests/templateInputs.test.tsx tests/templateInputRuntime.test.ts --maxWorkers=2`

- `templateInputs.test.tsx`: Suite-Parse-Fehler (`const type`-Typo, Testbug) + fehlende Exporte (`templateCodepoints`, `templateMaxLengthsOf`) und fehlende Token-UI.
- `templateInputRuntime.test.ts`: 7/8 fehlgeschlagen — `beforeinput` wurde nicht verhindert, kein `doop:revert`, kein Notice.
- Zusätzlich gefunden: Bootstrap-Syntaxfehler durch unmaskiertes `\n` im Template-Literal (jetzt `'\\n'`), gefangen via `node --check`.

## GREEN-Nachweis (nachher)

- Fokussiert: `templatePolicy|templateSelection|templateFieldSave|templateInputs|templateInputRuntime|frameTemplateRuntime|templateGuard|templateWrites|templateMeta|templateFieldsUi|templateAttributes|templateFields` — **12 Dateien, 155 Tests, alle grün**.
- `bun run typecheck` (`tsgo --noEmit`) — sauber.
- `bunx oxlint --deny-warnings` auf allen geänderten Dateien — sauber.
- Vollsuite `bun run test -- --maxWorkers=2` — **197 Dateien, 1667 Tests, alle grün, 0 Skips** (Dauer ~365 s).
- Bestehende Task-1-Browser-Suites (`elementPanelTemplateBrowser`, `pageCanvasBrowser`, `elementPanelBrowser`) liefen in der Vollsuite mit, keine Regression.

## Änderungen (kleinstes Diff, nur bestehende Pfade)

- `src/prowin/templatePolicy.ts`: `TemplateAttrLevel` + `maxLength` (roh); neu `templateCodepoints` (`[...text].length`, Server-Semantik) und `templateMaxLengthsForChain` (alle anwendbaren Limits, selbst-zuerst), beide self-contained und in die Runtime serialisiert; neu `templateMaxLengthsOf(html, selector)`. Policy-Form unverändert (Task-1-Tests unangetastet).
- `src/lib/frameRuntime.ts`: Text-Guard im Bootstrap — `beforeinput` (Tippen, Auswahl-Ersetzung, Paste via `dataTransfer`, Drop, Composition, Löschen) lehnt Edits ab, die irgendein anwendbares Feldlimit (ganzes Feld inkl. Nachfahren/Siblinge, alle Vorfahrenlimits, Codepoints) überschreiten würden; `input`-Fallback stellt den letzten gültigen Stand exakt wieder her (Snapshot enthält eingefrorene Inhalte wortgleich); verschachtelte `data-od-locked` werden per `contenteditable="false"` eingezäunt und bei Deaktivierung/Capability-Wechsel wieder freigegeben; Legacy-Überlänge wird nie beschnitten, Wachstum abgewiesen, passende Voll-Ersetzung erlaubt; Creator (`manageLocks`) ohne Guard. Neu `doop:revert` (rendert nur im Idle, mid-edit gewinnt das Tippen). Deutsche Notices via `doop:edit-notice`.
- `src/components/ElementPanel.tsx`: Nicht-Creator im Template-Feld (`inTemplateEdit`) sehen keine Geometrie-/Layout-/Aussehens-/HTML-Controls mehr; bei Allowlist nur `TokenColorField` (Füll-/Rahmen-/Textfarbe) mit exaktem `var(--token)`-Write, ohne Hex-/Alpha-Umwege; leere Schnittmenge → „Keine Farbe erlaubt“ + deaktiviert; ohne Allowlist freie Farben, aber weiter keine Struktur-Controls; `border-style`-Auto-Add und Rahmenbreite nur außerhalb Template-Edit. Creator und templatefreie Frames unverändert.
- `src/components/FrameView.tsx`: `doop:edited`-Reject → deutsche Notice („Die Änderung konnte nicht gespeichert werden“), Store-Rollback, `doop:revert` ans Live-Dokument; `doop:edit-notice` → Notice; Resize-Griffe für Nicht-Creator in Template-Frames ausgeblendet (stored-HTML-Policy; Runtime + Server bleiben Autorität).
- `src/lib/layerEdits.ts`: `saveFrameHtml`-Reject spiegelt zusätzlich `doop:revert` mit Vorher-HTML in die Runtime.
- Tests: neu `tests/templateInputs.test.tsx` (8), neu `tests/templateInputRuntime.test.ts` (8); `tests/templateFieldSave.test.ts` +2 (Revert bei Reject, kein Revert bei Erfolg).

## Bekannte Einschränkungen

- Client-Guard ist Best-Effort (Approximation über Selection/Insert); `templateGuard` (Server) bleibt verbindlich; Format-/Undo-/History-Inputtypen entscheidet der Server.
- Layers-Strukturops (Löschen/Duplizieren/Verschieben) in editierbaren Feldern werden clientseitig nicht vorab unterdrückt — Server-Reject triggert jetzt Notice + Store- + Live-Rollback.
- Resize-Griff-Unterdrückung nutzt die Stored-HTML-Policy (skriptgenerierte Inhalte sichert die Runtime-Sperre + Server).
- `doop:revert` wirkt nicht mitten im Tippen (Live-Tippen gewinnt, nächster Save wird neu beurteilt).
- Unverändert übernommen: per-row HTML-Parse-Performance in Layers; fehlende FrameView-Toolbar-Chip-Render-Assertion (Task-1-Ledger, kein Task-2-Scope).
