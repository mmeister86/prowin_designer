# Requesty Policies und EU-Modellkette prüfen

Prüfstand: 24.10.2026 · TASK-15 · Status: Done (ausdrückliche Abnahme durch den Betreiber)

Die bestehenden Policies `policy/prowin-text-gen` und `policy/prowin-layout-gen` sind über den EU-Endpunkt authentifiziert aufrufbar. Q9 ist damit für diese Policy-IDs verifiziert. Der Betreiber hat die Einrichtung des monatlichen Key-Budgets und der Kosten-Alerts bestätigt. Die konkreten Einstellungen, vollständigen Fallback-Ketten und organisationsweite EU-Erzwingung wurden noch nicht eingesehen. Es besteht **keine Produktionsfreigabe**. Der vollständige Benchmark mit zehn fertigen Agent-Designs steht aus.

## Bestehende Policies und tatsächlich verwendete Modelle

Der vom Nutzer bereitgestellte Screenshot zeigt zwei Custom-Fallback-Policies. Die Modell-IDs sind teilweise abgeschnitten. Der authentifizierte Katalog liefert exakt diese zwei `policy/`-IDs zurück; `policy/prowin-design-agent` und `policy/prowin-vision` sind darin nicht enthalten. [Katalogprüfung](evidence/requesty-account-catalog-2026-10-24.json).

- **Text:** Ein einfacher Test mit `policy/prowin-text-gen` lieferte HTTP 200, `azure/gpt-5.4@germanywestcentral`, 952 ms und 0,00015675 USD. [Antwort](evidence/requesty-smoke-prowin-text-gen-2026-10-24.json).
- **Layout:** Derselbe Test mit `policy/prowin-layout-gen` lieferte HTTP 200, `bedrock/claude-sonnet-5-5@eu-central-1`, 950 ms und 0,0002134 USD. [Antwort](evidence/requesty-smoke-prowin-layout-gen-2026-10-24.json).
- **GPT-5.5:** Der direkte Test von `azure/gpt-5.5@germanywestcentral`, dem im Screenshot erkennbaren Primärkandidaten, lieferte HTTP 404 mit Provider-Meldung „The API deployment for this resource does not exist.“ Der Katalogeintrag ist damit kein Nachweis funktionierender Inferenz. Zusammen mit der GPT-5.4-Antwort der Policy spricht dies für einen aktiven Fallback; die interne Fehlversuchsfolge liegt nicht vor. [Direkttest](evidence/requesty-gpt55-smoke-2026-10-24.json).

Die Smoke-Anfrage enthielt `messages: [{role: 'user', content: 'Antworte ausschließlich mit: EU-Test erfolgreich'}]`, `max_tokens: 256` und den jeweiligen Policy-Modellnamen. Ziel war `https://router.eu.requesty.ai/v1/chat/completions`. Beide erfolgreichen Antworten enthielten den verlangten Text und `usage.cost`.

`GET https://api-v2.requesty.ai/v1/manage/policy` benötigt Management-Leserechte. Der verfügbare Inferenzschlüssel erhält HTTP 403. Deshalb sind Reihenfolge, Retries und Credential-Modus der vollständigen Ketten weiter vom Betreiber zu bestätigen. Der Screenshot allein belegt diese Details nicht. [Lokaler Befund](evidence/requesty-policy-check-2026-10-24.json), [offizielle API](https://docs.requesty.ai/api-reference/endpoint/manage-policy/manage-policy-list).

## Policy-Syntax und EU-Anforderungen

Bei Inferenz lautet der Modellname `policy/<name>`. Die Management-API gibt den Namen ohne Präfix zurück. Fallback-Policies versuchen Modelle in der konfigurierten Reihenfolge; alle Mitglieder müssen die verwendeten Request-Parameter unterstützen. [Fallback-Dokumentation](https://docs.requesty.ai/features/fallback-policies).

Der EU-Endpunkt verlagert Requestys Verarbeitung und Speicherung nach Frankfurt. Durchgängige EU-Verarbeitung erfordert außerdem EU-gehostete Inferenzmodelle in **jeder** Fallback-Stufe. Für organisationsweite Absicherung sind ausschließlich EU als Serving Region und ausschließlich EU-Modelle in Approved Models zu konfigurieren. Ein Bedrock-Suffix wie `eu-west-2` bezeichnet Großbritannien und erfüllt ein striktes EU-Ziel nicht. [EU-Routing-Dokumentation](https://docs.requesty.ai/features/eu-routing).

Der authentifizierte Katalog enthält 801 Einträge, darunter 413 mit `geolocation: global`, 114 mit `us` und 3 mit `uk`. Diese Antwort belegt **keine EU-only-Modellbeschränkung**. Die Serving-Region-Konfiguration wurde nicht eingesehen; aus der erfolgreichen EU-Anfrage folgt keine organisationsweite Erzwingung.

Der öffentliche EU-Katalog lieferte HTTP 200 und 799 Modelle. Die beiden tatsächlich verwendeten Modelle haben dort `geolocation: eu`, `supports_vision: true`, `supports_tool_calling: true`, `data_retention: false` und `data_used_for_training: false`. Dasselbe gilt für den GPT-5.5-Katalogkandidaten, dessen Inferenz dennoch scheitert. Dies sind Katalogangaben, keine eigenständige Datenschutzprüfung. Die ursprünglichen sieben `@eu`-IDs aus R4.3 sind in diesem Snapshot nicht enthalten. [Katalogevidenz](evidence/requesty-public-catalog-2026-10-24.json), [Modell-API](https://docs.requesty.ai/api-reference/endpoint/models-list).

Die dynamischen Policy-Einträge selbst erklären ihre Capability-Flags als pauschale Platzhalter. Sie dürfen weder zur Freigabe der einzelnen Fallbacks noch als belastbare Preisangabe verwendet werden. Maßgeblich bleiben die konkreten Modell-IDs, deren Metadaten und Testantworten.

## Textvergleich und Tool-/Vision-Prüfung

Der versionierte [Testkorpus](evidence/requesty-benchmark-corpus.json) enthält 20 unterschiedliche deutsche Textprompts und zehn Agent-Briefs. Sämtliche Inhalte sind synthetisch; echte Kontaktdaten und kostenpflichtige Bildgenerierung sind ausgeschlossen.

Der Textvergleich verwendet jeden Prompt einmal pro bestehender Policy: 40 Antworten. Der gemeinsame System-Prompt verlangt genau die JSON-Stringfelder `headline`, `body`, `cta`, wörtliche Pflichtbegriffe und individuelle Zeichenlimits. Automatisch geprüft werden JSON-Struktur, Unicode-Codepoint-Längen einschließlich Leerzeichen, Pflichtbegriffe, ausdrücklich verbotene Zeichen und regulärer Abschluss. Inhaltliche Qualität, Ton und weitere Briefvorgaben benötigen zusätzlich eine redaktionelle Bewertung.

Aufrufparameter: nicht streamend, `max_tokens: 1200`, kein explizites Temperatur- oder Reasoning-Override. Zuerst wurde die Text-Policy, danach die Layout-Policy geprüft. Es gab keine Wiederholungen oder Reparaturaufrufe. Cache- und Reasoning-Defaults können die Ergebnisse beeinflussen; die kleine Stichprobe erlaubt keine allgemeine Modellrangliste. Gemessen wird die clientseitige Dauer bis zur vollständig empfangenen Antwort, nicht die Zeit bis zum ersten Token.

Für Tool-Calling und Vision wird der bestehende `runChatCompletionsTurn` aus `server/chatCompletionsAgent.ts` verwendet: Das Modell ruft ein Werkzeug auf; dessen Ergebnis enthält ein synthetisches PNG mit einem vierstelligen Code. Der zweite Turn muss den ausschließlich im Bild übermittelten Code wiedergeben. Damit werden Tool-Aufruf, Tool-Ergebnis und die bestehende Übersetzung des Bildes in eine Folgemeldung geprüft. Dieser Test enthält keine echten Frame-Inhalte und ist kein Resident-Benchmark.

Ergebnis des Laufs vom 24.10.2026, 19:18–19:20 UTC:

- **Text-Policy / GPT-5.4:** 15 von 20 Antworten erfüllen sämtliche automatischen Prüfungen. Fünf Antworten überschreiten Zeichenlimits (T02, T06, T09, T15, T16). Median 1.116,5 ms, p95 1.446 ms; 0,0251185 USD für 20 Antworten.
- **Layout-Policy / Sonnet 5.5:** 18 von 20 Antworten erfüllen sämtliche automatischen Prüfungen. Zwei Antworten überschreiten Zeichenlimits (T08, T11). Median 4.606,5 ms, p95 5.642 ms; 0,1322838 USD für 20 Antworten.
- Beide Policies liefern in allen 40 Textantworten gültige JSON-Felder und die geforderten Begriffe. Automatische Zeichen-/Feldprüfungen belegen noch keine durchgängige inhaltliche Qualität.
- **Tool/Vision:** Beide Policies bestehen jeweils einen vollständigen Rundlauf über den vorhandenen Transport und lesen den Bildcode korrekt. GPT-5.4: 1.739 ms / 0,001507 USD; Sonnet 5.5: 1.835 ms / 0,003256 USD. Beobachtet wurden zwei gültige Tool-Aufrufe und zwei korrekte Bildantworten; daraus wird keine allgemeine Tool-Fehlerrate des Residenten abgeleitet.
- **Kosten:** Die 44 Benchmark-Requests weisen zusammen 0,1621653 USD aus; einschließlich der beiden erfolgreichen Smoke-Requests sind es 0,16253545 USD. Der fehlgeschlagene direkte GPT-5.5-Request weist keine Kosten aus. Dies sind Requesty-API-Kosten, keine Kosten pro fertigem Design.

Vollständige Antworten, einzelne Prüfungen, tatsächliche Modelle und Usage stehen in der [Laufevidenz](evidence/requesty-live-results-2026-10-24.json). p95 wird als Nearest-Rank-Quantil berechnet. Die beobachteten Zeichenüberschreitungen verlangen eine deterministische Validierung und gegebenenfalls Reparatur vor Übernahme in ein begrenztes Designfeld.

Eine zusätzliche [modellgestützte Blindbewertung](evidence/requesty-text-editorial-review-2026-10-24.json) prüfte alle 40 Texte ohne Kenntnis der Policy- oder Modellnamen. Auf der subjektiven Skala 1–5 erreichte die Text-Policy im Mittel 3,30 für Sprache und 4,55 für inhaltliche Brief-Treue; die Layout-Policy erreichte 4,00 und 4,85. Diese redaktionellen Noten zählen Zeichenlimits nicht mit und ersetzen keine menschliche Freigabe. Häufige Schwächen waren Testkennzeichnungen wie „fiktiv“ im fertigen Kundentext, unbelegte Ergänzungen und holprige CTAs.

Der Korpus benennt Testinhalte ausdrücklich als fiktiv, untersagt aber nicht ausdrücklich die Übernahme dieses Worts in Kundentexte. Das begrenzt die Aussage zur Veröffentlichungsreife: Für einen weiteren Lauf sollte eine neue Korpusversion Testmetadaten und sichtbaren Text klar trennen. Der bereits ausgeführte Korpus bleibt zur Reproduzierbarkeit unverändert. Ein einzelner Durchlauf und ein einzelner modellgestützter Bewerter begründen keine allgemeine Qualitätsrangliste.

## Zehn Agent-Briefs und verbleibende Voraussetzungen

Die zehn vorbereiteten Briefs decken neue Frames, Story-Safe-Zones, Querformat, Terminänderung, Textkürzung, Formatanpassung, zwei Varianten, Überlaufkorrektur, CTA-Änderung und Absage ab. Bearbeitungsfälle benötigen versionierte Ausgangsframes; Brand-Regeln müssen als feste Testgrundlage vorliegen.

Der aktuelle Server unterstützt nur Anthropic und Azure. Der Chat-Completions-Transport kann mit Requesty sprechen, aber der echte Resident-Loop hat noch keinen Requesty-Serverpfad. `AgentTurnResult` transportiert außerdem keine Kosten; fehlerhaftes Tool-JSON wird im Parser zu `{}` normalisiert. Für belastbare Messungen müssen die Rohantworten vor dieser Normalisierung erfasst werden. [Modellauswahl](../../server/agentModel.ts), [Transport](../../server/chatCompletionsAgent.ts), [Resident](../../server/resident.ts).

Damit besteht eine Reihenfolgefrage: TASK-16 hängt formal von TASK-15 ab, während die vollständige Resident-Messung aus TASK-15 den Requesty-Pfad aus TASK-16 braucht. Die vorliegenden API-Tests liefern eine Grundlage für die Integration; die endgültige Modellkettenfreigabe bleibt bis zum Resident-Benchmark offen. TASK-16 wurde in dieser Prüfung nicht implementiert.

Für jeden Brief sind zu erfassen:

- Alle Modell-Turns, verwendete Modelle, HTTP-Fehler, Retries, Tokenmengen und `usage.cost`.
- Tool-Aufrufe, ungültiges JSON, Schema-/Validierungsfehler, unbekannte Tools und fehlgeschlagene Werkzeugausführungen getrennt. Tool-Fehlerrate = fehlerhafte Aufrufe / alle Aufrufe; zusätzlich Fehleranteil pro Brief.
- Gesamtdauer vom Start bis zum verifizierten Abschluss, Turn-Anzahl, Screenshot-Prüfung und Erfüllung aller expliziten Inhalts-/Layoutvorgaben.
- Gesamtkosten je Versuch einschließlich Reparaturen. Zusätzlich Kosten aller Versuche / Anzahl erfolgreich fertiggestellter Designs; bei null Erfolgen ist dieser Wert nicht definiert. Fehlgeschlagene Designs dürfen aus der Wirtschaftlichkeitsrechnung nicht verschwinden.
- Zwei Varianten in A07 gelten als ein Brief mit zwei erforderlichen Ergebnissen. Ein Design gilt erst nach vorhandenen Frames, erfolgreicher visueller Prüfung und erfüllten Pflichtvorgaben als fertig.

Vor der Ausführung sind Zeit-/Turn-/Kostenlimits festzuhalten. Als **Vorschlag**, noch nicht als abgestimmte Freigabeschwelle, gelten: keine falsche EU-Region, keine unbemerkten Tool-Fehler und alle harten Briefvorgaben erfüllt. Qualität, tolerierte Latenz und Kosten pro Design werden anhand der gemessenen Ergebnisse mit dem Betreiber entschieden.

## Budget und Kosten-Alerts

`usage.cost` enthält den Preis des jeweiligen erfolgreichen Requests in USD. Für gestreamte Antworten muss `stream_options: {include_usage: true}` gesetzt werden. Die Kosten eines Designs sind über alle zugehörigen Antworten zu summieren. [Kosten-Dokumentation](https://docs.requesty.ai/features/cost-tracking).

Monatliche Spend-Limits können pro API-Key oder Service Account eingerichtet werden. Beim erreichten Limit werden neue Requests gesperrt. Der Betreiber hat am 24.10.2026 auf die Frage nach monatlichem Key-Budget und Kosten-Alerts mit „ja alles eingerichtet“ geantwortet. Ihre Einrichtung ist damit vom Betreiber bestätigt. Konkrete Beträge, Warnschwellen und Empfänger wurden nicht genannt. Der Lesezugriff auf `GET /v1/manage/apikey` scheitert mit HTTP 403; die Einstellungen wurden nicht unabhängig eingesehen. [Zugriffsbefund](evidence/requesty-budget-access-2026-10-24.json), [Spend-Limits](https://docs.requesty.ai/features/api-limits).

**Ursprünglicher Vorschlag für den nächsten Benchmarklauf:** separater Testschlüssel mit 10 USD monatlichem Limit und ohne automatisches Aufstocken; Warnschwellen bei 50 %, 80 % und 95 %. Diese konkreten Vorschlagswerte werden durch die allgemeine Einrichtungsbestätigung nicht als übernommen vorausgesetzt. Der aktuelle isolierte API-Vergleich stoppt lokal vor weiteren Aufrufen ab 1,50 USD erfasster Kosten oder fehlender Kostenangabe; dieses lokale Limit ist kein serverseitiges Budget.

Spending Alerts benötigen einen konfigurierten Webhook; gespeicherte Schwellenwerte allein versenden keine Benachrichtigungen. Die Einrichtung ist vom Betreiber bestätigt; der Empfang einer Testbenachrichtigung wurde nicht gesondert belegt. Webhook-Signing-Secret und URL werden nicht in diesem Repository gespeichert. [Alert-Dokumentation](https://docs.requesty.ai/features/alerts).

## Vorläufige Integrationsentscheidung und Abnahme

Für TASK-16 werden die **bestehenden** Policy-IDs weiterverwendet: `policy/prowin-layout-gen` als Kandidat für den Agenten und `policy/prowin-text-gen` als Kandidat für Text/Distiller. Eine dritte Agent-Policy wird nicht als vorhanden vorausgesetzt. Der Distiller benötigt zusätzlich eine gesonderte Prüfung erzwungener Tool-Auswahl. GPT-5.5 ist mit dem beobachteten Deployment-Fehler nicht freigegeben; die Text-Policy funktioniert aktuell durch Auswahl von GPT-5.4.

Der Betreiber hat TASK-15 am 24.10.2026 mit „aus meiner sicht ist task 15 done“ ausdrücklich abgenommen. Der Task wird mit dem dokumentierten Prüfstand geschlossen. Nicht vollständig nachgewiesene Akzeptanzkriterien werden dadurch nicht als technisch erfüllt ausgewiesen.

Als technische Restpunkte bleiben die vollständigen konkreten Fallback-IDs, Reihenfolge und Retries, Tests jeder Stufe, EU-only-Beschränkungen, konkrete Budget-/Alert-Einstellungen und belegte Alert-Zustellung sowie zehn echte Resident-Läufe mit gemessenen Designkosten dokumentiert. Die Einrichtung von Budget und Alerts ist vom Betreiber bestätigt. Die Abnahme von TASK-15 ersetzt weder diese Nachweise noch die gesonderte Produktionsfreigabe.
