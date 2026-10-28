# TASK-75: Visuelle Canvas-Referenzen

**Status:** Planungsentwurf vom 28.10.2026; keine Implementierung beauftragt.
**Codebasis:** `main`, `f732729` (`feat: add LT Kai and brush placeholder`).
**Backlog:** TASK-75 – Ergänze visuelle Canvas-Referenzen; bleibt `To Do`.

## Ziel und bestätigter Umfang

Nutzer können Grafiken, etwa bestehende Werbungen, auf den Canvas ziehen und ausdrücklich als visuelle Orientierung für einen KI-Auftrag verwenden. Die KI orientiert sich beispielsweise an Bildsprache, Aufbau und Stimmung. Sie zerlegt das Bild nicht in editierbare Elemente und rekonstruiert es nicht pixelgenau.

Der Nutzer hat diese Abgrenzung bestätigt und eine konkrete Planung auf Basis der aktuellen App angefordert. Die folgenden Bedienungs- und Technikdetails sind **Planungsvorschläge**, keine zusätzliche Umsetzungsfreigabe.

## Verifizierter Bestand

- **`src/lib/frameClipboard.ts:124–211`:** `uploadImageFrames` lädt Bilddateien hoch und erstellt normale HTML-Frames mit einem `<img>`; Paste zentriert sie. Noch kein Datei-Drop. `Promise.all` verliert bei Teilfehlern den Rückgabewert erfolgreicher Geschwister; Bild-Paste erfasst aktuell einzelne Undo-Einträge.
- **`src/components/Stage.tsx:113–155,831–914`:** Besitzt Stage-Ref, aktive Seite und Pan-/Zoom-Koordinaten. Keine Datei-Drop-Handler. Frames liegen unter Pointer-Shields bzw. in editierbaren Iframes.
- **`src/components/PromptBar.tsx:104–168,185–278`:** Büroklammer/Paste hängen bis zu vier lokale Dateien an. Beim Senden entstehen Referenzframes; ihre IDs gehen an `api.addCard`. Dateien/Vorschauen sind lokaler Component-State und verschwinden beim Unmount. Jede Auswahl erzeugt grundsätzlich einen Bearbeitungs-Scope.
- **`src/components/FrameContextMenu.tsx` / `src/components/FrameView.tsx`:** Vorhandenes Gruppen-Kontextmenü und Frame-Label; bisher keine auftragsbezogene Referenzaktion/-Kennzeichnung.
- **`src/lib/store.ts:117–124,180–184,495–504`:** Textentwürfe bereits pro Canvas im Speicher; Focus-Request und Sendestatus vorhanden. Sichtbarkeit des Agent-Panels liegt dagegen lokal in `CanvasPage`.
- **`server/actions.ts:828–870`:** `attachments?: string[]`: Strings deduplizieren, nur existierende Frames derselben Canvas, maximal vier. Scope wird unabhängig davon normalisiert; derzeit kann dieselbe ID zugleich Quelle und Ziel sein.
- **`server/resident.ts:448–475,533–543,1540–1548`:** Referenzen stehen pro Karte im Kickoff. Agent soll sie screenshotten und unverändert lassen. Vorhandener Scope verlangt dagegen Bearbeitung im Ziel. Screenshot-Bilder gelangen über den bestehenden Vision-Pfad zum Modell.
- **`server/chatCompletionsAgent.ts` / `server/agentModel.ts`:** Requesty-EU-Vertrag und Bildtransport vorhanden. Bekannte `vision: false`-Modelle liefern keine visuelle Analyse; die konfigurierte Requesty-Policy wird derzeit als visionfähig behandelt.
- **`src/lib/api.ts:234–250,267–275,303–306`:** Bestehender Asset-Upload, Frame-Erstellung mit explizit überschreibbarer `pageId`, Karten-API mit getrennten `attachments` und `scope`.

Die Felder und ihre Persistenz existieren bereits. `Canvas.references`/Memory-Pins sind **dauerhafte Canvas-Referenzen** und werden hierfür nicht verwendet.

## Vorgeschlagene Bedienung

1. **Import:** Eine oder mehrere Bilddateien auf die Arbeitsfläche ziehen. Die Gruppe wird um die Drop-Position angeordnet; Bilder behalten ihr Seitenverhältnis. Der Drop startet weder KI noch automatische Referenzzuordnung.
2. **Markieren:** Ausgewählte Frames über den sichtbaren Button **„Auswahl als Referenz“** im Composer oder **„Als Referenz verwenden“** im Frame-Kontextmenü vormerken. Mehrfachauswahl ist möglich. Normale Designframes dürfen ebenfalls als visuelle Screenshots dienen; keine fragile Bildtyp-Erkennung im HTML.
3. **Erkennen:** Agent-Panel öffnen und Composer fokussieren. Dort Vorschauen mit Name und Entfernen-Button zeigen; vorhandene Frames erhalten am Canvas-Label ein kleines **„Referenz“**-Badge für diesen Entwurf. Das Badge ist kein gespeichertes Frame-Flag.
4. **Auftrag:** Text senden. Maximal vier Referenzen insgesamt, bestehende Frames und neue Dateianhänge gemeinsam. Mehrfaches Vormerken derselben Frame-ID belegt keinen weiteren Platz.
5. **Ergebnis:** Ohne anderes Bearbeitungsziel soll der Agent ein separates Design erstellen. Bei einem anderen ausgewählten Ziel soll er dieses bearbeiten. Entfernen einer Referenzzuordnung löscht nie den Quellframe.

**Wichtige Trennung:** Ist der ausgewählte Frame bereits Referenz, entsteht daraus kein Scope – auch nicht aus einem darin ausgewählten Element. Ein anderer Frame bzw. dessen Element bleibt als Scope nutzbar. Der Scope-Chip wird ausdrücklich als **„Bearbeitungsziel“** bezeichnet. Der Server entfernt zusätzlich einen Scope, dessen Frame-ID in den Referenzen derselben Karte steht.

Die Referenzzuordnung gilt für den nächsten Auftrag. Nach erfolgreichem Queueing wird der Entwurf geleert; die Karte behält ihre IDs. Nachfolgende Aufträge übernehmen diese Referenzen nicht automatisch. Die Quellbilder bleiben auf dem Canvas.

## Eingaben, Positionierung und Fehler

- Keine neuen Dependencies, API-Endpunkte, Datenbankfelder oder Migrationen.
- Vorhandene Formate: **PNG, JPEG, WebP, GIF, SVG**; maximal **5 × 1024 × 1024 Byte pro Datei**. Kein PDF-, URL-, HTML- oder Verzeichnisimport. Dateiendung darf bei leerem MIME-Typ als UI-Vorprüfung dienen; der Server prüft weiterhin die Bytes und Größe.
- Beim Drop Canvas-ID, aktive `pageId` und Weltmittelpunkt festhalten, bevor irgendein Upload/Decoding wartet. Weltpunkt: `(client - stageRect - viewportOffset) / zoom`. Auch nach Pan-/Seitenwechsel keine späte Umplatzierung.
- Die bisherige maximale Frame-Kantenlänge **900** und der Abstand **40 Weltpixel** bleiben erhalten. Das gespeicherte Asset behält seine Auflösung. Das ist keine Garantie, dass kleine Schrift im KI-Screenshot lesbar bleibt.
- Nur native Datei-Drags behandeln; interne Layer-/Text-Drags unverändert lassen. Dateien auf der Stage dürfen keine Browsernavigation auslösen, auch wenn das Format abgelehnt wird. Ein temporäres Datei-Drop-Overlay liegt über den Frame-Iframes, nicht über Bedienpanels. Es verschwindet bei Drop, Verlassen und Abbruch zuverlässig.
- Erfolgreiche Teilimporte bleiben erhalten und werden in der laufenden Ursprungscanvas-Sitzung als eine Gruppe rückgängig machbar; Fehler werden sichtbar gemeldet. Beim Canvaswechsel wird die History wie bisher geleert; kein nachträgliches Undo über Canvaswechsel hinweg. Kein automatisches Löschen bereits hochgeladener Assets oder Frames bei einem Geschwisterfehler.
- Für die Sendefunktion werden erfolgreich hochgeladene Dateianhänge sofort in Frame-Verweise umgewandelt. Scheitert ein weiterer Upload oder das Queueing, bleiben Entwurf und fertige Verweise erhalten. Erneutes Senden lädt nur die noch nicht hochgeladenen Dateien; bei einem Teilfehler wird noch keine unvollständige Karte gesendet.
- Entwürfe einschließlich Dateivorschauen liegen pro Canvas ausschließlich im Client-Speicher und überstehen Panel-/Tabwechsel. Nicht in LocalStorage, Datenbank oder WebSocket persistieren. Object-URLs bei Entfernen/Ersetzen/erfolgreichem Versand freigeben, nicht beim bloßen Composer-Unmount.
- Nach Canvaswechsel darf eine verspätete Antwort keinen Entwurf, keine Auswahl, keine Kamera und keine Undo-History der anderen Canvas verändern. Bereits gestartete Uploads bleiben der ursprünglichen Canvas/Seite zugeordnet; verschwundene Zielseiten ergeben einen Fehler statt stiller Umleitung.
- Gelöschte Referenzen sichtbar als fehlend kennzeichnen und das Senden bis zu ihrer Entfernung blockieren. Die Kartenroute prüft Form, Viererlimit und Canvas-Zugehörigkeit vor der Kontingentbuchung; ungültige Referenzen ergeben HTTP 400 mit **„Bitte verwende höchstens vier verfügbare Referenzen dieser Arbeitsfläche.“**, ohne Karte oder Buchung. Doppelte IDs werden dedupliziert, ungültige Quellen nicht lautlos entfernt.
- Zwischen Prüfung und Queueing kann während der asynchronen Kontingentbuchung eine Quelle verschwinden. Die Karte behält deshalb ihre ursprünglich geprüften Referenz-IDs; der Resident pausiert sie bei der erneuten Prüfung. Kein stiller Auftrag ohne Quelle. Ein dabei bereits gebuchter Versuch wird wie bisher nicht automatisch erstattet; kein Umbau des Kontingentsystems.

## KI-Verhalten und bestehende Regeln

- Bestehende `AgentTask.attachments` und `screenshot_frame` verwenden. Kein zweiter Bildtransport und keine neue Analysepipeline. Referenzlesen bleibt wie bisher eine Agent-Anweisung, kein neuer automatisch erzwungener Screenshot-Schritt.
- Kickoff: Referenzen gehören zu **dieser Karte**, dienen nur der visuellen Orientierung, bleiben als Quellen unverändert und sind keine Aufforderung zur pixelgenauen Rekonstruktion oder zur Übernahme alter Preise/Claims. Brand-Regeln bleiben vorrangig. Keine automatische Übernahme als dauerhafte Guidelines/Memory-Pins durch diese Funktion.
- Vor `prepareServerWork` einer beanspruchten Karte prüfen: Fehlt eine angehängte Referenz bzw. gehört sie nicht mehr zur Canvas, diese Karte mit **„Eine Referenz ist nicht mehr verfügbar. Entferne sie oder füge sie erneut hinzu.“** pausieren (`actions.failCard`). Andere gültige Arbeit desselben Batches darf weiterlaufen. Das verhindert eine zusätzliche Admission lokaler Karten, macht aber eine bereits erfolgte Kontingentbuchung der REST-Route nicht rückgängig.
- Bei bekanntem `model.vision === false` Karten mit Referenzen mit **„Das konfigurierte KI-Modell kann keine Bildreferenzen auswerten. Wende Dich an die Administration.“** pausieren, ohne Modellaufruf für diese Karte. Keine neue Capability-Erkennung oder Provider-Umschaltung bauen.
- Referenzen bleiben Live-Verweise, keine eingefrorenen Snapshots. Kein neues Lock-/Berechtigungsmodell: Die Markierung schützt Quellen nicht technisch gegen menschliche Edits oder einen fehlerhaften Agent-Toolaufruf. UI-Scope-Trennung und Agent-Anweisung verhindern die naheliegende versehentliche Bearbeitung; bestehende serverseitige Sperren bleiben maßgeblich.
- Der Resident kann mehrere Karten in einem Modellkontext bearbeiten. Pro-Karte-Zuordnung ist keine Zusage isolierter Modellkontexte; diese Funktion ändert die Queue-Architektur nicht.

## Datenschutz und Sicherheit

Vorhandene Canvas-Zugriffskontrolle, Impersonation-Schreibsperre, Upload-Byteprüfung, Screenshot-Isolation, HTML-Redaktion und Requesty-EU-Egress-Grenzen beibehalten. Eine abgelehnte API-Anfrage muss verständlich im vorhandenen Fehler-/Notice-Muster landen; keine neuen rollenbasierten Uploadrechte erfinden.

**Pixel werden nicht redigiert.** Gedruckte Telefonnummern, E-Mail-Adressen oder andere personenbezogene Angaben in einer Werbung können als Screenshot an das konfigurierte Modell gelangen. Die bestehende HTML-Redaktion und die EU-Region ändern das nicht; `docs/prowin/datenfluss-ki.md` benennt diese Grenze bereits.

Im Composer bei vorhandenen Referenzen sichtbarer Hinweis, unabhängig vom bereits geschlossenen Onboarding:

> Referenzbilder werden vom KI-Agenten visuell ausgewertet; beim Server-Agenten über Requesty (EU). Kontaktdaten im Bild werden nicht automatisch entfernt. Lade nur Bilder hoch, die Du dafür verwenden darfst.

Den pauschalen Satz im bestehenden Onboarding präzisieren: Platzhalter gelten für erkannte **Textdaten**, nicht für Schrift in Bildpixeln. Keine OCR, automatische Unkenntlichmachung, Rechtsprüfung oder neue Einwilligungsverwaltung in diesem Feature. MCP-/Local-Agent-Verträge unverändert; der Hinweis verspricht für diese Pfade keine EU-Verarbeitung.

## Abnahmekriterien und Nachweise

Die sieben ACs stehen in TASK-75. Die Implementierung braucht gezielte Nachweise für:

- Drop mit Pan/Zoom, auf Hintergrund und Frame-Shield, auf der zweiten Seite; Originalverhalten von Paste, Layer-Drag und Tastatur erhalten.
- Vier gemischte Anhänge, doppelte Frame-Auswahl, Entfernen ohne Löschen, Tastaturbedienung und eindeutige Trennung von Referenz und Bearbeitungsziel.
- Panel-/Canvaswechsel, Teilfehler, API-Fehler und Retry ohne doppelte Uploads; erfolgreicher Teilimport als ein Undo-Schritt.
- Canvas-Zugehörigkeit, gelöschte Referenz, Scope-Kollision und bekannt fehlende Vision-Unterstützung; keine falsche Fertigmeldung.
- Deterministischer Requesty-Integrationstest: tatsächliches Referenzasset screenshotten, Bild am EU-Transport nachweisen, separates Ergebnis erstellen, Quelle unverändert lassen und Ergebnis weiter visuell prüfen. Das beweist Verdrahtung, nicht die ästhetische Leistung eines echten Modells.
- Typecheck, Lint, Build und manuelle Abnahme mit einer realen, freigegebenen Werbegrafik. Kein Backlog-`Done` ohne ausdrückliche Nutzerabnahme.

**Ausgeführte Baseline am 28.10.2026:** `bun run test --maxWorkers=2 tests/frameClipboard.test.ts tests/promptComposer.test.tsx tests/cardPrompt.test.ts tests/chatCompletionsAgent.test.ts` – **4 Dateien / 37 Tests bestanden**. Noch keine Tests für das neue Feature und keine Live-Modell-/OS-Drop-Prüfung. `tests/germanFinalBoundaries.test.tsx` prüft zusätzlich den bisherigen Throw-Vertrag des Uploads und muss auf den neuen Ergebnis-/Notice-Vertrag umgestellt werden, ohne die deutschen, geheimnisfreien Fehlertexte zu verlieren.

## Aufwand und offene Freigabe

Richtwert **1–2 Entwicklertage**, mit Retry-/Fehlerabsicherung eher am oberen Ende. Keine belastbare Zusage vor Umsetzung; echte Betriebssystem-Drags in der Desktop-Shell und die visuelle Qualität des konfigurierten Modells benötigen manuelle Prüfung.

Für die schlanke Version sind keine weiteren Produktentscheidungen zwingend. Vorgeschlagene Detailentscheidungen sind: pro Auftrag statt global, Drop zunächst nur importieren, beliebige Frames als visuelle Quelle zulassen und Entwürfe nur im Client-Speicher halten. Umsetzung erst nach Review/Freigabe dieses Plans.
