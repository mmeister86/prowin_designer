# Requesty EU als Server-Provider

TASK-16 / TASK-17 / TASK-22 · Stand: 27.10.2026

Der Resident verwendet standardmäßig Requesty EU über den bestehenden
Chat-Completions-Transport. System-Blöcke, Tool-Aufrufe und Screenshot-Ergebnisse
werden in dieselbe Nachrichtenform wie bei den vorhandenen Transporten übersetzt.
Eine neue Provider-Abstraktion ist dafür nicht nötig.

## Operator-Konfiguration

```dotenv
DOOP_AGENT_PROVIDER=requesty
REQUESTY_API_KEY=<nur auf dem Server setzen>
REQUESTY_CHAT_URL=https://router.eu.requesty.ai/v1/chat/completions
DOOP_AGENT_MODEL=policy/prowin-layout-gen
RESIDENT_TASK_LIMIT=1000
```

Die ersten vier Werte außer dem Schlüssel entsprechen den Defaults. Das
Aufgabenlimit ist standardmäßig **0**; `1000` ist ein Beispiel für den Testbetrieb.
Nach Änderungen ist ein Serverneustart erforderlich. Schlüssel gehören weder in
Frontend-Variablen noch ins Repository.

`REQUESTY_CHAT_URL` ist eine ausschließlich vom Operator gesetzte Konstante. In
diesem Fork wird nur die oben genannte, geprüfte EU-URL akzeptiert. Globale Router,
private Ziele und andere URLs scheitern bei der Konfigurationsprüfung am Start.
Es gibt kein benutzerdefiniertes URL-Feld.
HTTP-Weiterleitungen werden für Requesty abgelehnt, damit Request-Inhalte auch
bei einer 307/308-Antwort nicht an ein anderes Ziel gesendet werden.

Ein fehlender oder leerer `REQUESTY_API_KEY` deaktiviert den Server-Tier. Der Server
startet weiter und nennt die fehlende Konfiguration im Boot-Log. Wartende Aufgaben
werden ohne ausführbares Modell nicht geclaimt. Vorhandene Anthropic-/Azure-Keys
werden dabei nicht als Ersatz verwendet. Ein nichtleerer Anthropic-Key verhindert
bereits den Boot; eine explizite Azure-/Anthropic-Providerwahl ebenso. Auch bei gültigem Key erlaubt
`RESIDENT_TASK_LIMIT=0` keine serverbezahlten Resident-Aufgaben; das Boot-Log nennt
Key-Bereitschaft und Aufgabenlimit getrennt.

`DOOP_AGENT_MODEL` überschreibt die Policy ausdrücklich. Für Requesty ist
`policy/prowin-layout-gen` der Standard aus der [Prüfung zu TASK-15](requesty-pruefung.md).
Eine Policy wird im [Requesty-Dashboard](https://app.requesty.ai/routing-policies)
verwaltet und bei Inferenz mit `policy/<name>` angesprochen.
Die [offizielle Policy-Dokumentation](https://docs.requesty.ai/features/fallback-policies)
beschreibt die geordnete Auswahl ihrer Fallback-Modelle.
Die Policy muss im Konto des verwendeten Keys vorhanden und für diesen Key
freigegeben sein. Bei einem anderen Requesty-Konto zunächst dieselbe EU-Policy
einrichten oder `DOOP_AGENT_MODEL` auf eine dort geprüfte Policy setzen. Der
Boot-Status prüft nur, ob der Key gesetzt ist; er führt keinen kostenpflichtigen
Inferenz- oder Management-Aufruf zur Prüfung der Policy-Rechte aus.

**Upgrade bestehender Installationen:** Direkte Azure-/Anthropic-Serverprovider
sind seit TASK-22 nicht mehr startfähig. `DOOP_AGENT_PROVIDER` entfernen oder auf
`requesty` setzen, verbotene Keys entfernen und alte `DOOP_AGENT_MODEL`-Overrides
durch eine geprüfte Requesty-Policy ersetzen. Es gibt keinen Legacy-Ausnahmeschalter.

## Budget, EU-Routing und Fehler

`RESIDENT_TASK_LIMIT` zählt Aufgaben pro Konto über dessen bisherigen Verbrauch.
Es ist weder ein Geldlimit noch ein monatliches Kontingent. Ein neuer Versuch
verbraucht ebenfalls eine Aufgabe. Das eigentliche Kostenlimit wird auf dem
Requesty-API-Key eingerichtet: monatliches Spend-Limit, kein ungewolltes
Aufstocken und Kosten-Alerts mit funktionierendem Webhook. Der Betreiber hat die
Einrichtung in TASK-15 bestätigt; konkrete Beträge und Alert-Zustellung wurden
nicht unabhängig geprüft. Siehe [Spend-Limits](https://docs.requesty.ai/features/api-limits)
und [Alerts](https://docs.requesty.ai/features/alerts).

Bei HTTP-Fehlern gibt es keinen automatischen Providerwechsel und keine
HTTP-Wiederholung durch den Residenten. Budget-/Guthabenfehler (im Test HTTP 402),
429 und erschöpfte Policy-Ketten werden als Fehler weitergegeben. Die Karte
bleibt für einen manuellen Retry pausiert und wird nicht erfolgreich beendet.
Authentifizierungs-/Zugriffsfehler und nicht verfügbare Modelle nennen die
Serverkonfiguration; sie fordern Nutzer nicht zum erneuten Verbinden ihres
Kontos auf. Der bestehende, begrenzte Retry bei Netzwerkabbrüchen bleibt erhalten.

Fallbacks innerhalb einer Requesty-Policy führt Requesty aus. Die Anwendung
sendet weiter denselben Policy-Namen und akzeptiert die normale Antwort eines
Ersatzmodells. Sie implementiert keine eigene Ersatzkette. Jede Stufe muss
Tool-Calling und Vision unterstützen und in der EU laufen. Der EU-Router allein
belegt das nicht; Serving Regions und Approved Models müssen ebenfalls passend
eingestellt sein. Siehe [EU-Routing](https://docs.requesty.ai/features/eu-routing)
und die noch offenen Kettennachweise in der [TASK-15-Prüfung](requesty-pruefung.md).

## Prüfung und verbleibender Umfang

```bash
npm test -- tests/requestyProvider.test.ts tests/requestyResident.test.ts tests/chatCompletionsAgent.test.ts tests/env.test.ts tests/modelTurnRetry.test.ts tests/localAgentRouting.test.ts
npm run typecheck
```

Die Provider-Tests prüfen EU-Ziel, Bearer-Key, Policy-Override, Tool-/Vision-
Nachrichten, fehlenden Key, Legacy-Defaults sowie HTTP 401/403/404/402/429/502 ohne
Providerwechsel. Der Resident-Integrationstest verwendet einen simulierten
Requesty-Router an der Fetch-Grenze; Resident, Karten, Frame-Mutationen,
Chromium-Screenshots, Aufgabenmeter und WebSocket-Ergebnisse bleiben echt. Der
Screenshot-Test benötigt ein vorhandenes Chromium und darf für M2 nicht übersprungen
werden. Seit TASK-22 umfasst der Lauf auch beide Distiller-Aufrufe und ein unabhängig
ausgewertetes Zieljournal; siehe [KI-/Analytics-Egress](egress-pruefung.md). Ein simuliertes Budgetlimit
belegt die Fehlerbehandlung, nicht die tatsächlich eingerichtete Requesty-Grenze.

Der [Live-Smoke-Test vom 24.10.2026](evidence/requesty-server-smoke-2026-10-24.json)
verwendete den neuen Server-Provider mit `policy/prowin-layout-gen`: zwei
erfolgreiche EU-Requests, ein Tool-Aufruf und ein ausschließlich aus dem
synthetischen Tool-Bild korrekt gelesener Zahlencode. Beide Antworten kamen von
`bedrock/claude-sonnet-5-5@eu-central-1`; ausgewiesene Gesamtkosten: 0,00272525 USD.
Der Test verwendete keine Canvas- oder Kundendaten und erzwang weder einen
Fallback noch ein echtes Erreichen des Key-Budgets.

TASK-18 entfernt private BYO-Auswahl vollständig. Aktuell berechtigte Creator/Admins
behalten den Local Agent mit Vorrang vor dem Server; ein offline gewählter Local Agent
löst keinen stillen Server-Fallback aus. [Migration und Konfiguration](model-account-removal.md).
Explizit gewählte Legacy-Serverprovider sind beim Boot gesperrt. Ihre Transportmodule
bleiben für isolierte Regressionstests erhalten; sie sind kein alternativer Betriebsweg.

## Memory-Distiller und verbleibendes Bild-Tagging (TASK-17)

Beide Distiller-Aufrufe laufen über denselben EU-Transport mit
`DOOP_DISTILL_MODEL=policy/prowin-text-gen` und ausgeschalteter Vision. Das gilt
auch bei lokalen Agents; Azure-/Anthropic-Konfigurationen existieren nur noch in isolierten Tests.
Ohne `REQUESTY_API_KEY` werden weder Zusammenfassungen noch Regelvorschläge
angefordert. Ein vorhandener `ANTHROPIC_API_KEY` aktiviert diese Pfade nicht.
Alte `DOOP_DISTILL_MODEL=claude-…`-Overrides müssen beim Upgrade auf eine für den
Requesty-Key zugängliche Text-Policy umgestellt werden.

Zusammenfassungen behalten ihr Limit von 100 Tokens, die Regelprüfung 1000 Tokens.
Die Regelprüfung erzwingt das benannte Tool `distill_result`. Nur eine vollständige,
gültige Antwort dieses Tools mit `has_rule: true` und einer nicht leeren Regel
erzeugt einen **pending** Vorschlag und markiert dessen Entscheidungen als
verarbeitet. Die Übernahme in einen Styleguide bleibt eine menschliche Entscheidung.
Kein Regelvorschlag, Refusal, unvollständige Ausgabe und HTTP-Fehler lassen die
Evidenz unverbraucht; es gibt keinen automatischen Providerwechsel.

Die Hintergrundbibliothek bleibt gemäß TASK-12 deaktiviert. Ihr verbleibender
Tagging-Code verwendet bei aktivem Feature und Requesty-Key `DOOP_AGENT_MODEL`
(standardmäßig `policy/prowin-layout-gen`) mit Vision und 2048 Tokens. Das JPEG
wird als Data-URL gesendet, das bisherige Tag-Schema als `response_format.json_schema`.
Diese Policy und alle ihre Fallbacks müssen zusätzlich strukturierte Ausgabe
unterstützen. Anthropic-spezifische Beta- und Fallback-Optionen entfallen; Routing
und Fallbacks liegen bei Requesty. Bei einem expliziten Legacy-Agent-Modell müsste
vor einer späteren Reaktivierung der Bibliothek eine passende Requesty-Vision-Policy
für `DOOP_AGENT_MODEL` konfiguriert werden.

Die API-Formate sind anhand der offiziellen Dokumentation zu
[strukturierten Ausgaben](https://docs.requesty.ai/features/structured-outputs) und
[Bildverständnis](https://docs.requesty.ai/features/image-understanding) über
Context7 geprüft. Die Regressionstests simulieren Requesty an der Fetch-Grenze
und prüfen beide Distiller-Aufrufe, Tool-Auswertung, Feature-/Key-Gates, Vision,
Schema und Fehler. Sie belegen keinen Live-Test der erzwungenen Tool-Auswahl oder
der Schema-Unterstützung jeder Policy-Fallback-Stufe.

```bash
npm test -- tests/requestyDistill.test.ts tests/requestyBackgrounds.test.ts tests/chatCompletionsAgent.test.ts tests/optionalFeatures.test.ts
```

Prüfstand TASK-17 vom 24.10.2026: 89 gezielte Tests und die gesamte Suite mit
136 Dateien / 983 Tests bestanden. Der Gesamtlauf verwendete Bun 1.3.10 und
`--maxWorkers=4`; ein erster Lauf ohne Bun und mit höherer Parallelität scheiterte
am Extension-Setup und drei 5-Sekunden-Timeouts. Typecheck, Extension-/Vite-Build
und unabhängiges Review bestanden. Standard-Lint bleibt durch 14 vorhandene
`no-undef`-Fehler in `data/requesty-evaluation/run-checks.mjs` rot; die geänderten
Dateien sowie der Gesamtlint mit ausschließlich dieser Datei ausgenommen sind grün.

Diese Integration ersetzt weder zehn vollständige Live-Resident-Benchmarks noch
die Prüfung jeder Policy-Fallback-Stufe oder die gesonderte Produktionsfreigabe.
