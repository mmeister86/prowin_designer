# KI-/Analytics-Egress – TASK-22

**Umfang: nur KI und Analytics.** Bild-/Icon-/Logosuche bleibt unverändert.
Magnific und Stripe werden mit dieser Prüfung **nicht aktiviert**.

**Stand: 27.10.2026.** Implementierung und technische Prüfung abgeschlossen.
Der Nutzer hat TASK-21 und TASK-22 ausdrücklich abgenommen und auf **Done** setzen
lassen. Die Umsetzung ist mit Commit `7f5a599` lokal nach `main` übernommen; kein Push.

## Was geprüft wird

- **Ein KI-Ziel:** `https://router.eu.requesty.ai/v1/chat/completions` mit `redirect: 'error'`.
- **Echter Anwendungslauf:** Server, Anmeldung, Canvas, Karte, Frame, Chromium-Screenshot und Design Memory.
- **Simulierter Upstream:** Deterministische Requesty-Antworten; kein kostenpflichtiger Live-Aufruf.
- **Agent:** Vier Layout-Policy-Turns – Frame erstellen, Screenshot prüfen, `save_decision`, Abschluss.
- **Distiller:** Zwei Text-Policy-Aufrufe – Zusammenfassung und erzwungenes `distill_result`; der Regelvorschlag bleibt **pending**.
- **Guard:** Sechs verbotene Modell-/PostHog-Keys sowie explizite direkte Azure-/Anthropic-Serverprovider verhindern den Boot.
- **Analytics:** `capture` und `captureThrottled` bleiben ohne Netzwerkaufruf.

## Zieljournal und Fehlerprüfung

`tests/fixtures/ai-egress.mjs` umschließt den simulierten Router im M2-Testprozess.
Jeder Versuch wird **vor** der Antwort oder Ablehnung synchron als JSONL erfasst:

```json
{ "origin": "https://router.eu.requesty.ai", "pathname": "/v1/chat/completions", "allowed": true }
```

Der erfolgreiche Agent-/Distiller-Lauf muss **sechs erlaubte Einträge** liefern.
Weitere Budget-/Auth-/Policy-Negativtests desselben Servers werden ebenfalls erfasst.
Die finale Journalprüfung schlägt bei **jedem** `allowed: false` fehl – unabhängig
davon, ob Resident oder Distiller den Transportfehler abgefangen haben.

- Pro Testlauf eigene Datei unter `tmpdir()/opencode` (unter Linux üblicherweise
  `/tmp/opencode`), danach Aufräumen. Fehlende Elternverzeichnisse werden angelegt.
- Kein Journal mit Headers, Query, Userinfo, Bodies oder Bilddaten.
- Abgelehnte Pfade werden als `[blocked]` protokolliert, damit auch Secrets im Pfad nicht erscheinen.
- Globale Requesty-Route, falsche Protokolle/Pfade/Ports, täuschende Subdomains,
  direkte Modellhosts und PostHog werden vor dem Transport abgelehnt.
- Magnific/Freepik und Stripe sind im aktuellen KI-Test ebenfalls nicht freigegeben.
- **Chromium ist verpflichtend:** Kein stilles Überspringen des M2-Smokes.

## Prüfstand

- **Baseline:** 165 Dateien / 1309 Tests bestanden.
- **Egress RED:** 26 Tests scheiterten mit dem Pass-through-Wrapper: keine Sperre, kein Journal.
- **Resident RED:** Fehlende Decision und leeres Journal nachgewiesen.
- **Guard RED:** Zwei neue Tests scheiterten, weil Azure/Anthropic noch den Env-Parser erreichten.
- **Abgefangener Verstoß:** Temporäre OpenAI-Fehlinjektion trotz `.catch` erkannt;
  Smoke und unabhängige Schlussprüfung scheiterten. Injektion wieder entfernt.
- **Gezielte Abschlussprüfung:** 9 Dateien / **103 Tests bestanden**, einschließlich
  `localQueueAdmission.test.ts` und des neuen Tempverzeichnis-Regressionsfalls.
- **Gesamtsuite nach Reviewkorrektur:** 167 Dateien / **1341 Tests bestanden** (161,98 s).
- **Erster Gesamtlauf:** Ein 5000-ms-Timeout in
  `legacyPagesMigration.test.ts` – „persists legacy membership before reordering,
  including after reopening the database“. Isolierte Wiederholung und anschließende
  Gesamtsuite bestanden; keine Testtimeouts oder betreffende Produktlogik geändert.
- **Unabhängiges Review (Ripley):** Kein Critical-Befund. Ein wichtiger Befund
  zum fehlenden Temp-Elternverzeichnis per **RED → GREEN** behoben.
- **Typecheck, Lint, Build, Formatprüfung und Doc-Lint:** Bestanden.
- **Hinweise:** Bestehende Build-Chunkgrößenwarnung, Node-localStorage-Warnungen
  und ein Doc-Lint-Aktualitätshinweis zu `CLAUDE.md`/`.context/` bleiben bestehen.

**Reviewkorrektur:** `tests/egressJournal.ts` wird von beiden Egress-Testdateien
verwendet. `egressJournal.test.ts` simuliert ein frisches System ohne Elternordner,
prüft das Anlegen und getrennte Verzeichnisse pro Aufruf. Vor der Korrektur trat
reproduzierbar `ENOENT` auf; danach bestanden Regression und Gesamtsuite.

## Reproduzieren

Voraussetzungen: installierte Projektabhängigkeiten und ausführbares Chromium;
bei Bedarf `CHROME_PATH` setzen. Alle Zugangsdaten der Tests sind synthetisch.

```bash
bun run test -- tests/egressJournal.test.ts tests/bootGuard.test.ts tests/env.test.ts tests/aiEgress.test.ts tests/requestyResident.test.ts tests/requestyDistill.test.ts tests/requestyProvider.test.ts tests/prowinRedactWiring.test.ts tests/localQueueAdmission.test.ts --maxWorkers=2
bun run test -- --maxWorkers=4
bun run typecheck
bun run lint
bun run build
bun run doc-lint
```

## Manuelle Abnahme – vom Nutzer bestätigt

- Auf der Testinstanz einen synthetischen Frame vom Server-Agent erstellen lassen.
- Eine dauerhafte Designpräferenz speichern; Zusammenfassung und **pending**
  Regelvorschlag prüfen. Eine Übernahme in Guidelines bleibt eine menschliche Aktion.
- Fehlermeldungen bei Budget-/Konfigurationsproblemen dürfen keine Keys oder internen Diagnosen zeigen.
- Der Nutzer hat den Abschluss von TASK-21 und TASK-22 ausdrücklich bestätigt.
  Diese Abnahme ist kein zusätzlich ausgeführter Live-, Regions- oder Plattformtest.

## Umsetzungsentscheidungen

- **Test-Interop:** Eine kleine `.d.mts`-Deklaration erhält TypeScript-Prüfung ohne `tsconfig`-Änderung; muss bei Schnittstellenänderungen mitgeführt werden.
- **Vertraulichkeit:** Abgelehnte Pfade werden ausgeblendet; das reduziert die Fehlerdiagnostik zugunsten des Geheimnisschutzes.
- **Gemeinsame Fixture:** Nur der M2-Consumer aktiviert das Journal; der bestehende Queue-Test bleibt unverändert und separat regressionsgeprüft.
- **Portabilität:** Gemeinsamer Testhelfer für `tmpdir()/opencode` statt vorausgesetztem Harness-Ordner; keine Produktionsschnittstelle.
- **Review ohne Commit:** Uncommitteter Diff und neue Dateien wurden ausdrücklich in das Review einbezogen. `.env.example` ist eine geprüfte Mustervorlage; echte `.env`-Dateien wurden nicht gelesen.
- **Übergabe:** Nach ursprünglichem Commitverbot hat der Nutzer lokale Commits und
  main-Integration ausdrücklich freigegeben. Vor der Bereinigung wurden Quellen,
  Tasks, Daten und Ausführungsnachweise privat unter
  `/home/matthias/code/prowin_designer-backups/cleanup-2026-10-27-qxbiwr13` gesichert.
  Keine Veröffentlichung und kein Push.

## Grenzen des Nachweises

- **Kein Live-/Regionsnachweis:** Das Journal zeigt angeforderte URLs vor den simulierten Antworten, keine echten Requesty-Verbindungen oder internen Serving Regions.
- **Keine Produktionsfirewall:** Der Wrapper wird ausschließlich im Test importiert. Die Produktionssperren sind Boot-Guard, gepinnte Requesty-URL und Redirect-Verweigerung.
- **Keine vollständige Netzwerkmessung:** Node-HTTP(S), importiertes Undici, SDK-, SMTP- und Chromium-Verkehr werden durch `globalThis.fetch` nicht automatisch erfasst.
- **Keine globale Host-Allowlist:** Suchdienste, Remote-Assets, Webhooks, S3, SMTP, Auth und Datenbankverbindungen bleiben außerhalb dieses Auftrags.
- **Local Agent/MCP unverändert:** Eigene Agents behalten den bereits beschlossenen separaten Datenfluss.
- **Spätere Freigaben:** Magnific nur im genehmigten Bildadapter und Stripe erst nach Aktivierung; entsprechende Egress-Prüfungen müssen dann ergänzt werden.
