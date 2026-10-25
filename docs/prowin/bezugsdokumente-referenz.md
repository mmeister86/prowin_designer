# proWIN Content Designer — Bezugsdokumente (konsolidierte Referenz)

> **Version:** 0.2 (Draft)
> **Author:** Matthias Meister
> **Date:** 22. Oktober 2026
> **Zweck:** Fasst die sechs Specs des Fabric.js/Convex-Ansatzes zusammen und ordnet jeden Inhalt für den doop-Fork ein. Nach diesem Dokument muss niemand mehr die Original-Specs öffnen, um zu wissen, was noch gilt.
> **Abnehmer:** `doop-fork-umsetzung.md` verweist auf die Abschnitte **R1 bis R7** dieses Dokuments.
> **Fork:** [`mmeister86/prowin_designer`](https://github.com/mmeister86/prowin_designer) (Upstream: `kgoedecke/doop`)
> **Quellen:** `prowin-design-tool-architecture_de.md` v0.6 · `layout-guides-feature-spec.md` v0.1 · `animation-feature-spec.md` v0.1 · `ai-assistant-feature-spec.md` v0.2 · `marketplace-feature-spec.md` v0.1 · `deployment.md` v0.2

---

## 0. Übersicht

**Legende:** ✅ gilt weiter · 🔄 gilt sinngemäß, Umsetzung ändert sich · ❌ obsolet

| §   | Quelldokument         | Status  | Kurzfassung                                                                                                                                |
| --- | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Architektur v0.6      | 🔄      | Vision, Rollen, Template-Idee, Presets, Fonts, ormbg und Rybbit bleiben. Fabric.js, Convex, TanStack Start, Cloudflare und Dodo fallen weg |
| R2  | Layout Guides & Zones | 🔄 / ❌ | **Safe Zones bleiben**, Layout Zones, Guide Lines und Snap-Engine fallen weg                                                               |
| R3  | Animationen           | 🔄      | Konzept und Edge Cases bleiben. Technik wird CSS-Keyframes plus serverseitiger Export                                                      |
| R4  | AI Assistant          | 🔄      | Requesty, Policies, Brand-Constraints und DSGVO bleiben. Die fünf Features gehen im doop-Agent auf                                         |
| R5  | Marketplace           | 🔄      | Strategie und Metriken bleiben. Basis wird doops Community-Gallery, die Lücken dazu sind aufgelistet                                       |
| R6  | Deployment            | ❌      | Fast vollständig ersetzt. Übrig bleiben einzelne Prinzipien und die Liste der Auftragsverarbeiter (neu)                                    |
| R7  | Evaluiert & verworfen | ✅      | Übernommene Ausschlüsse mit Neubewertung                                                                                                   |

---

## R1. Architektur (v0.6)

### R1.1 Vision & Strategie ✅

- **Problem (ursprünglich):** Beraterinnen erhalten statische JPEGs, die sich nicht anpassen lassen.
- **Korrektur (Sep 2026):** proWINs Abo personalisiert bereits den **Absender** (Name und Kontakt im JPEG). Dieses Tool individualisiert die **Botschaft** (Inhalt, Format, Timing, Anlass). Abschnitt 1 und Anhang B der Architektur sind in diesem Punkt veraltet (siehe R1.9).
- **Strategie:** Adoption vor Umsatz, Ziel ist eine Übernahme durch proWIN (Blumer-Präzedenz).

### R1.2 Rollen & Personas ✅

| Rolle                | Fähigkeiten                                              | Im doop-Fork                                                                                                                        |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**            | Vollzugriff, Nutzerverwaltung, Abrechnung                | `ADMIN_EMAILS` (doop-Admin)                                                                                                         |
| **Template Creator** | Voller Editor, Vorlagen veröffentlichen, Sperren setzen  | Creator-Kontostatus + Workspace-Rolle Owner/Creator; [Q4](rollen-berechtigungen.md)                                                 |
| **Beraterin**        | Vorlagen nutzen, erlaubte Felder bearbeiten, exportieren | Standard-Nutzerin, im Workspace Rolle Member                                                                                        |
| **Viewer**           | Galerie ansehen, nicht angemeldet                        | Community-Gallery (Vorschau + Kopie). ⚠️ doops Link-Sharing gibt **Bearbeitungsrechte** (`linkAccess: 'edit'`), keine reine Ansicht |

**Persona Beraterin:** wenig Design-Erfahrung, will schnelle Ergebnisse, arbeitet viel am **Smartphone**. Das Risiko „Mobile-Canvas ist umständlich“ (Architektur § 15: hoch/hoch) gilt unverändert.

Q4 wurde am 24.10.2026 entschieden: Creator kann selbst aktiviert werden; Einladungen und Workspace-Rollen verwaltet nur der Owner. Mitgliedschaft verleiht keinen Creator-Kontostatus. Eigentumsgrenzen, Migration und Testgruppen-Ablauf: [Rollen und Berechtigungen](rollen-berechtigungen.md).

### R1.3 Berechtigungsmatrix ✅

| Aktion                             | Admin | Creator     | Beraterin                       |
| ---------------------------------- | ----- | ----------- | ------------------------------- |
| Design erstellen                   | ✅    | ✅          | ✅                              |
| Vorlage veröffentlichen            | ✅    | ✅          | ❌                              |
| Editierbarkeit / Sperren festlegen | ✅    | ✅          | ❌                              |
| Gesperrte Felder bearbeiten        | ✅    | ✅ (eigene) | ❌                              |
| Editierbare Felder bearbeiten      | ✅    | ✅          | ✅                              |
| Exportieren                        | ✅    | ✅          | Tarif-Limit (wenn Stripe aktiv) |
| Nutzerinnen verwalten              | ✅    | ❌          | ❌                              |

### R1.4 Template-Modell 🔄

Fabric.js speicherte die Editierbarkeit als Objekt-Metadaten (`EditableFieldMeta`). Im doop-Fork wandert sie in HTML-Attribute:

| Alt (`EditableFieldMeta`)                       | Neu (`data-od-*`)                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `templateFieldId`                               | `data-od-id`                                                                                               |
| `label`                                         | `data-od-label`                                                                                            |
| `fieldType: text \| image \| color \| position` | `data-od-role` (semantisch feiner: `headline`, `body`, `image`, `cta`, `logo`, `contact`, `date`, `decor`) |
| `isEditable: false`                             | `data-od-locked`                                                                                           |
| `constraints.maxLength`                         | `data-od-max-length`                                                                                       |
| `constraints.allowedColors`                     | `data-od-allowed-colors` (Token-Namen statt Hex)                                                           |
| `constraints.fontLocked` / `sizeLocked`         | offen: als `data-od-lock="font,size"` ergänzen, falls nötig                                                |

**Workflows bleiben gleich:** _Creator:_ erstellen → Felder markieren → veröffentlichen. _Beraterin:_ Vorlage wählen → personalisieren → exportieren/teilen. Neu ist nur, dass der Agent den ersten Schritt übernehmen kann.

### R1.5 Canva- vs. Figma-Modus 🔄

| Aspekt                | Canva-Modus (Beraterin)                                        | Figma-Modus (Creator)              |
| --------------------- | -------------------------------------------------------------- | ---------------------------------- |
| **Umsetzung im Fork** | **Neue, schlanke Oberfläche** (eigene Spec, nach dem Testlauf) | **doop-UI** weitgehend wie sie ist |
| Ebenen                | versteckt                                                      | `LayersPanel`                      |
| Eigenschaften         | geführtes Formular für `data-od`-Felder                        | `ElementPanel` + HTML-Tab          |
| Auswahl               | nur editierbare Elemente                                       | alle                               |

### R1.6 Format-Presets ✅

Vollständige Liste aus Architektur § 11. Die Umsetzung startet mit den fett markierten Formaten.

| Preset              | Maße (px)                                                 | Kategorie    |
| ------------------- | --------------------------------------------------------- | ------------ |
| **Instagram Post**  | 1080 × 1080                                               | Social Media |
| **Instagram Story** | 1080 × 1920                                               | Social Media |
| **Facebook Post**   | 1200 × 630                                                | Social Media |
| Facebook-Titelbild  | 820 × 312                                                 | Social Media |
| **WhatsApp Status** | 1080 × 1920                                               | Messaging    |
| LinkedIn-Post       | 1200 × 627                                                | Social Media |
| **A4 Hochformat**   | 2480 × 3508 @300 dpi (im Fork: 794 × 1123 CSS-px × 3,125) | Print        |
| A4 Querformat       | 3508 × 2480 @300 dpi                                      | Print        |
| A5-Flyer            | 1748 × 2480 @300 dpi                                      | Print        |
| Visitenkarte        | 1050 × 600 @300 dpi                                       | Print        |

Instagram Portrait (1080 × 1350) fehlt in der Architektur und sollte ergänzt werden.

### R1.7 Hintergrund-Entfernung (ormbg) ✅

- **Modell:** `onnx-community/ormbg-ONNX` über `@huggingface/transformers`, WASM, Apache-2.0. IS-Net-CNN läuft im Browser stabil (BiRefNet stürzt ab).
- **Modelldateien selbst hosten** (ca. 40 MB, einmalig gecacht), Fortschrittsanzeige zeigen, 2 bis 5 s pro Bild.
- **Alpha-Bereinigung ist Pflicht**, weil die Rohausgabe einen Grauschleier hat:

```ts
import { pipeline, RawImage } from '@huggingface/transformers'

let segmenter: any = null
async function initSegmenter() {
  segmenter ??= await pipeline('background-removal', 'onnx-community/ormbg-ONNX', { device: 'wasm' })
  return segmenter
}

// ≤ 6 % → transparent, ≥ 80 % → opaque, smoothstep in between
function cleanAlpha(a: number): number {
  const x = a / 255,
    LOW = 0.06,
    HIGH = 0.8
  if (x <= LOW) return 0
  if (x >= HIGH) return 255
  const t = (x - LOW) / (HIGH - LOW)
  return Math.round(t * t * (3 - 2 * t) * 255)
}
```

- **Einstiegspunkte:** Bild-Tab im Element-Panel, Kontextmenü, optional beim Upload.
- **Lizenzhinweis (neu):** Unter AGPL wäre `@imgly/background-removal` jetzt formal kompatibel. Trotzdem bei ormbg bleiben: Sobald für einen Verkauf eine kommerzielle doop-Lizenz kommt, wäre jede AGPL-Abhängigkeit wieder ein Problem.

### R1.8 Fonts & Analytics ✅

**Fonts:**

- Kein Google-Fonts-CDN (LG München I, Az. 3 O 17493/20: IP-Übertragung ohne Einwilligung).
- Fontsource, nur WOFF2, Latin + Latin-Ext reichen. Über npm versionsgesichert.
- Fabric-spezifisch und damit **obsolet**: `applyFont()`, `initDimensions()`, `ensureFontsLoaded()` vor `toDataURL()`. Im Fork übernimmt der Browser bzw. Chromium das Laden. Der Export muss aber weiterhin warten, bis die Fonts geladen sind (`document.fonts.ready` vor dem Screenshot).
- Zweistufiges System (30–50 gebündelt, Vollkatalog on demand) **reduziert sich** auf die proWIN-Markenschriften. Freie Schriftwahl braucht nur der Creator-Modus.

**Rybbit (ursprüngliche Events):**

| Event                | Auslöser               |
| -------------------- | ---------------------- |
| `template_published` | Vorlage veröffentlicht |
| `template_forked`    | Vorlage verwendet      |
| `design_exported`    | Export                 |
| `upgrade_clicked`    | Paywall/Upgrade        |
| `ai_feature_used`    | KI-Funktion genutzt    |

- SPA-Navigation-Tracking in Rybbit aktivieren.
- **Sobald CSP gesetzt ist:** Rybbit-Host in `script-src` und `connect-src` aufnehmen.

### R1.9 Monetarisierung 🔄 (eingefroren)

- **Tarif-Vorschlag:** Free 0 € · Pro 9,99 €/Monat · Team 7,99 €/Nutzerin/Monat (min. 3) · Enterprise individuell.
- **Free-Limits (Vorschlag):** 5 Designs, 10 Exporte/Monat, kleines Wasserzeichen, keine KI.
- **Export-Limits:** Free bis 1080 px · Pro bis 4K · Enterprise zusätzlich CMYK-PDF.
- **Eingefroren** bis zur Klärung mit der Vertriebsleitung (Blumer-Schwelle, Rechnungsträger, Seat-Preise, Downline-Größen).
- **Dodo ersetzt durch Stripe** (doop: `billing.ts`, Team-Plan pro Seat). Das `usePaywall`-Muster bleibt als Idee: _ein_ Hook für alle gesperrten Features.

**Anhang B (Wettbewerb) muss neu geschrieben werden.** „proWIN aktuell: ❌ Personalisierung“ stimmt nicht mehr. Die Achse ist jetzt „Absender (proWIN-Abo) vs. Botschaft (dieses Tool)“.

### R1.10 Was aus der Architektur entfällt ❌

Fabric.js-Editor (Formen, Filter-Paletten, Freihand, Strichmuster, Gruppen) · Convex-Schema (§ 5) · TanStack-Start-Projektstruktur (§ 4.3) · Better-Auth-Convex-Adapter · Client-Export per `toDataURL()` (§ 8.1) · Server-Export-Optionen A–C (§ 8.2, jetzt Chromium) · **HTML/CSS-Export (§ 8.3) ist jetzt nativ**, weil Frames bereits HTML sind · Cloudflare/Convex-Kosten (§ 12.4) · Freepik-Stock-Integration (→ offen, siehe R4.6).

**Weiterhin gültige Risiken:** Mobile-Bearbeitung (hoch/hoch), Markenrecht („für proWIN-Beraterinnen“, nicht „von proWIN“, kein Logo ohne Erlaubnis), WASM-Speicher bei ormbg (Warnung unter 4 GB RAM), Lizenzprüfung jeder ML-Abhängigkeit.

---

## R2. Layout Guides & Zones (v0.1)

### R2.1 Was bleibt, was geht

| Schicht                                   | Status | Grund                                                                |
| ----------------------------------------- | ------ | -------------------------------------------------------------------- |
| **Safe Zones**                            | ✅     | Plattform-Overlays existieren unabhängig vom Editor                  |
| Guide Lines / Grid-Generator              | ❌     | Agent layoutet per CSS. doop hat eigene `SnapGuides` für den Creator |
| Layout Zones (`attract`/`contain`/`none`) | ❌     | Ersetzt durch Agent-Layout plus `data-od-role`                       |
| Layout Presets                            | 🔄     | Werden zu **Referenz-Frames** in der Design Memory (Umsetzung § 8.2) |

### R2.2 Safe-Zone-Werte ✅

| Preset                        | Safe Zone                                   | Grund                                |
| ----------------------------- | ------------------------------------------- | ------------------------------------ |
| Instagram Post (1080²)        | 50 px allseitig                             | Feed-Crop, Profilbild-Overlay        |
| Instagram Story (1080 × 1920) | oben 200, unten 250                         | Statusleiste, Sticker-/Swipe-Bereich |
| Facebook Post (1200 × 630)    | 50 px allseitig                             | Feed-Beschnitt                       |
| Facebook Cover (820 × 312)    | links 170, unten 75                         | Profilbild-Overlay                   |
| WhatsApp Status (1080 × 1920) | oben 150, unten 200                         | Statusleiste, Antwortfeld            |
| A4 Druck                      | 3 mm allseitig (85 px @300 dpi ≙ 11 CSS-px) | Druckbeschnitt                       |
| Visitenkarte                  | 3 mm allseitig (35 px @300 dpi)             | Druckbeschnitt                       |

**Verhalten (gilt weiter):** halbtransparentes rötliches Overlay (ca. 10 %) · orangene Umrandung an Elementen, die hineinragen · per Toggle ein- und ausblendbar · nie im Export · Creator darf pro Vorlage überschreiben (z. B. Hintergrundbild bis zum Rand).

### R2.3 Übertragbare Prinzipien ✅

- **„Leitplanken, kein Gefängnis“:** Warnen statt blockieren. Gilt für Safe Zones und für den Template-Guard bei weichen Regeln.
- **Meta-Daten getrennt von Inhalt:** Safe Zones gehören nicht ins Frame-HTML, sondern in UI-Overlay und Preset-Definition.
- Der Agent bekommt die Safe Zones als Text-Kontext (früher: `LayoutConstraintContext`).

---

## R3. Animationen (v0.1)

### R3.1 Konzept ✅

- **Zwei Ebenen:** Presets für Beraterinnen (Einblenden, Einfliegen, Zoom-In, Pulsieren, Schreibmaschine) und Timeline/Keyframes für Creator.
- **Phasen:** A Presets + GIF → B Timeline → C Video → D MP4, animiertes HTML, Marketplace-GIF-Thumbnails.
- **Entscheidungen bleiben:** GIF vor Video. Timeline nicht in Phase A. Feste Höchstdauer (z. B. 15 s GIF / 30 s Video), später eventuell nach Tarif gestaffelt. MP4 erst nach Beta-Feedback.

### R3.2 Technik 🔄

| Alt (Fabric.js)                                    | Neu (HTML-Frames)                                         |
| -------------------------------------------------- | --------------------------------------------------------- |
| Eigene Keyframe-Engine mit `requestAnimationFrame` | CSS `@keyframes`. Preset = Klasse am Element              |
| `AnimationTrack.objectId` (Fabric-ID)              | `data-od-id`                                              |
| Eigenes `animation`-Feld in Convex                 | CSS im Frame-HTML (Presets) oder `data-od-anim`-Attribute |
| GIF via `gif.js` clientseitig                      | **Serverseitig:** Chromium-Screencast → GIF/MP4           |
| WebM via `MediaRecorder` (iOS-Problem)             | entfällt, Server rendert                                  |
| MP4 nur über externen Microservice                 | direkt auf dem eigenen Server möglich (ffmpeg)            |

### R3.3 Edge Cases

| #    | Thema                          | Status im Fork                                                    |
| ---- | ------------------------------ | ----------------------------------------------------------------- |
| 4.1  | IDs beim Duplizieren           | 🔄 `data-od-id` beim Duplizieren neu vergeben                     |
| 4.2  | Editierbare Felder + Keyframes | ✅ Größenänderung bei animierten Feldern einschränken oder warnen |
| 4.3  | Snap stört Playback            | ❌ keine Snap-Engine mehr                                         |
| 4.4  | Fonts vor erstem Frame         | ✅ `document.fonts.ready` vor Capture                             |
| 4.5  | Performance auf Mobilgeräten   | ✅ Obergrenze animierter Elemente (z. B. 15)                      |
| 4.6  | iOS-WebM                       | ❌ Server rendert                                                 |
| 4.7  | Dateigröße                     | ✅ Höchstdauer, Kompressions-Presets                              |
| 4.8  | Wasserzeichen pro Frame        | ✅ falls Free-Tarif kommt: als Element vor Capture einblenden     |
| 4.9  | Undo bei Keyframe-Drag         | 🔄 doop-Undo, Commits entprellen                                  |
| 4.10 | Marketplace-Vorschau           | ✅ einmalig GIF-Thumbnail rendern, keine Live-Instanz             |
| 4.11 | `prefers-reduced-motion`       | ✅ respektieren, im Editor Autoplay nur auf Klick                 |

---

## R4. AI Assistant (v0.2)

### R4.1 Grundprinzip ✅

Die KI arbeitet **innerhalb von zwei Leitplanken**: Brand-Constraints (Farben, Schriften, Ton, Schreibweisen, Compliance) und Layout-Constraints (Format, Safe Zone, Template-Felder). Abgrenzung zu Canva: Canva kennt keine proWIN-Regeln.

### R4.2 Brand-Constraints → `DESIGN-prowin.md` 🔄

Das `BrandKit`-Interface wird zur Gliederung der Markdown-Datei:

| `BrandKit`-Feld                                                       | Abschnitt in `DESIGN-prowin.md`                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `colors` (primary, secondary, accent, background, text, palette)      | Farben als Tokens (`--primary` …) + Hex                          |
| `fonts` (heading, body, accent mit Gewichten)                         | Typografie                                                       |
| `tone` (professionell / freundlich / energetisch / luxuriös / nahbar) | Markenkern & Tonalität                                           |
| `language`                                                            | Sprache (Deutsch, Du-Ansprache?)                                 |
| `compliance.brandName`                                                | exakte Schreibweise der Marke                                    |
| `compliance.productNames`                                             | Produktnamen-Tabelle (exakte Schreibweisen)                      |
| `compliance.forbiddenTerms`                                           | Do/Don't                                                         |
| `compliance.requiredDisclaimer`                                       | Pflicht-Zusatz, z. B. „Unabhängige/r proWIN Berater/in“ (prüfen) |
| `compliance.logoUsageNote`                                            | Logo-Regeln                                                      |
| `styleGuidelines`                                                     | Freitext-Stilregeln                                              |

Die Ausgabe-Regeln aus dem System-Prompt (§ 3.3) gehen in den Agent-Prompt über: alles innerhalb der Safe Zone, nur Brand-Farben und -Schriften, `maxLength` einhalten, Produktnamen exakt.

### R4.3 Requesty EU 🔄

**Prüfstand vom 24.10.2026 (TASK-15):** [Prüfprotokoll und Benchmark](requesty-pruefung.md). Die vorhandenen Policies ersetzen die früher vorgeschlagenen Modellketten.

- **Gateway:** `https://router.eu.requesty.ai/v1`. Für durchgängige EU-Verarbeitung müssen zusätzlich sämtliche Modelle einschließlich Fallbacks EU-gehostet sein. Organisationsweite EU-Erzwingung und EU-only Approved Models sind gesondert zu prüfen. [EU-Routing-Dokumentation](https://docs.requesty.ai/features/eu-routing).
- **Policy-Syntax bestätigt:** `policy/<name>`; beide bestehenden Policies liefern authentifiziert HTTP 200. [Fallback-Dokumentation](https://docs.requesty.ai/features/fallback-policies).
- **Kosten:** `response.usage.cost` in USD wurde in den Testantworten gemessen. Bei Streaming ist `stream_options.include_usage` erforderlich. ZDR, DPA und Gebühren nicht pauschal aus der EU-URL ableiten. [Kosten-Dokumentation](https://docs.requesty.ai/features/cost-tracking).

| Bestehende Policy          | Im Test tatsächlich verwendetes Modell   | Noch offen                                                                                                 |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `policy/prowin-text-gen`   | `azure/gpt-5.4@germanywestcentral`       | GPT-5.5 als im Screenshot sichtbarer Primärkandidat liefert direkt HTTP 404; vollständige Kette bestätigen |
| `policy/prowin-layout-gen` | `bedrock/claude-sonnet-5-5@eu-central-1` | Exakte IDs, Reihenfolge und Nutzbarkeit der übrigen Fallbacks bestätigen                                   |

Die früher genannten sieben `@eu`-Modell-IDs sind im öffentlichen Modellkatalog vom 24.10.2026 **nicht enthalten und nicht freigegeben**. [Katalogevidenz](evidence/requesty-public-catalog-2026-10-24.json). `prowin-vision` und `prowin-design-agent` erscheinen nicht im authentifizierten Katalog; ihre Existenz wird nicht vorausgesetzt.

Für TASK-16 ist die bestehende `policy/prowin-layout-gen` ein **Integrationskandidat** für den Agenten. Tool-Calling und Vision müssen auch für jeden einzelnen Fallback nachgewiesen werden. Die Policy-Capability-Flags allein reichen nicht: Die API beschreibt sie ausdrücklich als pauschale Platzhalter.

Der [Testkorpus](evidence/requesty-benchmark-corpus.json) enthält 20 deutsche Textprompts und 10 Agent-Briefs. Der vollständige Resident-Benchmark benötigt den Requesty-Pfad aus TASK-16, Ausgangsframes und Brand-Fixtures; isolierte API-Tests ersetzen diese Abnahme nicht.

### R4.4 Die fünf Features im Fork 🔄

| Feature (Spec)                             | Im doop-Fork                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Text-Assistent (Feld / alle Felder füllen) | Element-Kommentar bzw. „KI-Wunsch“ an einem `data-od`-Element. Batch über eine Agent-Aufgabe                       |
| Layout-Generator (Zonen erzeugen)          | ❌ entfällt, der Agent schreibt direkt das Layout                                                                  |
| Bild-Generator                             | Magnific-Adapter in `imageGen.ts`. Prompt-Enhancement aus Brand-Bildsprache, „no text, no logos, no watermarks“    |
| Design-Komplettierung                      | **Ist der doop-Agent.** Die Spec-Empfehlung „schrittweise statt ein Riesen-JSON“ erfüllt der Agent-Loop von selbst |
| Brand-Extraktion (aus JPEGs)               | Teilweise durch Magnific Brand Kit und den Distiller abgedeckt. `DESIGN-prowin.md` bleibt die Quelle               |

### R4.5 Limits, UX und Kosten 🔄

- **Usage-Limits (Vorschlag aus der Spec, pro Pro-Nutzerin und Monat):** Text 100 · Layout 30 · Bild 20 · Komplett-Design 10 · Brand-Analyse 3. Free: keine KI, eventuell 5 Probeaufrufe. Im Fork über das Allowance-System (Umsetzung § 7.3).
- **UX-Prinzipien bleiben:** drei Vorschläge statt einem · „Übernehmen / Anpassen / Nochmal“ (Nochmal mit leicht erhöhter Temperatur) · Bildgenerierung nur auf ausdrücklichen Klick (Kostenkontrolle).
- **Einmaliger KI-Hinweis in der UI** (Text aus § 6.3 übernehmen und um Magnific ergänzen).

### R4.6 DSGVO ✅ (Datenfluss angepasst)

| Datenkategorie                         | An ein Modell?                  | Hinweis                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame-HTML (Struktur + Text)           | ✅ Requesty                     | ZDR                                                                                                                                                                                               |
| Screenshots für Agent-Selbstprüfung    | ✅ Requesty (Vision)            | **Neu gegenüber Spec v0.2:** Bilddaten gehen jetzt regelmäßig raus. Der UI-Hinweis muss das sagen                                                                                                 |
| Personenbezogene Daten (Name, Telefon) | ⚠️ stehen im HTML der Beraterin | **Neu:** Die Spec-Aussage „keine pbD“ gilt im Fork nicht mehr automatisch. Optionen: Platzhalter-Ersetzung vor dem Agent-Call oder Rechtsgrundlage plus Hinweis (→ offene Frage in der Umsetzung) |
| Bildprompts an Magnific                | ✅                              | ohne pbD (Filter im Adapter)                                                                                                                                                                      |
| Brand Kit                              | ✅                              | keine pbD                                                                                                                                                                                         |

**Compliance-Checkliste für den Pitch** (Art. 5(1)(c), 5(1)(e), 17, 28, 44–49, kein Training): Die Struktur bleibt. Die Nachweise müssen für Requesty **und** Magnific gelten, und die pbD-Zeile muss neu bewertet werden.

**Offene Frage aus der Spec:** Freepik-Stock (jetzt Magnific) für Stockfotos nutzen? Wenn ja, Lizenz- und Attributionspflichten tracken.

---

## R5. Template Marketplace (v0.1)

### R5.1 Strategie ✅

Offen und kostenlos, ein Community-Ökosystem statt Shop. **Pitch-Metriken:** monatlich aktive Beraterinnen · Templates im Marketplace · Nutzungsrate (Forks pro aktiver Nutzerin) · Anzahl Creator · Ø-Bewertung · organisches Wachstum · Retention nach 30/60/90 Tagen · Verhältnis Export zu Fork.

### R5.2 Abgleich mit doops Community-Gallery

| Spec-Feature                                       | doop heute                                                 | Lücke                                                                |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Veröffentlichen mit Titel, Beschreibung, Kategorie | ✅ `publishedAt`, `description`, `category` auf `canvases` | Tags, Kurzbeschreibung                                               |
| Fork („Verwenden“)                                 | ✅ Kopie, `copyCount`                                      | Rückverweis auf Original                                             |
| Vorschaubilder (statische Mockups)                 | 🔄 Thumbnails über `/i/<frameId>`                          | 1–5 Varianten-Bilder                                                 |
| Sharing-Stufen privat / Team / Link / öffentlich   | ✅ privat, Workspace, Link, Gallery                        | Link heißt in doop **Mitbearbeiten**. Ein reiner Ansichts-Link fehlt |
| Suche, Filter (Format, Kategorie)                  | prüfen                                                     | Format-Filter braucht `preset`                                       |
| Bewertungen (nur nach Fork)                        | ❌                                                         | Phase B                                                              |
| Creator-Profile, Badges, Trust-Level               | ❌                                                         | Phase B                                                              |
| Moderation (Auto-Check, Melden, Admin-Queue)       | teils (Admin-Bereich)                                      | Melden-Button, Review-Queue                                          |
| Folgen, Feed, Collections                          | ❌                                                         | Phase C                                                              |

**Weiter gültige Entscheidungen:** Ein Fork ist eine Momentaufnahme (spätere Updates erreichen nur neue Forks). Bewerten nur nach Nutzung. Creator-Profil wird beim ersten Veröffentlichen angelegt. Statische Vorschau statt Live-Renderer. Keine eigene Mobile-Ansicht nötig. Erst einfache Sortierung, Empfehlungen später.

**Kategorien:** Social Media (Insta Post/Story, Facebook, WhatsApp) · Print (Flyer, Visitenkarte, A4) · Einladungen & Events · Produkt-Aktionen · Team-Recruiting · Saisonales.

**Community-Richtlinien** (inkl. Konsequenzen 1./2./3. Verstoß) aus Spec § 7 übernehmen. Ergänzung: KI-generierte Inhalte vor Veröffentlichung prüfen.

---

## R6. Deployment (v0.2)

**Fast vollständig obsolet.** Cloudflare Workers, Wrangler, Convex Cloud EU, Dodo-Webhooks, Convex-Kostenprojektion und Better-Auth-Convex-Adapter fallen weg. Ersetzt durch Umsetzung § 13 (Coolify).

**Übertragbare Prinzipien:**

- **Secrets nie committen.** Für Coding-Agents API-Tokens über `.env` statt interaktivem Login. Scope eng halten, bei Kompromittierung sofort widerrufen.
- **Kosten-Alerts** von Anfang an (jetzt: Requesty-Budget, Magnific-Limits).
- **Vor-Start-Checkliste** als Format beibehalten.

**Auftragsverarbeiter für die Datenschutzerklärung (neu):**

| Dienst                   | Rolle                               | Standort                                                                               |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Hetzner                  | Hosting (Coolify, Postgres, Assets) | DE                                                                                     |
| Requesty                 | KI-Gateway                          | Frankfurt, ZDR                                                                         |
| Magnific (ehem. Freepik) | Bildgenerierung                     | prüfen                                                                                 |
| Stripe                   | Zahlungen (erst wenn aktiviert)     | prüfen                                                                                 |
| Rybbit                   | Analytics                           | eigene Instanz                                                                         |
| Resend                   | Transaktions-E-Mails (SMTP)         | Versand eu-west-1, **Speicherung von Konto- und Log-Daten in den USA** → DPA + DPF/SCC |

---

## R7. Evaluiert & verworfen (übernommen)

| Option                               | Ursprünglicher Grund                      | Neubewertung im Fork                                                                      |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@imgly/background-removal`          | AGPL                                      | Bleibt verworfen: Bei kommerzieller doop-Lizenz wäre es wieder ein Problem (R1.7)         |
| BiRefNet                             | WASM-Speicherabstürze                     | bleibt verworfen                                                                          |
| Sharp                                | nicht auf Cloudflare Workers              | wäre jetzt möglich, aber unnötig (Chromium-Export)                                        |
| TanStack AI                          | Agent-Framework, kein Multi-Turn-Bedarf   | irrelevant (doop bringt eigenen Agent-Loop)                                               |
| EVE (Vercel)                         | braucht langlaufenden Prozess, Agent-Loop | Prozess-Argument entfällt. Die Grundsatzfrage Agent vs. Workflow ist offen (Umsetzung Q1) |
| Self-Hosted Convex auf VPS           | I/O, Betriebsaufwand                      | irrelevant (kein Convex)                                                                  |
| Vercel                               | Hobby nicht kommerziell, Pro zu teuer     | bleibt verworfen                                                                          |
| Next.js via vinext                   | Abstraktionsschicht, RSC passt nicht      | irrelevant                                                                                |
| Eigene Provider-Abstraktion für LLMs | durch Requesty überflüssig                | gilt weiter                                                                               |
| Interaktive Marketplace-Vorschau     | Performance                               | gilt weiter                                                                               |

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.2     | 2026-10-23 | R6: Stalwart durch Resend ersetzt (inkl. US-Speicherung)                                                                                                    |
| 0.1     | 2026-10-22 | Erstfassung: sechs Specs konsolidiert, Status pro Abschnitt, Mapping auf den doop-Fork, neue DSGVO-Punkte (Screenshots an Vision-Modell, pbD im Frame-HTML) |
