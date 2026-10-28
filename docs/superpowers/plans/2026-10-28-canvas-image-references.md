# Visuelle Canvas-Referenzen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK-75 – Bilddateien auf die aktuelle Canvas-Seite droppen und vorhandene Frames ausdrücklich als visuelle Orientierung für einen einzelnen KI-Auftrag verwenden.

**Architecture:** Den bestehenden Asset-/Bildframe-Import um eine explizite Drop-Position und teilfehlertaugliche Ergebnisse erweitern. Der vorhandene Client-Store hält gemischte Dateianhänge/Frame-Verweise pro Entwurf; `AgentTask.attachments` bleibt der unveränderte persistierte Kartenvertrag. UI und Server trennen Quellreferenzen vom Bearbeitungs-Scope; der bestehende Resident-/Requesty-EU-Vision-Pfad bleibt erhalten.

**Tech Stack:** vorhandenes TypeScript, React 18, Zustand, Radix-Hauskomponenten, Express, Vitest 5, happy-dom und puppeteer-core. Keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-canvas-image-references-design.md` – vor jedem Task mitlesen. Ausgangsstand `main@f732729`; Planung, keine Umsetzungsfreigabe.

**Aufwand:** Nach Council-Gegenprüfung **3–5 Entwicklertage** für den vollständigen Plan statt der ursprünglichen 1–2 Tage. Plattform-Build-/Release-Wartezeiten und manuelle OS-/Live-Modell-Abnahme bleiben gesonderte Freigabeschritte.

## Global Constraints

- Keine neuen Dependencies, API-Endpunkte, Datenbankfelder oder Migrationen.
- Vorhandene Formate: **PNG, JPEG, WebP, GIF, SVG**; maximal **5 × 1024 × 1024 Byte pro Datei**. Kein PDF-, URL-, HTML- oder Verzeichnisimport.
- Maximal vier Referenzen insgesamt, bestehende Frames und neue Dateianhänge gemeinsam.
- Die bisherige maximale Frame-Kantenlänge **900** und der Abstand **40 Weltpixel** bleiben erhalten.
- Entwürfe einschließlich Dateivorschauen liegen pro Canvas ausschließlich im Client-Speicher und überstehen Panel-/Tabwechsel. Nicht in LocalStorage, Datenbank oder WebSocket persistieren.
- Die Referenzzuordnung gilt für den nächsten Auftrag. Nach erfolgreichem Queueing wird der Entwurf geleert; die Karte behält ihre IDs.
- Globale Brand-Regeln, serverseitige Berechtigungen, HTML-Redaktion und Requesty-EU-Egress bleiben erhalten. Referenzmarkierung ist kein neues Lock und keine Memory-Pin-Funktion.
- Keine pixelgenaue Rekonstruktion, OCR, automatische Unkenntlichmachung oder neue Provider-/Capability-Registry.
- Desktop ist eingeschlossen: bestehende Tauri-Shell für HTML5-Datei-Drops anpassen; Auslieferung benötigt eine neue Shell-Binärdatei. Keine native Datei-/Pfad-Brücke.
- Backlog nur per CLI pflegen; TASK-75 bleibt bis zur Umsetzungsfreigabe `To Do`, danach bis zur ausdrücklichen Nutzerabnahme `In Progress`.

## Review Focus

- Ausgewählte Quelle wird zum Bearbeitungsziel: Task 2 testet UI-/Element-Scope, Task 3 dieselbe Kollision am Server.
- Zweiter Upload/Queueing scheitert: Tasks 1/2 testen, dass erfolgreiche Frames erhalten und rückgängig machbar bleiben und Retry sie nicht erneut hochlädt.
- Während Upload navigieren oder zoomen: Tasks 1/4 testen eingefrorene Drop-Koordinaten/-Seite und unveränderten fremden Entwurf/History.
- Referenz fehlt oder Modell kann keine Bilder lesen: Tasks 2/3 testen sichtbare Blockade bzw. pausierte Karte statt angeblicher Analyse.
- Native Datei-Drags treffen Iframes oder konkurrieren mit Layer-Drags: Task 4 prüft Overlay, Eventbehandlung und Erhalt bestehender Drag-/Paste-Bedienung; echte OS-/Desktop-Drags bleiben manuelle Abnahme.

## Dateikarte und Reihenfolge

1. **Import:** neu `src/lib/imageFiles.ts`, erweitern `src/lib/frameClipboard.ts`, `src/lib/frameRuntime.ts`, `src/components/Stage.tsx`, `src/pages/CanvasPage.tsx`, `desktop/src-tauri/src/main.rs`; neu `tests/imageFrames.test.ts`, `tests/desktopFileDrop.test.ts`, bestehende Clipboard-/Historytests erhalten.
2. **Entwurf/UI:** erweitern `src/lib/store.ts`, `src/components/PromptBar.tsx`, `FrameContextMenu.tsx`, `FrameView.tsx`, `src/pages/CanvasPage.tsx`; `tests/promptComposer.test.tsx`, neu `tests/composerReferences.test.ts`.
3. **Karten/Resident:** erweitern `server/actions.ts`, `server/index.ts`, `server/resident.ts`, Kommentar in `shared/types.ts`; `tests/cardPrompt.test.ts`, neu `tests/cardReferencesRoute.test.ts`, außerdem `tests/prowinRedactWiring.test.ts`, `tests/requestyResident.test.ts`, `tests/fixtures/requesty-router.mjs`.
4. **Durchstich/Datenschutzhinweis:** neu `tests/canvasReferencesBrowser.test.ts`; erweitern `src/components/Onboarding.tsx`, `docs/prowin/datenfluss-ki.md` und vorhandenen Hinweis-Test in `tests/prowinRedactWiring.test.ts`.

Tasks sequenziell ausführen. Sie teilen Upload-/Entwurfsverträge; parallele Implementierung wäre unnötig konfliktträchtig. Vor Ausführung isolierten Worktree über `using-git-worktrees` anlegen und TASK-75 per CLI auf `In Progress` setzen. Keine Arbeit aus anderen Branches/Tasks übernehmen.

---

### Task 1: Ergänze positionsfesten Bild-Drop

**Files:**

- Create: `src/lib/imageFiles.ts`, `tests/imageFrames.test.ts` (`happy-dom`), `tests/desktopFileDrop.test.ts` (Shell-Verdrahtung, kein OS-Funktionstest).
- Modify: `src/lib/frameClipboard.ts:124–211`, `src/lib/frameRuntime.ts` (Files-only-Navigationsschutz im bestehenden Bootstrap), `src/components/Stage.tsx` (Stage-Ref/Root-Events), `src/pages/CanvasPage.tsx` (Datei-Navigationsschutz), `desktop/src-tauri/src/main.rs:297–356` (HTML5-Drops und gezielter `file:`-Navigationsschutz), `src/components/PromptBar.tsx` (bestehenden Upload-Aufrufer an Ergebnisvertrag anpassen), `tests/germanFinalBoundaries.test.tsx:70–103` (bisheriger Throw-Vertrag), `tests/frameRuntimeBody.test.ts` (vorhandener Runtime-Browser-Harness).
- Regression: `tests/frameClipboard.test.ts`, `tests/guardedBatch.test.ts`.

**Interfaces:**

- Produces: `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `MAX_PROMPT_REFERENCES = 4`, `validateImageFile(file: File): string | null` in `imageFiles.ts`. Zulässige Typen gemäß Spec; bei leerem MIME unterstützte Endung akzeptieren, sonst verständliche deutsche Ablehnung. Byte-Sniffing bleibt Serversache.
- Produces: `export type ImageFrameUpload = { file: File; frame: Frame } | { file: File; error: string }` in `frameClipboard.ts`.
- Changes: `uploadImageFrames(canvasId: string, files: File[], fallbackName?: string, placement?: { center: { x: number; y: number }; pageId: string }): Promise<ImageFrameUpload[]>`. Ergebnisreihenfolge entspricht der Dateireihenfolge; ein Fehler pro Datei statt Verlust erfolgreicher Ergebnisse.
- Preserves: `pasteImagesCentered(canvasId: string, files: File[]): Promise<void>`; vorherige Copy-/Duplicate-Exports unverändert.

- [ ] **Step 1: Schreibe rote Importtests** in `tests/imageFrames.test.ts`. `Image`/Decoding und Asset-API stubben; echten Client-Store und History benutzen. Namen/Assertions:
  - `validates supported types and the exact asset cap`: 5 MiB zulässig, 5 MiB + 1 abgelehnt; PNG/JPEG/WebP/GIF/SVG zulässig, PDF/HTML abgelehnt; leerer MIME mit `.png` zulässig.
  - `places a group at the captured world center and page`: zwei 100×100-Bilder, Mittelpunkt `{x:300,y:200}`, `pageId:'p2'` ergeben `{x:180,y:150}` und `{x:320,y:150}`; Abstand 40. Während eines verzögerten Uploads Pan/Zoom/Seite ändern, API-Payloads bleiben gleich.
  - `keeps and groups successful siblings after a failure`: erster Upload scheitert, zweiter gelingt; beide Ergebnisse vorhanden, nur der Erfolg ist ein Frame; ein `undo()` löscht den erfolgreichen Frame genau einmal. Zweiter Fall: zwei Erfolge und ein Fehler werden in einem Undo entfernt.
  - `does not contaminate another canvas after navigation`: vor Auflösung auf `c2` wechseln; Aufrufe bleiben `c1/p2`, Auswahl/Undo von `c2` unverändert.
  - `keeps bitmap aspect ratio and the 900px frame cap`: 1800×900 wird 900×450; Assetbytes unverändert; leere Dateiliste erzeugt keine Requests.
  - In `germanFinalBoundaries.test.tsx` die HTTP-400/413/502-Matrix erhalten: `api.uploadAsset` wirft weiterhin; `uploadImageFrames` liefert dieselben sicheren deutschen Texte im Fehlerergebnis, `pasteImagesCentered` zeigt sie über Notice. Kein `upstream secret` darf angezeigt werden. Kein neuer Anspruch auf History-Persistenz nach Canvaswechsel.
  - `desktopFileDrop.test.ts` liest den tatsächlichen Rust-Fensterbuilder: HTML5-Dragfreigabe über `.disable_drag_drop_handler()` vorhanden; gezieltes Ablehnen von `file:` liegt vor der externen Opener-Weiterleitung. Die Prüfung ist ausdrücklich nur ein Verdrahtungsnachweis; natives Verhalten muss separat geprüft werden.
  - `frameRuntimeBody.test.ts` nutzt die vorhandene sandboxed Fixture: direkt im Iframe cancelable `dragover`/`drop` mit `DataTransfer`/Datei auslösen. Beide Events müssen `defaultPrevented === true` haben; Body-HTML und Frame-/Parent-URL bleiben unverändert. Nach erneutem `doop:html`-Morph wiederholen. Text-only-Drags bleiben ungeblockt; keine Import-/Datei-PostMessage erzeugen. Synthetische Events beweisen die Defaultverhinderung, nicht echte Browsernavigation; unveränderte URLs sind nur eine Sanity-Prüfung, der OS-Nachweis bleibt manuell.
- [ ] **Step 2: Verifiziere Rot.** `bun run test --maxWorkers=2 tests/imageFrames.test.ts` – erwartetes FAIL wegen fehlendem Validator/Ergebnisvertrag bzw. falscher Position/History.
- [ ] **Step 3: Implementiere den gemeinsamen Import.** Canvas/Seite/Position vor erstem `await` erfassen; `pageId` explizit in `api.createFrame` übergeben. Dateivalidierung und Upload/Create-Ergebnisse mit `Promise.allSettled` einsammeln; Fehler über `errorMessage` lesbar machen. Erfolgreiche Frames einmal mit bestehendem `recordCreates` erfassen, ausschließlich wenn noch dieselbe Canvas offen ist. Dort Ergebnisse auch über das vorhandene `upsertFrame` bereitstellen, damit ein verspätetes WebSocket-Event eine frisch hochgeladene Referenz nicht vorübergehend als fehlend erscheinen lässt. `pasteImagesCentered` konsumiert Erfolge, setzt Auswahl nur auf unveränderter Canvas/Seite und meldet Teilfehler. Der bestehende Prompt-Sendepfad konsumiert vorerst die neuen Ergebnisse und sendet bei irgendeinem Fehler keine Karte; vollständige Retry-Konvertierung folgt in Task 2.
- [ ] **Step 4: Verdrahte Datei-Events und Shell.** Native `Files`-Drags erkennen, Drop-/Abbruchzustand lokal halten und ein temporäres Stage-Overlay über den Iframes anzeigen. In `onDrop` Weltpunkt aus Stage-Rechteck/Viewport berechnen und zusammen mit `canvas.id`/aktiver Seite vor Upload einfrieren. Ergebnisse am gleichen Ort gruppieren; nur bei unverändertem Kontext auswählen. In `CanvasPage` fensterweite Capture-Listener für `dragover`/`drop` mit `Files` registrieren: nur `preventDefault`, kein `stopPropagation`, kein Import außerhalb der Stage; auf Unmount entfernen. Im bestehenden `FRAME_BOOTSTRAP` dieselben Files-only-Defaultaktionen dokumentweit verhindern, damit direktes Hereinziehen in ein Bearbeitungs-Iframe nicht navigiert; Listener einmal vor HTML-Morphs registrieren, kein neuer Import- oder PostMessage-Pfad. Tauri-Builder um `.disable_drag_drop_handler()` ergänzen und `file:` vor der Opener-Weiterleitung ablehnen; API-Quelle steht in der Spec. Kein neuer nativer Drop-Consumer. Erfolg/Fehler über `pushNotice`; kein KI-Aufruf. Nicht-Datei-Drags und Panelbedienung bleiben unverändert. Importflächen bleiben Hintergrund/normale Frame-Shields; direkt im interaktiven Iframe werden Dateien nur sicher ignoriert.
- [ ] **Step 5: Verifiziere Grün/Regression.** `bun run test --maxWorkers=2 tests/imageFrames.test.ts tests/desktopFileDrop.test.ts tests/frameClipboard.test.ts tests/guardedBatch.test.ts tests/promptComposer.test.tsx tests/germanFinalBoundaries.test.tsx`, separat `bun run test --maxWorkers=1 tests/frameRuntimeBody.test.ts` und `bun run typecheck` – alle ausgewählten Tests PASS, Typecheck Exit 0. Bestehende Mocks für `uploadImageFrames` auf den neuen Vertrag prüfen. Für die Shell zusätzlich `cargo check --manifest-path desktop/src-tauri/Cargo.toml` auf einem ausgerüsteten Host ausführen; fehlende Systempakete als Blocker dokumentieren, keinen plattformübergreifenden Build daraus ableiten.
- [ ] **Step 6: Commit.** Nur Task-Dateien stagen; `git commit -m "feat: add canvas image drops"`.

### Task 2: Verbinde Canvas-Referenzen mit dem Entwurf

**Files:**

- Modify: `src/lib/store.ts`, `src/components/PromptBar.tsx`, `src/components/FrameContextMenu.tsx`, `src/components/FrameView.tsx`, `src/pages/CanvasPage.tsx`.
- Test: neu `tests/composerReferences.test.ts`; erweitern `tests/promptComposer.test.tsx`.

**Interfaces:**

- Consumes: Task 1 `uploadImageFrames`, `ImageFrameUpload`, Validator und Limits; bestehende `api.addCard(canvasId, title, agents, attachments?, scope?)` unverändert.
- Produces: `export type ComposerAttachment = { kind: 'file'; file: File; preview: string } | { kind: 'frame'; frameId: string }` und `composerAttachments: Record<string, ComposerAttachment[]>` im bestehenden Store.
- Produces: Store-Aktionen `setComposerAttachments(canvasId: string, attachments: ComposerAttachment[]): void` und `addComposerReferences(canvasId: string, frameIds: string[]): void`. Setter gibt entfernte Datei-Object-URLs frei; Add dedupliziert Frames, prüft aktuelle Canvas-Zugehörigkeit, wahrt das gemeinsame Viererlimit und meldet Überlauf. Während des Sendens verhindert der Store-Guard in `addComposerReferences` Benutzeränderungen, auch aus dem Kontextmenü. `addFiles`/Entfernen prüfen denselben canvasbezogenen Busy-Zustand vor ihrem Setter-Aufruf. Den Setter nicht pauschal sperren: Er muss interne Upload-Konversion und Erfolgsbereinigung während des Sendens weiterhin zulassen.
- Changes: interne `sendPrompt`-Argumente `{ canvasId, text, attachments: ComposerAttachment[], scope: CardScope | undefined, allowance }`; Rückgabe bleibt `Promise<void>`. Keine Export-/API-Erweiterung.

- [ ] **Step 1: Schreibe rote Entwurfs-/Composer-Tests.** `tests/composerReferences.test.ts` testet Store und URL-Lifecycle; `tests/promptComposer.test.tsx` nutzt den vorhandenen React-`act`-Harness und mockbare Upload-/Kartenaufrufe:
  - `deduplicates canvas references within the combined four-item limit`: zwei Dateien + zwei Frames ergeben vier; erneute Auswahl eines Frames bleibt vier; fremde ID und fünfter Anhang kommen nicht hinzu, Überlauf wird gemeldet.
  - `adds the selected group through the visible composer button`: zwei `selectedIds` und ein primäres `selectedId`; Klick bzw. Tastaturaktivierung von „Auswahl als Referenz“ übernimmt beide in stabiler Reihenfolge, nicht nur die primäre Auswahl.
  - `keeps references across panel and canvas switches`: Referenzen und Dateien von `c1` überleben Composer-Unmount; `c2` sieht keine davon; Entfernen/erfolgreicher Versand ruft `URL.revokeObjectURL` auf, bloßer Unmount nicht.
  - `never derives an edit scope from a reference frame or its element`: `api.addCard` bekommt Referenz-IDs und `scope === undefined`. Mit anderem ausgewählten Frame/Element bleibt dessen exakter Scope erhalten.
  - `reuses successful reference uploads after an upload or queue failure`: Teilerfolg wird im Draft zum Frame-Verweis, Fehlversuch bleibt Datei; noch kein `addCard`. Retry lädt nur verbleibende Datei. Separater Fall: alle Uploads gelingen, `addCard` scheitert; nächster Send verwendet nur Frame-IDs und lädt nichts erneut hoch.
  - `blocks user mutations during a send but commits uploaded references`: verzögerter Upload/Kontingentcheck; Referenz-Add aus Kontextmenü/Store, Datei-Add und Entfernen ändern den gesendeten Draft nicht. Interne `file`→`frame`-Konversion funktioniert trotzdem während `busy`; ersetzte Object-URL wird sofort genau einmal widerrufen, auch wenn danach Queueing scheitert. Kein Widerruf der Vorschau einer noch fehlgeschlagenen Datei.
  - `blocks a deleted reference until explicitly removed`: fehlende Quelle sichtbar; Senden deaktiviert bzw. Enter erzeugt keine Requests; Entfernen löscht keinen Canvas-Frame.
  - `does not clear a different canvas draft when a send completes late`: `c1` sendet, Nutzer öffnet `c2`; dessen Draft, Anhänge, Auswahl und Kamera bleiben erhalten.
  - `shows the visual reference notice and accessible remove controls`: Spec-Hinweis sichtbar, Controls mit konkretem zugänglichem Namen, Referenz-/Zielbezeichnung unterscheidbar.
- [ ] **Step 2: Verifiziere Rot.** `bun run test --maxWorkers=2 tests/composerReferences.test.ts tests/promptComposer.test.tsx` – neue Referenz-/Retrytests FAIL; vorhandene Text-/Enter-/Scope-Tests erhalten.
- [ ] **Step 3: Ergänze Store-State und Aufrufstellen.** Bestehenden lokalen Attachment-State/Unmount-Revoke aus `PromptBar` durch Canvas-Draft ersetzen. Beim Add Fokus anfordern, `tasks` wählen und verborgene UI einblenden; `CanvasPage` öffnet bei einem frischen `composerFocusAt`-Request das Agent-Panel (auch Mobile-Sheet), statt ein zweites Panel-State-System einzuführen. Dafür das vorhandene bedingte Seen-Request-Muster aus `CanvasComments`/`FrameView` nutzen, keinen neuen synchronen `setShowActivity`-Effect mit Lint-Ausnahme. Kontextmenü verwendet vorhandene `groupFrames()`, sichtbarer Composer-Button die aktuelle Mehrfachauswahl; beide rufen dieselbe Add-Aktion. Busy-Guard auch im Store und den Datei-/Entfernen-Callbacks, nicht nur über deaktivierte Buttons. Keine automatische Markierung beim Drop.
- [ ] **Step 4: Trenne UI-Quelle und Ziel.** `PromptBar`-Scope für jeden Referenzframe unterdrücken, auch bei Elementauswahl; sonst bisherige Scope-/Esc-Semantik bewahren. Chip als `Bearbeitungsziel: …` benennen. Frame-Anhänge über vorhandene `/i/<id>.png`-Vorschauen darstellen; Datei-Anhänge behalten ihre Object-URLs. Fehlende Quelle als solche anzeigen. `FrameView`-Label zeigt `Referenz` aus dem aktuellen Draft, ohne neue Frame-Flags. Entfernen-Buttons löschen nur die Zuordnung. Spec-Datenschutzhinweis anzeigen.
- [ ] **Step 5: Ergänze Retry-sicheres Senden.** `busy` vor dem ersten asynchronen Kontingentcheck setzen und bis zur abschließenden Entscheidung durchgehend behalten. Eingefrorenen Draft verwenden, nur `kind:'file'` hochladen, erfolgreiche Resultate über das zugehörige `File`-Objekt zuordnen, in `kind:'frame'` umwandeln und im richtigen Canvas-Draft sichern; keine ungesicherte Index-Ersetzung. Der Setter widerruft die ersetzte Object-URL sofort, auch bei anschließendem Fehler. Bei Teilfehlern Entwurf behalten, Fehler anzeigen, keine Karte anlegen. Erst bei vollständigem Erfolg deduplizierte Referenz-IDs plus getrennten Scope senden. Nach Queue-Erfolg nur den gesendeten Draft leeren und Kamera-Watch nur auf derselben Canvas starten; alle Referenzframes gelten als bekannte Quellen, nicht als neue KI-Ergebnisse. Bestehende Kontingent-/Fehlerbehandlung beibehalten.
- [ ] **Step 6: Verifiziere Grün/Regression.** `bun run test --maxWorkers=2 tests/composerReferences.test.ts tests/promptComposer.test.tsx tests/imageFrames.test.ts tests/hideUi.test.ts tests/storePages.test.ts` und `bun run typecheck` – PASS / Exit 0. Bestehende Textentwürfe, IME/Enter, Fokus und Canvas-Trennung bleiben grün.
- [ ] **Step 7: Commit.** `git commit -m "feat: attach canvas frames as references"` nach explizitem Staging der Task-Dateien.

### Task 3: Präzisiere Karten- und KI-Verhalten

**Files:**

- Modify: `server/actions.ts:828–870`, `server/index.ts:1346–1383` (Anlegen und Retry), `server/resident.ts` (Kartenprüfung, `strategyFor`, Referenz-Kickoff), `shared/types.ts:347–348` (Kommentar).
- Test: `tests/cardPrompt.test.ts`, neu `tests/cardReferencesRoute.test.ts`, außerdem `tests/prowinRedactWiring.test.ts`, `tests/requestyResident.test.ts`, `tests/fixtures/requesty-router.mjs`.
- Regression: `tests/chatCompletionsAgent.test.ts`, `tests/serverAdmission.test.ts`, `tests/localQueueAdmission.test.ts`.

**Interfaces:**

- Consumes/Preserves: `AgentTask.attachments?: string[]`, `scope?: CardScope`, `addQueuedCard`-Signatur, persistierte Formate und `api.addCard`.
- Produces: `normalizeCardReferences(attachments: unknown): string[] | null` in `server/actions.ts`: `undefined` ergibt `[]`; nur Arrays aus Strings, Deduplizierung in Eingabereihenfolge, höchstens vier eindeutige nichtleere IDs, sonst `null`. Keine Existenzfilterung, damit zwischen Validierung und Ausführung verschwundene Quellen erkennbar bleiben.
- Changes: Die REST-Route prüft normalisierte IDs und `store.getFrame(id)?.canvasId === canvasId` vor `consumeResidentTask`. Ungültiger Input ergibt HTTP 400 mit `{ error: 'Bitte verwende höchstens vier verfügbare Referenzen dieser Arbeitsfläche.' }`, ohne Kontingentbuchung/Karte. Danach dieselben IDs an `addQueuedCard` geben; keine zweite verlustbehaftete Filterung. Interne Aufrufer bleiben signaturkompatibel; ungültige Form ergibt weiterhin keine Karte, fehlende/fremde Quellen führen zur pausierten Karte vor Modellstart.
- Changes: `/cards/:id/retry` liest die Karte dieser Canvas vor dem Verbrauch und prüft dieselben gespeicherten Referenzen. Fehlende Karte ergibt 404; ungültige Quelle HTTP 400 mit dem Spec-Pausentext, ohne Verbrauch/`retryCard`-Aufruf. Kein neuer Karteneditor und kein Versuch, neue Undo-IDs automatisch zuzuordnen.
- Changes: Nach Normalisierung der gültigen Referenzen `target` verwerfen, falls `refs.includes(target.frameId)`. Andere Ziele unverändert.
- Changes: lokale Signatur `strategyFor(text: string, frames: Frame[], hasVisualReferences = false): string`; bei Referenzkarten im Lauf das gesamte automatische Redesign-Preset unterdrücken, nicht nur einen widersprechenden Satz ergänzen. Gemischte Batches verwenden die normale Strategie; referenzlose Läufe behalten ihr Preset.
- Produces: Darüber hinaus keine neuen öffentlichen Exporte. Invalid gewordene Referenzkarten und bekannte `vision:false`-Referenzkarten werden vor Server-Admission über `actions.failCard(canvasId, card.id, reason)` pausiert; aus dem laufenden Batch entfernen. Nach asynchroner Admission vor endgültigem Batch/Kickoff dieselbe Prüfung wiederholen. Fehlertexte exakt aus der Spec. Nichtreferenzierte Arbeit bleibt ausführbar.

- [ ] **Step 1: Schreibe rote Karten-/Route-Tests.** In `cardPrompt.test.ts` Normalisierung für kein Feld, gültige und doppelte IDs sowie Ablehnung von Nicht-Arrays, Nicht-Strings, leeren IDs und mehr als vier eindeutigen IDs prüfen. Gleicher Prompt mit anderen Referenzen ist eine andere Karte. Neue Fälle `drops an edit scope that is also a reference` und `keeps a distinct edit target with references` prüfen `scope` exakt. `preserves an attachment deleted during admission for runtime failure` erzeugt eine Karte mit der inzwischen entfernten ID und prüft, dass diese nicht verloren geht. In `cardReferencesRoute.test.ts` mit echtem Harness HTTP 400 für gelöschte/fremde/malformed/überzählige Referenzen prüfen: generischer Spec-Fehler, keine neue Karte und unverändertes `/api/agent-allowance`. Ein gültiger Request derselben Testnutzerin muss danach noch möglich sein.
  - `rejects retry with a missing reference before charging`: bestehende pausierte Karte, Quelle löschen, Retry HTTP 400; Usage, `failedAt` und gespeicherte Referenz-IDs unverändert. Fremde Quelle und unbekannte Karten-ID ebenfalls ohne Verbrauch ablehnen. Referenzloser bzw. gültiger Retry behält das bisherige Verhalten; kein Anspruch auf neuen Karteneditor.
- [ ] **Step 2: Ergänze rote Runtime-Tests im vorhandenen Fake-Modell-Harness** von `prowinRedactWiring.test.ts`. Den vollständigen Kickoff einschließlich `strategyFor` prüfen, nicht nur den Referenzabsatz: mit Text „redesign“/„match the style“, Referenz und anderem Scope keine Vorgaben für `set_guidelines`, „TWO new frames“ oder Kopieren von Quellfakten. Referenzlose Redesign-Karte behält die bisherige Strategie; gemischter Lauf nutzt die Standardstrategie. Kickoff enthält Quelle, visuelle Orientierung, Quellen unverändert, Brand-Vorrang und korrekte Zielanweisung. Zwischen Claim und Ausführung entfernte/fremd gewordene Referenz sowie `vision:false` führen zum Spec-Fehler und keinem Modellaufruf für diese Karte. Neben dem bestehenden `claude-local`-Fake explizit einen `provider:'requesty'`-Fake und Spy/Stub für `prepareServerWork` einsetzen: ungültige Karte erreicht die Admission nicht, gültige Nachbarkarte schon und bleibt ausführbar. Ein verzögerter Admission-Stub löscht eine vorher gültige Quelle; die zweite Prüfung pausiert diese Karte vor dem Kickoff. Quellnamen mit E-Mail gehen redigiert in den Kickoff. Bestehende HTML-/Vision-Redaktion und normale Aufgaben ohne Referenzen unverändert prüfen.
- [ ] **Step 3: Verifiziere Rot.** `bun run test --maxWorkers=2 tests/cardPrompt.test.ts tests/cardReferencesRoute.test.ts tests/prowinRedactWiring.test.ts` – die neuen Kollisions-/Runtime-/Route-Fälle FAIL, bereits bestehendes Verhalten darf PASS sein.
- [ ] **Step 4: Implementiere kleine Vertragskorrekturen.** Normalisierung zwischen Route und Action teilen; Anlegen und Retry prüfen die Zugehörigkeit vor dem asynchronen Kontingentverbrauch, Action erhält die ursprünglich geprüften IDs verlustfrei. Scope nach Referenznormalisierung abgleichen. Gültigkeit/`vision:false` nach Beanspruchen vor `prepareServerWork` prüfen und nach den Admission-Awaits vor endgültigem `cards`-/`canceled`-/Kickoff-Zustand erneut prüfen; fehlgeschlagene Karten sauber entfernen und beim leeren Batch ohne Modelllauf zurückkehren. Bereits verbrauchte REST-Kontingente nicht automatisch erstatten; keine Änderung des Abrechnungssystems. Kickoff pro Karte präzisieren und automatisches Redesign-Preset bei Referenzläufen abschalten; fehlende Quellen nicht lautlos entfernen. Weiterhin `screenshot_frame` vor Gestaltung anweisen, getrennt von der Ergebnis-Selbstprüfung. Keine neue Bildinjektion, Schreibsperre, Memory-API, Modellregistry oder Transportlogik.
- [ ] **Step 5: Erweitere den realen EU-Integrationstest.** `requestyResident.test.ts` lädt vor der bestehenden Erfolgskarte ein tatsächliches 64×32-PNG mit zwei auffälligen Farbflächen (linke Hälfte Magenta `#ff00ff`, rechte Hälfte Grün `#00ff00`) über `/assets`, erstellt daraus einen 64×32-Referenzframe ohne Ränder und sendet dessen ID mit. `requesty-router.mjs` erkennt nur für diesen Test den Quellnamen `Requesty reference fixture`: zuerst Screenshot der Quelle, dann Ergebnis erstellen, Ergebnis screenshotten, Entscheidung speichern, abschließen. Eindeutige Tool-Call-IDs für Quellen-/Ergebnis-Screenshots verwenden. Den dem Quellen-Toolresult folgenden `image_url`-Block dekodieren und mit vorhandenem `sharp` die zwei Innenpunkte `(16,16)` und `(48,16)` gegen die erwarteten RGB-Farben mit Toleranz ±5 prüfen; ein bloßer Base64-/PNG-Existenzcheck genügt nicht. Damit fällt ein nicht geladenes `<img>` auf. Quelle bytegleich, zwei Frames statt einem, Karte erfolgreich. Bestehender Test ohne Referenzmarker (auch `localQueueAdmission`) behält bisherigen Routerablauf. Der Erfolgspfad hat dann fünf Layout-Turns + zwei Distiller-Requests, also sieben statt sechs erlaubte EU-Egress-Einträge. Keine echten bezahlten Modellaufrufe.
- [ ] **Step 6: Verifiziere Grün/Regression.** `bun run test --maxWorkers=2 tests/cardPrompt.test.ts tests/cardReferencesRoute.test.ts tests/prowinRedactWiring.test.ts tests/requestyResident.test.ts tests/chatCompletionsAgent.test.ts tests/serverAdmission.test.ts tests/localQueueAdmission.test.ts` und `bun run typecheck` – PASS / Exit 0; Requesty-Integration benötigt Chromium/`CHROME_PATH`. Ein Skip ist kein Vision-Nachweis und muss vor Abnahme nachgeholt werden.
- [ ] **Step 7: Commit.** `git commit -m "fix: separate references from edit targets"` nach gezieltem Staging.

### Task 4: Sichere Bedienung und Datenschutzhinweise ab

**Files:**

- Create: `tests/canvasReferencesBrowser.test.ts`.
- Modify: `src/components/Onboarding.tsx:142–150`, `docs/prowin/datenfluss-ki.md`, vorhandenen Onboarding-Hinweis-Test in `tests/prowinRedactWiring.test.ts`.

**Interfaces:**

- Consumes: reale Stage/CanvasPage/PromptBar aus Tasks 1/2 und unveränderte REST-Verträge aus Task 3.
- Produces: Browsernachweis des vollständigen Import-/Zuordnungsflows; präziser Hinweis, dass nur Text redigiert wird und Bildpixel unverändert bleiben.

- [ ] **Step 1: Schreibe roten Browser-/Hinweistest.** Aufbau am bestehenden `tests/germanDialogsBrowser.test.ts` orientieren: echter Testserver, angemeldeter Testnutzer, Vite mit separatem Test-Cache, tatsächliche `/c/<id>`-Seite. Proxys für `/api`, `/ws`, `/a/`, `/i/`, `/fonts/` auf denselben Harness-Server richten. Keine Produkt-Testhooks und keine neue Fixture-App. Bezahlten Agenten deaktiviert lassen; die entstandene Karte per API prüfen. Browser-Voraussetzung vor Setup prüfen, fehlenden Chromium explizit als fehlenden Nachweis melden.
  - `drops image files through the stage at pan and zoom on page two`: im Browser `DataTransfer`/`File` und DragEvents erzeugen; vorhandenen Zoom-/Pan-UI verwenden, Weltpunkt über Stage-Rechteck/gerenderte Geometrie abgleichen. Drop auf Frame-Shield funktioniert ebenfalls; Quelle landet auf Seite zwei, nicht Seite eins.
  - `marks and sends a source without turning it into an edit target`: Kontextmenü bei geschlossenem Panel öffnet Composer; sichtbare Referenzvorschau und Badge, Karten-`attachments` enthält Quell-ID, kein Quell-Scope. Weiterer Fall mit anderem ausgewählten Ziel behält dessen Scope. Referenz entfernen löscht Quelle nicht; nächster Auftrag erbt sie nicht.
  - `supports keyboard selection and restores the reference draft after panel switches`: sichtbaren Add-Button/Entfernen via Tab/Enter bedienen; deutscher Hinweis lesbar, bei 390px und 1280px kein abgeschnittener Send-/Entfernen-Button.
  - `cleans up file drag UI without intercepting ordinary drags`: Overlay nach Drop/Verlassen/Abbruch weg, PDF wird gemeldet statt geöffnet, normale Auswahl/Layer-Drags/Paste bleiben funktionsfähig. Onboarding-Test erwartet explizit die Ausnahme für Kontaktdaten in Bildern.
  - `prevents file navigation over panels without importing`: Datei-Drop auf Agent-Panel/Composer wird im Capture-Pfad verhindert, URL/Entwurf bleiben erhalten und kein Asset-/Frame-Request entsteht. Nach Unmount der CanvasPage Listener entfernt; Nicht-Datei-Drag unverändert. Der zusätzliche Direkt-Iframe-Guard wird separat im vorhandenen Runtime-Harness aus Task 1 geprüft.
- [ ] **Step 2: Verifiziere den Teststatus.** `bun run test --maxWorkers=1 tests/canvasReferencesBrowser.test.ts tests/prowinRedactWiring.test.ts` – Browserfälle müssen nach Tasks 1–3 bestehen bzw. konkrete Integrationslücken zeigen; der neue Onboarding-Texttest ist zunächst FAIL. Keine Instabilität durch höhere Parallelität verdecken.
- [ ] **Step 3: Schließe nur nachgewiesene Integrationslücken.** Drop-/Fokus-/Layoutfehler in den zuständigen Dateien beheben, keine zusätzliche Dragbibliothek. Onboarding auf erkannte Textdaten beschränken und Pixel-Ausnahme ergänzen. Datenflussdokument um auftragsbezogene Referenzframes, Quellen-/Zieltrennung und unveränderte Pixel ergänzen; vorhandene MCP-/Local-Ausnahmen nicht umschreiben. Wiederholten Referenzhinweis aus der Spec auch bei zuvor geschlossenem Onboarding erhalten.
- [ ] **Step 4: Führe Abschlussprüfungen aus.**
  ```bash
  bun run test --maxWorkers=2 tests/imageFrames.test.ts tests/desktopFileDrop.test.ts tests/frameClipboard.test.ts tests/germanFinalBoundaries.test.tsx tests/composerReferences.test.ts tests/promptComposer.test.tsx tests/cardPrompt.test.ts tests/cardReferencesRoute.test.ts tests/prowinRedactWiring.test.ts tests/requestyResident.test.ts tests/chatCompletionsAgent.test.ts tests/serverAdmission.test.ts tests/localQueueAdmission.test.ts
  bun run test --maxWorkers=1 tests/canvasReferencesBrowser.test.ts tests/frameRuntimeBody.test.ts tests/pageCanvasBrowser.test.ts tests/drawingBrowser.test.ts tests/elementPanelBrowser.test.ts
  bun run typecheck
  bun run lint
  bun run build
  bun run doc-lint
  git diff --check
  ```
  Erwartung: ausgewählte Tests PASS, keine unerklärten Skips, Commands Exit 0. Danach Gesamtsuite mit begrenzter Parallelität (`bun run test --maxWorkers=2 --testTimeout=30000`); bekannte Start-/Chromium-Instabilität aus TASK-73 nicht als Featurefehler oder grünen Gesamtlauf ausgeben. Tatsächliche Resultate getrennt dokumentieren.
- [ ] **Step 5: Commit.** `git commit -m "test: cover visual reference workflows"` nach explizitem Staging der Test-/Hinweis-/Dokumentationsdateien.

## Übergabe und manuelle Abnahme

- [ ] Whole-Branch-Review durchführen; besonders Quellen-/Zielkonflikt, Object-URL-Lifecycle, Teilfehler und serverseitige Canvas-Grenzen prüfen.
- [ ] Im Web und in der Desktop-Shell eine freigegebene Werbegrafik aus dem Dateimanager droppen; bei Pan/Zoom und auf zweiter Seite prüfen. Betriebssystem-Drag unterscheidet sich vom synthetischen Browser-Test. Gruppiertes Undo gilt für die laufende Ursprungscanvas-Sitzung; beim Canvaswechsel wird die History weiterhin geleert.
- [ ] Neue Shell-Binärdatei auf unterstützten Zielsystemen bauen und echte Drops mindestens unter Windows sowie den tatsächlich ausgelieferten macOS-/Linux-Webviews prüfen. Datei über Panel oder Stage darf keine `file:`-Navigation auslösen; Desktop-Verfügbarkeit nicht allein aus einem Web-Deployment oder dem statischen Verdrahtungstest behaupten. Packaging/Release nicht ohne gesonderte Freigabe starten.
- [ ] Im Web und in neuer Shell direkt auf ein bereits interaktives Bearbeitungs-Iframe droppen: kein Import, keine Navigation und kein Verlust des Entwurfs; anschließend normale Text-/Layerbedienung unverändert. Das ist ein Defaultaktionsschutz, keine weitere Importfläche.
- [ ] Mit tatsächlich konfiguriertem visionfähigem Modell einen Auftrag ausführen: visuelle Anlehnung erkennbar, Quelle unverändert, Brand-Regeln eingehalten, kein Anspruch auf pixelgenaue Übereinstimmung. Nur freigegebene Bilder ohne sensible Kontaktdaten verwenden.
- [ ] Erneutes Senden nach Upload-/Queuefehler manuell prüfen; keine doppelten Quellen. Ein Drop-Batch bleibt als ein Undo-Schritt entfernbar.
- [ ] Backlog-ACs nur anhand vorhandener Nachweise abhaken; Task bleibt bis zur ausdrücklichen manuellen Nutzerabnahme `In Progress`. Kein automatisches `Done`, kein Push/PR/Merge ohne gesonderten Auftrag.

## Planungsprüfung

- [x] Iststand und sämtliche Upload-Aufrufer gelesen; keine neue Persistenz nötig.
- [x] Vorhandene Basis geprüft: 4 Testdateien / 37 Tests am 28.10.2026 bestanden.
- [x] Spec-Anforderungen auf Tasks verteilt; Schnittstellen, Limits, Fehler- und Retryverhalten konkret benannt.
- [x] Frischen Builder-Check einarbeiten und Plan gegen die Spec selbst prüfen: Queueing-Race ohne stillen Referenzverlust, deutscher Upload-Fehlervertrag und sitzungsgebundenes Undo präzisiert; keine offene Produktfrage nötig.
- [x] Council-Runde-1-Findings gezielt eingearbeitet: Desktop-Drop/Dateinavigation, Retry-Gate, Redesign-Konflikt, Busy-/URL-Lifecycle, aussagekräftige Admission-/Pixeltests und ehrlicherer Aufwand. Keine neuen Features, Snapshots, Locks oder OCR.
- [x] Erneute unabhängige Council-Checks ausgewertet: alle drei Mitglieder sehen im finalen Plan keine Blocker. Iframe-Defaultaktionsschutz ist konkret eingeplant; synthetischer Nachweis ausdrücklich von OS-Navigation getrennt. Bewertungen ausschließlich in der Review-Antwort, nicht als Testergebnis ausgeben.
- [ ] Nutzerreview/Freigabe des Plans abwarten; empfohlene Ausführung: **Native**, sequenziell mit einem unabhängigen Abschlussreview.

**Nicht durchgeführt:** Implementierung, neue Featuretests, Live-KI- oder OS-Drop-Abnahme. **Bekannte Grenzen:** Live-Frame-Verweise statt Snapshots, promptbasierter Quellschutz statt neuer Schreibsperre, unredigierte Bildpixel und unbekannte Vision-Fähigkeit eines Requesty-Policy-Fallbacks.
