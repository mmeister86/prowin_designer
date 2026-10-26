# Deutsche App: Prüfprotokoll und manuelle Abnahme

Stand: 26. Oktober 2026, TASK-68 / Integration TASK-68.6. Technische Umsetzung,
breiter unabhängiger Gesamt-Review und Nachprüfung der finalen Korrekturen sind
abgeschlossen. Sie ersetzen nicht die ausdrückliche manuelle Nutzerabnahme.
Der Controller pflegt Backlog und Status; keine Aufgabe wurde geschlossen.

## Umfang und Sprachvertrag

Deutsch ist die feste App-Sprache mit freundlicher Du-Ansprache. Enthalten sind
eigene Web-Oberflächen einschließlich Editor, Administration, Einstellungen,
Freigaben, Konto, Suche, Export, Kommentare, Aufgaben, Designwissen, Onboarding,
Accessibility-Texte und derzeit deaktivierte optionale Oberflächen. Dazu kommen
sichtbare Servermeldungen, eigene E-Mails, neue Standardnamen, Willkommensdemo,
Beispielprompts, gemeinsame Anzeigenamen, HTML-Metadaten und sichtbare
Claude-Erweiterungsmetadaten. Desktop umfasst Rust-Menüs und Dialoge,
Installer-Sprache und das tatsächliche DMG-PNG. iOS umfasst App und die separate
Live-Activity-Extension mit ihren jeweiligen Sprachdeklarationen.

| Begriff   | Anzeige        |
| --------- | -------------- |
| Canvas    | Arbeitsfläche  |
| Frame     | Zeichenfläche  |
| Workspace | Arbeitsbereich |
| Layer     | Ebene          |
| Owner     | Eigentümer     |
| Member    | Mitglied       |
| Memory    | Designwissen   |
| Task      | Aufgabe        |
| Agent     | Agent          |
| AI        | KI             |
| Creator   | Creator        |

Marken-, Produkt-, Modell- und Schriftfamiliennamen bleiben erhalten. Community,
Layout, HTML, CSS, PNG, JPG, MCP, API und Webhook dürfen als Fachbegriffe bleiben.
Anzeigen verwenden `de-DE` beziehungsweise `de_DE`, relative Zeiten Deutsch.
USD bleibt USD mit unveränderten Beträgen; deutsche Formatierung ist keine
Währungsumrechnung. Technische Zahlen bleiben maschinenlesbar.

Bestehende Namen, Kommentare, Designs, HTML, Aufgaben, Statusmeldungen und
gespeicherte Vorlagen werden nicht nachträglich übersetzt. Neue Agentenantworten
erhalten Deutsch als Standard; ausdrückliche Sprachwünsche und technische
Tool-Verträge bleiben maßgeblich. Unbekannte externe Fehler werden durch sichere
deutsche Ersatzmeldungen abgefangen; eigene geprüfte Wiederherstellungshinweise
bleiben sichtbar. Native tatsächliche CLI-/Agentenergebnisse bleiben Inhalt.

IDs, Rollenwerte, JSON-Schlüssel, Fehlercodes, URLs, Routen, CSS-Werte,
Tastaturkürzel, Header und Modell-IDs bleiben erhalten. Kein Sprachumschalter,
keine neue Abhängigkeit, kein i18n-Framework; keine Änderung an Datenschutz,
Rollen, Preisen, Berechtigungen, Feature-Flags oder Deployment.

## Entscheidungen aus dem Ledger

Die folgenden vier Rulings einschließlich der genannten Kosten sind wörtlich aus
dem Ausführungsledger übernommen:

- Ruling: Continue past the two baseline timeouts after their focused rerun passed — failures were timing-only before any product edit — cost if wrong: an intermittent baseline regression may require further diagnosis during final verification.
- Ruling: Use serial implementers and uncommitted per-task/fix snapshot diff packages; normalize task headings to Task N — the approved plan permits parallelism but chosen SDD requires serial work, and the plan forbids unrequested commits — cost if wrong: slower execution and no commit-based recovery; reports and snapshots remain available.
- Ruling: Include fixed Resident UI status/error strings in Task3 and allow its narrow Webhooks pause-prefix compatibility fix — spec requires all own human text, while plan wording accidentally limited Resident to its prompt language — cost if wrong: a few extra copy changes and a small shared UI diff requiring review.
- Ruling: Permit a minimal explicit trusted UI-error type in api.ts for Task2 recovery messages — plain Error must not bypass safe external-error fallback, yet copy-preservation/path-reopen instructions must reach users — cost if wrong: one small shared error contract and its regression tests.

Weitere verbindliche Ausführungsentscheidungen: serielle Implementierung in der
Reihenfolge 3, 1, 2, 4, 5, 6 im isolierten Worktree; unveröffentlichte
Diff-Snapshots statt Commits. Kein `.env` und keine Produktionsdaten aus dem
Originalcheckout übernommen. Die vorigen fünf Teilaufgaben durchliefen ihre
unabhängigen Reviews und notwendigen Korrekturrunden; keine verworfenen,
geparkten oder kleinen Befunde wurden als offene Restarbeit übernommen.

Die vollständige Suite läuft mit höchstens zwei Workern wegen belegter
Ressourcenkonkurrenz. Assertions und Timeouts bleiben unverändert. Node
24.21.0 und vorhandenes Bun müssen gemeinsam im PATH stehen. Der spezielle
`UserFacingError` gilt nur für eigene Drawing-/Path-Recovery-Meldungen; ein
beliebiger `Error` darf den Schutz vor externen Diagnosen nicht umgehen.
Native Sprachressourcen werden nur für tatsächlich verwendete
Lokalisierungsaufrufe benötigt; App und Extension sind getrennte Bundles.

## Systematische Resttextprüfung

TASK-68.6 untersuchte selbst `src`, `server`, `shared`, `desktop`, `ios`,
`index.html` und `claude-extension/manifest.json`: englische Textkandidaten,
JSX-Anzeigen, Label-/Titel-/Placeholder-/Standardnamen, Fehler-/Statuspfade und
Locale-/Metadaten. Kandidaten wurden im Quelltext und bei dynamischen Meldungen
an ihren Aufrufern eingeordnet. Suchtrefferzahlen sind kein Nachweis einer
vollständigen Sprachabdeckung.

Die Integration korrigiert ausschließlich nachgewiesene Restlücken:

- Neuer Agentenschlüssel ohne Namen: `Agentenschlüssel`; gewählte Namen bleiben.
- Neue Resident-Zeichenfläche ohne Namen: `Unbenannte Zeichenfläche`.
- Neu erzeugte Unterbrechungshinweise bei Hydration von Aufgaben, Feedback und
  Kommentaren: Deutsch; gespeicherte Diagnosen und Nutzertexte bleiben.
- Neuer Web-Zeichenflächeninhalt: deutsches HTML und deutscher Starttext.
- Eigener inhaltsfreier Live-Activity-Endstatus: `Aktivität beendet`; keine
  privaten Inhalte bei widerrufenem Zugriff.

Bewusst erhaltene englische Treffer:

| Kategorie                        | Einordnung / Beispiele                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technische Werte                 | IPC-Befehle, `working`/`queued`, Rollen-IDs, CSS, Schemas, Migrationen, APNs-Schlüssel, URLs, Header und Installer-Variablen bleiben Verträge.                                                                                    |
| Kompatibilität                   | `LocalClaude`, `CodexInstall`, Webhook-Pausenerkennung, Web-/iOS-Auth erkennen bisherige englische Texte und aktuelle deutsche Varianten. Sie sind Eingaben, keine englische Anzeige.                                             |
| Technische Agentenkommunikation  | MCP-Titel/-Schemas, Tool-Ergebnisse, `guide`, Resident-/Spezialistenanweisungen und Bildgenerierungsprotokolle bleiben technisch; die deutsche Antwortvorgabe ist separat gesetzt.                                                |
| Diagnosen und Logs               | Provider-/HTTP-/Bilddienstfehler, Boot-Guard, Browser- und Socketlogs sind technische Diagnosen. Nutzerpfade haben deutsche sichere Fallbacks; Meta-Routen prüfen das deaktivierte Feature bereits vor dem internen Graph-Fehler. |
| Technische Locale                | `shared/automations.ts` nutzt `en-US` zur Zeitzonenprüfung und stabilen Wochentagszerlegung der Terminberechnung, nicht als Datumsanzeige.                                                                                        |
| Inhalt                           | Nutzer-/Agentenstatus, CLI-Ausgaben, gespeichertes HTML und externe Marken-/Fontnamen sind keine zu ersetzende App-Beschriftung.                                                                                                  |
| Nicht ausgelieferte Eigenanzeige | Kommentare, Entwicklerdokumentation, Storybook, Tests und Blitz/BlitzKit-Vendor-/Testdateien sind getrennt bewertet.                                                                                                              |

## Prüfbelege

Die Tests `germanDesktopResources` und `germanIosResources` bleiben die fokussierten
Ressourcenprüfungen mit den bereits belegten RED/GREEN-Runden aus Tasks 4 und 5.
`germanNativeResources` ergänzt Cross-Task-Verträge statt dieselben Textlisten
erneut abzuprüfen: tatsächliche Rust-Installer-Rejections durch die echte
React-Anzeige, sowie iOS-Target → Buildkonfiguration → Plist und
Sources → BuildFile → FileReference. Zwei gezielte negative Gegenproben ändern
jeweils genau eine Ressource vorübergehend, erwarten die passende Assertion
und restaurieren sie bytegleich mit SHA256-Prüfung. Kein Git-Reset und keine
abgesenkte Assertion.

Die neuen fachlichen Regressionen haben belegte rote Assertions vor ihrer
Produktkorrektur. Der Hydrationstest ersetzt ausschließlich den DB-Transport,
führt die echte Hydration aus und prüft alle drei Queues einschließlich
Inhaltsschutz. Bestehende API-, Resident- und APNs-Tests prüfen ihre realen
Produktpfade weiter.

Der Browsernachweis nutzt den bestehenden lokalen Puppeteer-/Chromium-Aufbau:
Vite im Worktree, API mit frischer PGlite-Datenbank im temporären Testverzeichnis,
synthetisches Konto, freie Ports, keine echten Provider-Anmeldungen. Anmeldung,
Startseite, Einstellungen, Editor und neue Zeichenfläche werden ausgeführt.
Freigabe- und Löschdialoge werden bei 360, 390 und 768 Pixeln auf horizontale
Überläufe und erreichbare Bedienelemente geprüft. Im Freigabedialog wird nach
einem einzelnen Tab-Schritt Fokus innerhalb des Dialogs geprüft, im Löschdialog
der initiale Fokus. Ein vollständiger Fokuszyklus oder Shift+Tab über die
Fokusgrenzen ist damit nicht belegt. Escape, Schließen und Abbrechen schließen
ohne Löschung. Screenshots schreibt der normale Test in sein bereits angelegtes,
isoliertes temporäres API-Testverzeichnis; dessen bestehender Teardown entfernt
auch diese Aufnahmen. Der Test benötigt keine SDD-Artefakte.
Nur selbst gestartete Prozesse werden beendet.

Die konkreten finalen Prüfergebnisse und Logpfade stehen im zugehörigen
TASK-68.6-Report unter
`.superpowers/sdd/2026-10-25-german-app/task-6-report.md`; ausführliche Logs und
historische Screenshots liegen daneben in `task-6-logs`. Diese bleiben als
Sichtbelege früherer Läufe erhalten; normale Testläufe aktualisieren sie nicht.
Der Report dokumentiert auch
fehlgeschlagene Testanläufe und deren Ursache, nicht nur grüne Wiederholungen.

Historischer Integrationsstand vor der finalen Korrekturwelle; aktuelle Ergebnisse folgen unten:

| Prüfung                                     | Ergebnis                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Vollständige Suite, `--maxWorkers=2`        | 164 Dateien / 1.275 Tests bestanden, keine übersprungenen Tests; bestehende Timeouts unverändert                |
| Typecheck                                   | Bestanden                                                                                                       |
| Lint                                        | Nach expliziten Node-Imports im Gegenproben-Skript bestanden                                                    |
| Web-Build einschließlich Claude-Erweiterung | Bestanden; bestehender Hinweis zu großen JS-Chunks                                                              |
| `git diff --check`                          | Bestanden                                                                                                       |
| Globaler Formatcheck                        | Ausschließlich `progress.md` beanstandet; Controller pflegt den Ledger, daher gemäß Änderungsverbot unverändert |

Das erfolgreiche Testlog enthält technische Happy-DOM-Ausgaben zu
`ECONNREFUSED` auf localhost:3000 und `AbortError` beim Teardown. Sie bleiben
sichtbar dokumentiert; es gab dabei keine fehlgeschlagenen Tests. Das globale
Formatproblem wird nicht durch einen neuen Ignore verdeckt. Es liegt in der
controllerverwalteten Arbeitsdokumentation, nicht in einer Produktdatei.

## Finale Korrekturen nach dem unabhängigen Review

Die gemeinsame Fixwelle für TASK-68 korrigiert I1–I6 und M1. Der frühere
Abschlussstand oben ist historisch; die folgenden Nachweise betreffen die
korrigierte Fassung. Die anschließende unabhängige scoped Nachprüfung und die
manuelle Nutzerabnahme bleiben offen.

- Codex zeigt bei bekannten aktuellen deutschen und alten englischen
  Konfigurationsfehlern konkrete deutsche Abhilfe für TOML, `mcp_servers`,
  bestehende doop-Einträge, `CODEX_HOME`, Pfade und Dateiberechtigungen.
  Unbekannte native Diagnosen bleiben verborgen; erneute Einrichtung bleibt
  bedienbar. Geprüft über die echte React-Oberfläche mit synthetischer Bridge,
  nicht durch einen ausgeführten Rust-Konfigurationsschreibvorgang.
- Alle sechs Webhook-Ereigniserläuterungen sind sichtbar und zugänglich deutsch.
  Der Auswahlnachweis prüft zugleich den tatsächlichen POST mit unveränderten
  technischen Ereignisschlüsseln. Header und Payloadverträge bleiben erhalten.
- Beide Designwissen-Modellaufrufe geben Deutsch als Standard für neue
  menschliche Ausgaben vor, mit Vorrang ausdrücklicher anderer Sprachwünsche
  und unveränderten technischen Bezeichnern. Die eigene Ersatzbegründung lautet
  „Aus dem letzten Feedback abgeleitet.“ Tests prüfen die tatsächlichen
  HTTP-Request-Bodies und neue Vorschläge bei synthetischem Modelltransport;
  gespeicherte Zusammenfassungen und Rohfeedback bleiben unverändert.
- Konkrete Uploadhinweise zu erlaubten Dateitypen und der 5-MB-Grenze bleiben
  durch Upload-, Clipboard- und Anzeigehelfer erhalten. Ausschließlich bereits
  sicher aufgelöste eigene Hinweise verwenden den vorhandenen `UserFacingError`;
  fremde gewöhnliche Errors erhalten weiter einen sicheren Ersatztext.
- Undo/Redo löst ursprüngliche Fehlerursachen an der Anzeigegrenze sicher
  deutsch auf. Lokale Konflikt- und Abhilfehinweise bleiben konkret; Netzwerk-
  und Diagnosetexte werden nicht ungeprüft angezeigt. Echte Helpertests prüfen
  erfolgreiche Wiederholung, unveränderte Seitennamen sowie bestehende
  Teiloperations- und Versionsschutzfälle.
- Abgelehnte lokale IPC-Ausführung nutzt den bestehenden Claude-Aktionsresolver
  gemeinsam mit der Aktionsoberfläche. Technische Rejections werden vor Anzeige
  und Ergebnisübermittlung sicher aufgelöst. Tatsächlich zurückgegebene
  CLI-Ergebnisse bleiben Inhalt, auch bei `success: false`; Tests prüfen den
  gerenderten Fehlertext und die Übergabe an `finishLocalAgent` gemeinsam.
- Die Claude-Code-Anleitung enthält wieder beide Wortabstände neben `/mcp` und
  `doop`; ihr vollständiger gerenderter Satz ist geprüft.

Der erweiterte gezielte Lauf besteht mit **10 Dateien / 140 Tests**. Die frische
Gesamtsuite besteht mit **165 Dateien / 1.309 Tests**, ohne übersprungene Tests.
Typecheck, Lint, globaler Formatcheck, Build und `git diff --check` bestehen.
Der Build meldet weiterhin den bekannten Hinweis zu großen JS-Chunks.
Im erfolgreichen Gesamtlauf bleiben die bekannten Happy-DOM-Ausgaben zu
`ECONNREFUSED` auf localhost:3000 und `AbortError` beim Teardown sichtbar.
Die unabhängige Nachprüfung der finalen Korrekturwelle hat anschließend alle
sechs wichtigen Befunde und den kleineren Befund als behoben bestätigt:
keine offenen Critical-/Important-Befunde. Die unten aufgeführten Plattform-
und Nutzerabnahmen bleiben offen.

Reproduktionsbefehle, RED/GREEN-Evidenz einschließlich korrigierter Testaufbauten
und alle aktuellen Logpfade stehen in
`.superpowers/sdd/2026-10-25-german-app/final-fix-report.md` und dessen
`final-fix-logs`. Node **24.21.0** und Bun **1.3.10** liegen gemeinsam im PATH;
alle Testläufe verwenden `--maxWorkers=2` und unveränderte Timeouts. Es gibt
keine neuen Abhängigkeiten und keine nachträgliche Übersetzung gespeicherter
Nutzerinhalte. Backlog, Plan, Ledger, Snapshots und Feature-Flags werden durch
diese Fixwelle nicht verändert.

## Abschließende unabhängige Prüfung und Controller-Nachweis

Der breite Gesamt-Review durch Sherlock Holmes umfasste alle 248 Dateien des
Reviewpakets. Die daraus entstandenen sechs wichtigen Befunde und ein kleinerer
Befund wurden in einer gemeinsamen Welle korrigiert und unabhängig gezielt
nachgeprüft. Bericht: `.superpowers/sdd/2026-10-25-german-app/final-rereview.md`.
Alle sieben Einzelverdicts lauten `ADDRESSED`; keine offenen wichtigen oder
kritischen Befunde. Der vorherige Claude-Versuch scheiterte am API-Limit und
zählt ausdrücklich nicht als Reviewnachweis.

Der Controller hat die vollständige Suite am 26. Oktober erneut selbst
ausgeführt: **165 Dateien / 1.309 Tests bestanden**, keine übersprungenen Tests,
271,33 Sekunden, Node 24.21.0 und Bun im PATH, `--maxWorkers=2` und unveränderte
Timeouts. Log: `.superpowers/sdd/2026-10-25-german-app/controller-final-tests.log`.
Typecheck, vollständiges Lint und Web-/Claude-Erweiterungsbuild wurden danach
ebenfalls vom Controller erneut erfolgreich ausgeführt. Logs:
`controller-final-typecheck.log`, `controller-final-lint.log` und
`controller-final-build.log` im selben Nachweisverzeichnis.
Auch der vollständige Formatcheck und `git diff --check` bestanden;
`controller-final-format.log` bestätigt die globale Formatierung ohne Ignore.
670 Produkt-, Test- und Konfigurationsdateien sind bytegleich zum unabhängig
geprüften finalen Snapshot. TASK-68 hat die technischen Kriterien 1–5 erfüllt;
Kriterium 6 und der Statusabschluss bleiben bis zur ausdrücklichen manuellen
Nutzerabnahme offen.
Danach werden ausschließlich diese Abnahmenotizen und Backlog-Nachweise gepflegt;
Produktcode und Tests bleiben auf dem unabhängig geprüften Stand.

Änderungen liegen unveröffentlicht und ohne Commit auf `feat/german-app` im
isolierten Worktree. Keine Zusammenführung, kein Push und kein Deployment
wurden durchgeführt. Die eigenen SDD-Berichte und Snapshots bleiben als
Nachweis erhalten, da sie mangels beauftragter Commits nicht aus Git-Historie
wiederherstellbar wären.

## Plattform- und Abnahmegrenzen

Die Desktop-RemoteURL bleibt **`https://doop.design`**. Tauri lädt weiterhin
das entfernte Webfrontend. Nur eine korrekte Deploymentkonfiguration mit dem
übersetzten Webstand auf der tatsächlich geladenen Adresse zeigt dort die
deutsche Weboberfläche. Lokale Quelltextänderungen und ein erfolgreicher
Web-Build belegen kein Produktionsdeployment. Es wurde nichts deployt.

`xcodebuild`, Swift, Cargo/Rustfmt und `makensis` fehlen hier. Statische
Ressourcen-/Bundleprüfungen, Syntaxprüfungen und ein geprüftes PNG sind keine
nativen Builds oder Installer-/VoiceOver-/Live-Activity-Laufzeitprüfungen.
Echte Google-/Apple-OAuth-, SMTP-, Stripe- und native CLI-/Installer-Flows
wurden nicht ausgeführt. Bestehende simulierte Integrationsprüfungen machen
diese offenen Plattformnachweise nicht grün.

## Manuelle Abnahmeliste

- [x] Unabhängiges finales Gesamt-Review samt gezielter Nachprüfung durchführen.
- [ ] Deutsche Anmeldung, Registrierung, Bestätigungs- und Reset-E-Mails mit
      tatsächlich konfiguriertem SMTP testen; Google-/Apple-OAuth getrennt prüfen.
- [ ] Startseite, Editor, Ebenen, Zeichenflächen, Designwissen, Kommentare,
      Aufgaben, Freigabe, Einstellungen und Administration mit eigenen Rollen
      manuell prüfen; schmale Dialoge, Tastatur, Fokus, Escape, Schließen und
      Abbrechen einschließlich destruktiver Aktionen kontrollieren.
- [ ] Gespeicherte fremdsprachige Nutzerinhalte unverändert wiederöffnen;
      technische Exporte, IDs, Rollen und deutsche USD-/Datumsanzeigen prüfen.
- [ ] Optional deaktivierte Funktionen nur in autorisierter Testkonfiguration
      prüfen, ohne produktive Feature-Flags zu ändern.
- [ ] Stripe-Checkout, Portal, Fehler- und Kündigungspfade mit geeigneten
      Testzugängen ausführen; Beträge, USD und Rechte unverändert bestätigen.
- [ ] Desktop auf unterstützten Plattformen bauen, macOS-Menüs, DMG-PNG,
      deutschen Windows-Installer und native Dialoge tatsächlich ausführen;
      CLI-Anmeldung, Installieren, Abbruch und Recovery testen.
- [ ] Tatsächlich geladene Desktop-RemoteURL und übersetztes Webdeployment prüfen.
- [ ] iOS-App und separate Activity-Extension mit Xcode bauen; auf Simulator
      und Gerät deutsche Systemdialoge, VoiceOver, Formate, Export,
      Authentifizierung, Live Activities und widerrufenen Zugriff testen.
- [ ] Nutzer ausdrücklich um manuelle Abnahme und Erlaubnis zum Setzen von
      `Done` bitten. Erst nach Bestätigung schließt der Controller Backlog per CLI.
