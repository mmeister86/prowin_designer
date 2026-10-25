# TASK-19: M1-Abnahme der Bereinigung

Prüfstand: 25.10.2026, gemeinsamer Arbeitsstand nach den abgenommenen TASK-3–18.
Die Prüfung bezieht sich auf den vorhandenen, teilweise uncommitteten Checkout;
sie behauptet keine Prüfung eines veröffentlichten Releases.

## Umfang und Entscheidung

M1 umfasst die beschlossenen Entfernungen aus [Umsetzung §6](doop-fork-umsetzung.md#6-phase-1-chirurgische-entfernung)
und den Erhalt der dort genannten Kernfunktionen. Statische Prüfungen durch Spock
und Furiosa fanden keinen aktivierbaren Restpfad der entfernten Integrationen.
Die technischen Kriterien sind mit den unten genannten Nachweisen erfüllt.
Der Nutzer hat TASK-19 am 25.10.2026 ausdrücklich abgenommen; der Backlog-Status ist **Done**.

M1 ist keine Freigabe der späteren Datenschutz-, Branding-, Bildprovider- oder
Distributionsmeilensteine. Insbesondere sind die expliziten Legacy-Serverprovider
Anthropic/Azure und die serverfinanzierten Bildprovider noch vorhanden.
Boot-Guard und vollständige Egress-Abnahme gehören zu TASK-20/22, Magnific zu TASK-38–41.
Keine neuen direkten Provider wurden für diese Abnahme ergänzt.

## Entfernte Integrationen

| Bereich                       | Ergebnis und Abgrenzung                                                                                                                                                  | Nachweis im Testbestand                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linear / Slack                | Module, Konfiguration und Registrierungen entfernt; `server/extensions.ts` exportiert eine leere Registry. Eigene Canvas-Webhooks bleiben erhalten.                      | `syncMigrations.test.ts`, `webhooks.test.ts`, `workspaces.test.ts`; Registrierung zusätzlich statisch geprüft                                      |
| GitHub-App / Repo-Import      | Keine App-, Recon- oder Importpfade; alte Verbindungen werden migriert, importierte Designs bleiben. GitHub als Quellcode-/Deployment-Plattform bleibt unabhängig davon. | `prowinRemovalMigrations.test.ts`                                                                                                                  |
| Gemini Cloud Worker           | Kein Worker-, Cloud-MCP- oder Routingzweig. Serverseitige Gemini-Bilder sind eine separate, noch erhaltene Bildfunktion.                                                 | `localAgentRouting.test.ts`                                                                                                                        |
| ChatGPT-App / Plugin          | Eigener App-/Plugin-Einstieg entfernt. Allgemeiner MCP-Zugang einschließlich OAuth bleibt.                                                                               | `connectModal.test.tsx`, `access.test.ts`, `mcp-tools.test.ts`                                                                                     |
| BYO-Modellkonten              | Keine UI-, Credential-, OAuth-/Device- oder Inferenzpfade; authentifizierte Alt-API einschließlich Unterpfaden antwortet mit 410.                                        | `modelAccountRemoval.test.ts`, `modelAccountRemovalMigration.test.ts`, `agentExecutionUi.test.tsx`, `imageGen.test.ts`, `requestyProvider.test.ts` |
| Design Sync / Live-App-Import | Kein Ingest-, Sync-Key- oder Snippet-Pfad; Sync-Tabellen entfernt.                                                                                                       | `prowinRemovalMigrations.test.ts`                                                                                                                  |
| Webseiten-Import              | Importer, Context.dev und Chromium-Importfallback entfernt; Chromium für Frame-Screenshots und Export bleibt nötig.                                                      | `mcp-tools.test.ts`, `homeHero.test.tsx`, `frameExport.test.ts`, `frameExportModal.test.tsx`                                                       |
| Website-Publishing / Viewer   | Website-Publishing und `view_website` entfernt; Canvas-Zugriff und Gallery-Veröffentlichung bleiben.                                                                     | `mcp-tools.test.ts`, `community.test.ts`, `access.test.ts`                                                                                         |
| SSO/OIDC / Microsoft          | Provider und Discovery entfernt; E-Mail/Passwort, Google und Apple bleiben. Die iOS-App liest `/api/login-providers`.                                                    | `loginProviders.test.ts`, `loginProvidersConfig.test.ts`, `appleSignIn.test.ts`, `desktopAuth.test.ts`                                             |
| PostHog                       | SDK, Konfiguration und Relay entfernt; Server-Analytics ist No-op, Legacy-Keys aktivieren keinen Transport.                                                              | `analytics.test.ts`, `analyticsRelayRemoval.test.ts`                                                                                               |

Für mehrere alte Integrationsrouten existiert keine vollständige historische
HTTP-Negativmatrix. Ihre Entfernung wurde anhand der aktiven Routen, Imports,
MCP-Registrierungen und Konfiguration geprüft. Historische Migrationen und
Beschreibungstexte gelten nicht als aktivierbare Integration.

## Begründete Ausnahmen aus TASK-12

`shared/prowin/features.ts` hält Meta Ads, Refero, Hintergrundbibliothek und
Automations unverändert auf `false`. Das ist die beschlossene Deaktivierung,
keine vollständige Code- oder Datenlöschung. Alte Keys können die Flags nicht umgehen.

| Ausnahme              | Wirksame Grenzen                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta Ads              | HTTP-Router und Graph-Client verweigern vor dem externen Aufruf.                                                                                                                                                                       |
| Refero                | Keine produktive MCP-/Resident-Registrierung; direkte Suche bleibt leer.                                                                                                                                                               |
| Hintergrundbibliothek | Kein Seed, Import, Thumbnailabruf oder Tagging; bereits gespeicherte lokale `/bg`-Assets bleiben erreichbar. Externe Bestands-URLs werden nicht umgeschrieben. Das dormant Tagging ist durch TASK-17 bereits auf Requesty vorbereitet. |
| Automations           | Keine Navigation, direkte App-Route, HTTP-Nutzung, Scheduler-Ticks oder Ausführung. Gespeicherte Workflows bleiben erhalten.                                                                                                           |

Nachweise: `optionalFeatures.test.ts`, `optionalFeatureRoutes.test.ts` und
`optionalNavigation.test.tsx`. Positive Tests alter Funktionen aktivieren diese
ausschließlich in einer lokalen Testfixture.

## Erhaltene Kernfunktionen

| Kernfunktion           | Erhalt und ausgeführte Vertragsprüfung                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Agent            | `server/localAgent.ts`, `server/prowin/permissions.ts`, `localAgentRuns.ts`: aktuelle Creator-/Admin- und Canvas-Rechte. Offline-Opt-in pausiert ohne stillen Serverfallback. Serverwechsel bleibt trotz hängendem Native-Status erreichbar; nachträgliche Serverzulassung wird gemessen. Tests: `prowinLocalAgent`, `localAgentMcp`, `localAgentRuns`, `localAgentRouting`, `localAgentSelection`, `localQueueAdmission`, `serverAdmission`, `agentExecutionUi`. |
| Web / Desktop          | Gemeinsame Web-UI und Tauri-Bridge erhalten. Browser-, Auth- und Deep-Link-Verträge: `drawingBrowser`, `pageCanvasBrowser`, `pageControlsBrowser`, `desktopAuth`, `desktopLinks`, `localClaudeBrowser`, `localClaudeConnection`.                                                                                                                                                                                                                                  |
| iOS                    | SwiftUI-App, REST-/Socket-Client und native Canvas-Pfade vorhanden; Google-/Apple-Verträge und native Checks bleiben im Repository. Serverseitige Authverträge durch `loginProviders`, `appleSignIn` geprüft. Kein nativer Build in dieser Abnahme.                                                                                                                                                                                                               |
| APNs / Live Activities | Router, Geräte-/Activity-Registrierung und APNs-Transport erhalten; `liveActivities` und `liveActivityDelivery` prüfen Rechte, Payloads, Wiederholungen und Tokenbereinigung mit simuliertem Zustelldienst.                                                                                                                                                                                                                                                       |
| Webhooks               | Canvas-Events und Router bleiben verdrahtet; `webhooks` und `webhookRoutes` prüfen Zugriff, Signatur, Retry und SSRF-Grenzen.                                                                                                                                                                                                                                                                                                                                     |
| Workspaces             | Mitglieder, Rollen, Canvas-Zugriff und Betrieb ohne Stripe bleiben; `workspaces`, `prowinPermissions`, `prowinCapabilities` prüfen auch Zugriffsentzug.                                                                                                                                                                                                                                                                                                           |
| Gallery                | Community-Router und UI bleiben; `community` prüft Veröffentlichung, Kopie, Inhaltsprüfung und Persistenz.                                                                                                                                                                                                                                                                                                                                                        |
| Design Memory          | Referenzen, Entscheidungen, Guideline-Historie und Vorschläge bleiben. `requestyDistill`, `duplicatePersistence`, `mcp-comments-write`; zusätzlich `memoryAcceptance` für reale HTTP-Annahme/Ablehnung, Rechte, Referenz-Pinnen/-Entfernen, wiederholte Auflösung und Serverneustart.                                                                                                                                                                             |
| MCP                    | Standard-MCP, OAuth/Consent, Agent-Keys, Tools und Local-MCP bleiben. `mcp-tools`, `mcp-comments`, `mcp-comments-write`, `agentKeys`, `access` sowie der ausgepackte Claude-Extension-Test.                                                                                                                                                                                                                                                                       |
| Optionale Pexels-Suche | `server/imageSearch.ts` prüft den Key vor Fetch; MCP/Resident verwenden denselben Schutz. `imageSearch` prüft direkten Aufruf und MCP ohne Key ohne Netzwerk sowie Request und Ergebnis mit synthetischem Key. Keine echte Pexels-Anfrage.                                                                                                                                                                                                                        |

Testnamen ohne Endung stehen für die gleichnamigen Dateien unter `tests/`.

## Screenshot der Einstellungen

Der vom Nutzer als aktueller Prüfstand eingeordnete Screenshot zeigt die zentrale
proWIN-Agent-Karte, den lokalen Claude-Desktop-Hinweis und die serverseitige Bildmodellwahl.
Es sind keine privaten Verbindungsformulare sichtbar. Die Local-Zeile wird nur für
Creator/Admin gerendert; sie belegt weder eine BYO-Reaktivierung noch einen lokalen
Lauf im Browser. Die sichtbare Kontingentanzeige ist Serverbetrieb.

Die gemischte Benennung „Doop Agent“/„proWIN Agent“ und die verschachtelten Karten
bleiben im Rahmen von M3 zu vereinheitlichen. Der Ersatz der alten Bildmodellwahl
durch Magnific gehört zu TASK-39. Der Downloadlink in `LocalClaude.tsx` verweist
noch auf die Upstream-App; eine passende proWIN-Desktop-Auslieferung ist für den
Testzugang in TASK-50 gesondert zu prüfen.

## Änderungen dieser Abnahme

- Gezielte Pexels-Key-/MCP-Tests in `tests/imageSearch.test.ts` ergänzt.
- Reale Memory-Routen und ihre Persistenz in `tests/memoryAcceptance.test.ts` geprüft;
  synthetische Vorschläge nur in der gestoppten temporären PGlite-Datenbank angelegt.
- Veraltete Bildkostenhinweise in Resident-Systemprompt, Bildtool und MCP-Guide
  auf den zentral konfigurierten Bilddienst korrigiert; private Kontenpriorität
  aus dem Kommentar in `.env.example` entfernt.
- Leere oder ausschließlich aus Whitespace bestehende Systemnachrichten im
  Requesty-Transport weggelassen. Nichtleere Systemprompts bleiben unverändert.
  CodeRabbit meldete hierzu einen Minor-Kompatibilitätsbefund; zwei zuvor rote
  Fetch-Grenztests sichern die Korrektur. Keine Live-Provider-Kompatibilität behauptet.
- Bei abgelehnten Servercredentials oder nicht verfügbarer Policy pausiert der
  Resident die Arbeit mit einem Administratorhinweis. Rohe Providerdiagnosen
  gelangen nicht in den sichtbaren Fehlergrund. Zwei reale Resident-Integrationstests
  mit simulierten HTTP-401-/404-Antworten reproduzierten zuvor den generischen Retry-Hinweis.
- Historische Phase-0-Konfiguration im Umsetzungsplan gekennzeichnet und die
  aktuelle Integrationsbeschreibung in der README synchronisiert.

## Ausführung und Grenzen

Die Tests starten ausschließlich isolierte Server und temporäre PGlite-Datenbanken.
Es wurde kein Server gegen echte Anwendungsdaten gestartet, keine produktive Migration
ausgeführt und keine bezahlte Inferenz beauftragt.

Abschließender Lauf nach allen Codekorrekturen, strikt sequenziell:

```sh
bun run typecheck
bun run test --maxWorkers=4 --exclude tests/claudeExtension.test.ts
bun run test tests/claudeExtension.test.ts --maxWorkers=1
bun run build
```

Tatsächlich unter Bun 1.3.10 über `npx --yes --package=bun@1.3.10 -c '…'`
ausgeführt; die Schritte waren mit `&&` verbunden. Gesamtprozess: Exit 0.

| Prüfung                                               | Ergebnis                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                   | Bestanden                                                                                                |
| Tests, Hauptgruppe                                    | **136 Dateien / 984 Tests bestanden**, 106,90 Sekunden                                                   |
| Tests, Claude-Extension                               | **1 Datei / 4 Tests bestanden**, 16,27 Sekunden                                                          |
| Gesamtabdeckung beider Gruppen                        | **137 Dateien / 988 Tests bestanden**, keine übersprungenen Tests                                        |
| `bun run build`                                       | Bestanden; vorhandener Hinweis auf große Frontend-Chunks bleibt                                          |
| Oxlint, gesamte Arbeitskopie                          | Bestanden                                                                                                |
| ESLint ohne `data/requesty-evaluation/run-checks.mjs` | Bestanden, `--max-warnings 0`                                                                            |
| Standard-`bun run lint`                               | **Nicht bestanden:** 14 bekannte `no-undef`-Fehler ausschließlich im lokal ignorierten Evaluationsskript |
| Prettier, geänderte Code-/Markdown-Dateien            | Bestanden                                                                                                |
| `git diff --check`                                    | Bestanden                                                                                                |
| `npm run doc-lint`                                    | Bestanden, keine Warnungen                                                                               |
| Unabhängige statische Nachprüfung                     | Leia Organa: PASS nach allen Korrekturen                                                                 |

Die Gesamtsuite läuft in zwei aufeinanderfolgenden Gruppen: Der Claude-Extension-Test
schreibt sein Paket nach `public/claude-extension`; parallel laufende Vite-Browserfixtures
können dadurch neu laden. Die zweite Gruppe ist Bestandteil der Gesamtabdeckung,
kein ausgelassener Test. Bun 1.3.10 wird über ein temporäres npm-Paket bereitgestellt,
weil es in der anfänglichen Shell nicht im PATH liegt.

Ein Zwischenlauf wurde durch eine versehentlich parallel gestartete Build-Paketierung
gestört (fünf Timeouts in `drawingBrowser.test.ts`). Nach Entfernung dieses
Schreibzugriffs liefen die Browsertests in den vollständigen isolierten Prüfungen grün.
Der oben ausgewiesene Abschlusslauf enthält alle Codekorrekturen und startet den Build
erst nach beiden Testgruppen; Timeouts oder Produkttests wurden dafür nicht abgeschwächt.

Native Desktop-/iOS-Builds, echte Claude-CLI-Ausführung, Gerätesignierung, OAuth bei
externen Providern, tatsächliche APNs-Gerätezustellung und PostgreSQL-Produktbetrieb
sind hier nicht ausgeführt. Die Workflows `desktop.yml` und `ios.yml` bleiben erhalten;
ihre Existenz ist kein Nachweis eines erfolgreichen nativen Builds dieses Checkouts.

Der bereits vor TASK-19 bekannte Standard-Lintfehler in der lokal ignorierten
Datei `data/requesty-evaluation/run-checks.mjs` bleibt separat auszuweisen.

## Review-Befunde und Einordnung

Spock prüfte statisch die Entfernungen, Furiosa die erhaltenen Kernfunktionen.
Leia Organa bestätigte nach Nachbesserung die positive Referenzpersistenz und die
konsistenten zentralen Bildkostenhinweise. Diese Agenten führten selbst keine Tests aus.

CodeRabbit wurde mit `review --agent --uncommitted --include-untracked` über den
gemeinsamen TASK-15–19-Arbeitsstand ausgeführt. Runde 1 prüfte 89 Dateien und meldete
den behobenen Minor zu leeren Systemnachrichten. Runde 2 meldete einen Minor zur
alten privaten Kontenpriorität in `.env.example`; ebenfalls behoben. Runde 3
prüfte 94 Dateien und meldete vier **Major**-Verdachtsfälle:

| Befund                                             | Prüfung und Ergebnis                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claims können bei Admission-Fehlern hängen bleiben | Bereits abgefangen: `prepareServerWork` umfasst Snapshot und Transaktion in `try/catch`, ruft den passenden Fehlerhandler auf und gibt `false` zurück. `serverAdmission.test.ts` prüft beide Fehlerarten und den Erhalt einer früheren Zulassung. Keine zusätzliche Änderung erforderlich. |
| Providerfehler empfehlen nur Retry                 | Bestätigt und behoben: typisierte Credential-/Modellfehler führen über den Resident zu einem festen Administratorhinweis. Unbekannte Fehler behalten den bisherigen generischen Text; interne Providerantworten werden nicht übernommen.                                                   |
| Leerer OpenAI-Bildrouter ohne Default              | Bereits abgefangen: `presentVars` in `server/env.ts` behandelt leere/Whitespace-Werte als ungesetzt, danach greift der deklarierte `DOOP_IMAGE_ROUTER_MODEL`-Default. Der allgemeine Blank-/Default-Vertrag wird in `env.test.ts` geprüft.                                                 |
| Anthropic erhält implizit Requesty-Policy          | Bereits abgefangen: `parse` in `server/env.ts` setzt bei explizitem Anthropic-Provider und fehlendem Modelloverride `claude-opus-5`. Ein ausdrücklich gesetzter Modelloverride bleibt Betreiberkonfiguration und muss beim Providerwechsel passend gewählt werden.                         |

Die Major-Einstufung ist die Einstufung des Reviewtools; die Tabelle hält die
anschließende konkrete Codeprüfung fest. Das Review wird nicht als findings-frei dargestellt.

Leia Organa prüfte anschließend auch die Providerfehlerkorrektur, beide neuen
Integrationstestfälle und die drei verworfenen Major-Verdachtsfälle: **PASS**,
keine konkreten neuen Findings. Diese Freigabe ist eine statische Nachprüfung;
die tatsächlich ausgeführten Checks sind separat dokumentiert.
