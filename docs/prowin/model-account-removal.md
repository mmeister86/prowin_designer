# BYO-Modellkonten entfernen und Local Agent erhalten

TASK-18 · Stand: 24.10.2026

Private Modellkonten für ChatGPT, OpenAI, Anthropic, OpenRouter und Gemini sind
aus Settings, Prompt-Modellwahl, API-Client und Serverlaufzeit entfernt. Es gibt
keinen OAuth-/Device-Flow, Loopback-Listener, Tokenrefresh oder privaten
Providerzweig mehr. Der authentifizierte Alt-Prefix `/api/model-account` liefert
einschließlich Unterrouten für alle Methoden JSON mit HTTP 410. Eingaben werden
weder gespeichert noch als Zugangsdaten verwendet oder zurückgegeben.

## Migration beim Upgrade

Die neue Migration `0039_remove_model_accounts.sql` wird wie alle bisherigen
Migrationen durch `initDb()` beim Start ausgeführt, für PostgreSQL und PGlite.
Sie entfernt die Tabelle `model_accounts` vollständig, ohne `CASCADE`. Damit
entfallen Access-/Refresh-Tokens, API-Keys, Account-IDs, E-Mail-/Plan-Metadaten und
private Modellpräferenzen aller Kontotypen, auch verwaister und unbekannter Zeilen.
Historische Migrationen bleiben unverändert; Journal und Snapshot bilden den neuen
Schema-Stand ab.

Vor dem Upgrade alle alten Instanzen stoppen. Alte OAuth-Poller oder Writer dürfen
nicht parallel zur neuen Version laufen. Anschließend die neue Version starten;
die Migration läuft vor Annahme von Anfragen. Die Prüfung in TASK-18 verwendet
ausschließlich temporäre Datenbanken; eine vorhandene lokale oder produktive
Datenbank wird dafür nicht gestartet oder migriert.

Designs, Benutzer-/MCP-Anmeldung, Aufgabenhistorie, Aufgabenverbrauch,
`local_agent_preferences` und `image_prefs` bleiben erhalten. Bildmodellpräferenzen
enthalten nur Modell-IDs und verwenden künftig ausschließlich Serverzugänge.
Die Migration ist wiederholt ausführbar; es gibt keinen Credential-Rollback und
keinen Export alter Schlüssel für einen Rückbau.

Der Tabellen-Drop widerruft externe Tokens oder API-Keys nicht beim Anbieter.
Betroffene Personen müssen nicht mehr benötigte Zugänge beim jeweiligen Anbieter
widerrufen. Alte Backups, Snapshots und PostgreSQL-WAL werden durch die Anwendung
nicht bereinigt; sie unterliegen weiterhin der Lösch-/Aufbewahrungspraxis des
Betreibers und dürfen nicht in eine alte aktive Version zurückgespielt werden.

## Ausführung und Aufgabenlimit

Der Agent verwendet den zentral konfigurierten Serverprovider, standardmäßig
Requesty EU. `RESIDENT_TASK_LIMIT` bleibt standardmäßig **0**: serverbezahlte
Aufgaben sind damit deaktiviert. Für den Testbetrieb muss der Betreiber ein
positives Aufgabenlimit und das eigentliche Geldlimit in Requesty konfigurieren.
Ausgeschöpfte Limits verweisen an die Administration; sie bieten kein privates
Modellkonto mehr als Umgehung an.

Creator und Instanz-Admins können Local Agent weiterhin ausdrücklich auswählen.
Admins erhalten durch die bestehende Identitätsauflösung Creator-Berechtigung.
Beraterinnen sehen keine Local-Bedienung und werden an sämtlichen Local-API-Pfaden
abgewiesen. Kontingent und Routing prüfen die aktuelle Berechtigung: eine alte
aktivierte Präferenz nach Rollenentzug schaltet weder lokales Arbeiten noch
unbegrenzte Servernutzung frei und blockiert die Serverauswahl nicht.
Ein berechtigter Nutzer mit explizit gewähltem, aber offline Desktop bleibt
pausiert. Die Settings erlauben den bewussten Rückwechsel zum Server auch ohne
Antwort des lokalen CLI. Canvas-, Run-, Tool- und MCP-Berechtigungsprüfungen aus
TASK-14 bleiben zusätzlich erhalten.

Der Allowance-Vertrag enthält `used`, `limit`, `connected` (MCP) und `localAgent`
(berechtigter Local-Agent-Opt-in). Alte `byoModel`, `byoKind`, `byoEmail` und
`onOwnAccount` entfallen. MCP-Anmeldung hebt das serverbezahlte Kontingent nicht auf.

Migration `0040_resident_task_admission.sql` ergänzt den Zulassungsstatus
`server_paid` pro Karten-, Kommentar- und Feedbackversuch. Neue serverbezahlte
Aufträge tragen ihre bereits verbrauchte Zulassung; Local-Aufträge tragen
`false`. Wechselt die Ausführung später auf den Server, wird die fehlende
Zulassung vor Inferenz nachgeholt. Zeilensperre, begrenztes Verbrauchs-Upsert und
Zulassungsmarkierung laufen in derselben Transaktion. Bereits zugelassene Arbeit
wird dabei nicht doppelt gezählt. Überschüssige Aufträge pausieren für einen
bewussten Retry, der wie bisher einen neuen Versuch darstellt.
Schlägt ein Snapshot-Schreibvorgang oder die Zulassungstransaktion fehl, wird der
einzelne Claim sichtbar retryfähig pausiert. Andere Claims werden weiter geprüft;
zuvor bestätigte Zulassungen desselben Batches bleiben erhalten.

Bei historischen Aufträgen ohne verlässlichen Zulassungsstatus bleibt der neue
Wert `NULL`. Diese Aufträge werden vor Serverausführung pausiert und benötigen
einen ausdrücklichen, neu zugelassenen Retry; es gibt weder eine automatische
Nachbelastung noch eine kostenlose Fortsetzung unklarer Alt-Aufträge.

Die Local-Agent-Serverpräferenz wird unabhängig von der nativen Statusantwort
veröffentlicht. So bleibt bei ausgefallenem oder hängendem CLI der bewusste
Rückwechsel zum Server erreichbar.

## Entfernte und erhaltene Konfiguration

Entfernt sind alle `CHATGPT_*`, `DOOP_AGENT_OPENAI_MODEL`,
`DOOP_AGENT_OPENAI_EFFORT`, `DOOP_AGENT_OPENROUTER_MODEL`,
`DOOP_AGENT_GEMINI_MODEL`, `OPENROUTER_CHAT_URL` und `GEMINI_OPENAI_CHAT_URL`.
Alte Deployment-/`.env`-Einträge dieser Namen sind wirkungslos und können entfernt
werden; sie reaktivieren keine alten Flows.

`DOOP_IMAGE_ROUTER_MODEL` ist vom entfernten Agent-Modell entkoppelt und hat nun
den eigenständigen Default `gpt-5.6-terra`. Wer zuvor den Agent-Default auch für
OpenAI-Serverbilder überschrieben hatte, übernimmt diese Wahl ausdrücklich in
`DOOP_IMAGE_ROUTER_MODEL`.

Requesty-Konfiguration, explizite Legacy-Serverprovider und operatorseitige
Bildzugänge (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ARK_API_KEY`) bleiben erhalten.
Diese Serverzugänge sind keine privaten Modellkonten. Der weitere Bildprovider-
und Egress-Umbau folgt in den dafür vorgesehenen Tasks; optionale Features werden
durch TASK-18 nicht wieder aktiviert.

## Prüfung

Die Regressionen prüfen Alt-APIs für Beraterin, Creator und Admin, vollständige
Credential-Migration, Local-Agent-Grenzen, Rollenentzug, Offline-Verhalten,
serverseitige Bildabrechnung und die Oberfläche ohne private Kontosteuerung.
Provider-Requests bleiben synthetisch; TASK-18 führt keine Live-Inferenz aus.

Für die vollständige Prüfung werden Browser-Tests und Extension-Build-Test
nacheinander ausgeführt. Letzterer schreibt sein Paket nach
`public/claude-extension`; ein gleichzeitiger Vite-Dateiwächter kann dadurch ein
Browser-Testfenster neu laden. Beide Gruppen gemeinsam decken die gesamte Suite
ab, ohne Tests zu überspringen oder Timeouts zu verändern:

```bash
npx --yes --package=bun@1.3.10 -c 'npm test -- --maxWorkers=4 --exclude tests/claudeExtension.test.ts'
npx --yes --package=bun@1.3.10 -c 'npm test -- tests/claudeExtension.test.ts --maxWorkers=1'
```
