# Magnific-API prüfen (TASK-38)

**Stand:** 27.11.2026 · **Status:** TASK-38 abgenommen. Dokumentation, Offline-Prüfung und ein autorisierter Live-Lauf erfolgreich; konkrete Credit-Abbuchung, Preis und Rechts-/Regionsnachweise offen und an TASK-84 übergeben.

**Zweck:** Belege für TASK-39 sammeln. Kein Runtime-Adapter, keine Env-/Registry-/UI-Änderung. Am 09.11.2026 wurde genau ein kostenpflichtiger Generierungsversuch ausdrücklich autorisiert und erfolgreich ausgeführt. Am 27.11.2026 hat der Nutzer TASK-38 abgenommen; AC3 wurde auf den dokumentierten Kenntnisstand eingegrenzt, die fehlenden Kosten-/Rechts-/Regionsbelege verfolgt TASK-84 vor der M5-Abnahme (TASK-41).

## 1. Evidenzklassen

| Klasse                       | Bedeutung                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Offizielle Dokumentation** | Direkt abgerufene Magnific-Seiten/OpenAPI am 06.11.2026. Belegt nur, was dort steht.                                               |
| **Lokaler Mock-Test**        | `tests/magnificProbe.test.ts` prüft den Probe-Vertrag gegen synthetische Antworten. Kein Provider-Nachweis.                        |
| **Live-Beobachtung**         | [Ein autorisierter Lauf am 09.11.2026](evidence/magnific-live-2026-11-09.json); Nutzer bestätigt akzeptables Anbieter-Creditlimit. |

## 2. Abgerufene Quellen (06.11.2026)

| Quelle                                                                                                                                                                                                                                                                                                                                               | Belastbar für                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Magnific One – Generate](https://docs.magnific.com/api-reference/text-to-image/magnific-one/generate)                                                                                                                                                                                                                                               | POST-Endpunkt, Modi, Felder, Antwortbeschreibung                                    |
| [Magnific One – Task by ID](https://docs.magnific.com/api-reference/text-to-image/magnific-one/task-by-id)                                                                                                                                                                                                                                           | GET-Endpunkt, Statusabruf                                                           |
| [OpenAPI `magnific-api-v1-openapi.yaml`](https://storage.googleapis.com/fc-freepik-pro-rev1-eu-api-specs/magnific-api-v1-openapi.yaml?v=51) (Version 1.0.0)                                                                                                                                                                                          | Exakte Pfade, Header, Schema, Pflichtfelder, Status-Enum, dokumentierte Fehlercodes |
| [Rate limits](https://docs.magnific.com/ratelimits)                                                                                                                                                                                                                                                                                                  | IP-/Key-Limits, Tagesausnahmen                                                      |
| [Pricing](https://docs.magnific.com/pricing) + [AI-Image-Credits](https://www.magnific.com/ai/docs/ai-image-generator-credits)                                                                                                                                                                                                                       | Credit-Modell, Magnific-One-Creditpreise (nur teilweise)                            |
| [API-Dokumentationsindex](https://docs.magnific.com/llms.txt)                                                                                                                                                                                                                                                                                        | Vollständigkeitsprüfung der Dokumentationsnavigation                                |
| [Terms of Use](https://www.magnific.com/legal/terms-of-use), [API Services Terms](https://www.magnific.com/legal/api-services), [AI Products Terms](https://www.magnific.com/legal/ai-products), [Business Subscription Terms](https://www.magnific.com/legal/business-subscription-terms), [Privacy Policy](https://www.magnific.com/legal/privacy) | Nutzungsrechte, Attribution, Training, DPA-Verweis, Rollen                          |

**Discoverability-Lücke:** `llms.txt` listet Magnific One nicht unter den Bildmodellen; die direkte Seite und das dort verlinkte OpenAPI existieren. Der Index ist damit kein Vollständigkeitsbeweis.

## 3. Verifizierte API-Fakten

- **Basis:** `https://api.magnific.com`
- **Auth:** Header `x-magnific-api-key` (OpenAPI-Security-Schema `magnificApiKey`)
- **Erzeugen:** `POST /v1/ai/magnific-one`
- **Status:** `GET /v1/ai/magnific-one/{task-id}`
- **Antwortumschlag:** `data: { task_id, status, generated }`; `task_id` ist UUID, `generated` ist ein Array von URLs, `status` ist `CREATED | IN_PROGRESS | COMPLETED | FAILED`
- **Qualitätsmodus:** `quality` erzeugt **ein** Bild; `draft` erzeugt 8 oder 16 Varianten. `generated` enthält im `quality`-Modus genau ein Ergebnis.
- **Request-Felder:** `prompt` (Pflicht, 1–2000 Zeichen), `mode` (Default `quality`), `aspect_ratio` (Default `1:1`), `quality` (`medium|high`, Default `high`), `resolution` (`1k|2k|4k`, Default `2k`), `tiles` (nur `draft`), `reference_images` (max. 10), `webhook_url`.
- **Dokumentierte Fehler:** `400`, `401`, `500`, `503`. **Nicht dokumentiert** für diesen Pfad: `403`, `429`; ein Rate-Limit-Status ist damit nicht belegt.
- **Async:** POST liefert sofort eine Task-ID; Ergebnis per Polling oder optionalem Webhook. Der Probe nutzt nur Polling und keinen Webhook.

**Live beobachtet (09.11.2026):** ein POST und sieben GET-Statusabfragen, alle HTTP 200; gültige Authentifizierung, dokumentierter Antwortumschlag und Statusfolge `CREATED → IN_PROGRESS → COMPLETED`; genau eine HTTPS-Ergebnis-URL laut API-Antwort. [Bereinigter Nachweis](evidence/magnific-live-2026-11-09.json).

**Nicht beobachtet:** exakte Laufzeit, Bildinhalt/Dateimaße, Ergebnis-URL-Host/Lebensdauer, Kontingentverhalten, Rate-Limit-Antwort, tatsächliche Creditbuchung. Das Bild wurde nicht heruntergeladen. Limits und Fehlerfälle bleiben Dokumentations-/Mock-Evidenz, keine Live-Last- oder Fehlerprüfung.

## 4. Limits

Offiziell dokumentiert (06.11.2026):

- **50 Requests/s** pro IP über ein **5-Sekunden-Fenster** (Burst).
- **10 Requests/s** pro IP im **2-Minuten-Mittel**.
- **30.000 Requests/min** pro API-Key.
- **Kein tägliches Limit** pro API-Key, außer für `ai-image-to-prompt`, `ai-improve-prompt`, `ai-powered-search` (je 100.000 RPD).
- Höhere Limits nur über Sales/Vertrag.

Der Probe bleibt weit darunter: ein POST, höchstens 30 GETs im Abstand von 5 s. **Kein Lasttest.**

## 5. Kosten

Pricing-Seite: Jede KI-Generierung über die API verbraucht Credits; „Unlimited“-Pakete gelten nur in der Web-App, nicht für API-Generierungen. Daraus folgt keine belegte Abrechnung von Statusabfragen.

Magnific-One-Creditpreise der Preisliste (pro Bild):

| Variante | Credits |
| -------- | ------: |
| High 2K  |     180 |
| High 4K  |     250 |
| Max 2K   |     600 |
| Max 4K   |   1.000 |

**Für die Probe (`quality: medium`, `resolution: 1k`) ist kein Preis gelistet.** Die API kennt außerdem kein `max`-Qualitätsniveau. Die API Terms stellen klar, dass API-Credits und -Funktionen von der Website abweichen können. Der exakte Preis für genau diese Konfiguration ist deshalb **blockiert**, nicht geschätzt.

Vor einem Live-Lauf müssen Preis und Account-Cap im Magnific-Dashboard bestätigt und dokumentiert werden. Ablauf für den Credit-Nachweis: Kontostand vor dem Lauf mit Zeitstempel festhalten, genau einen Lauf starten, Kontostand danach erneut festhalten; keine Parallel-/Wiederholungsläufe.

**Ausdrückliche Freigabe am 09.11.2026:** Der Nutzer autorisiert einen kostenpflichtigen Lauf trotz des weiter unbekannten Einzelpreises und bestätigt ein von ihm akzeptiertes Credit-Ausgabenlimit für den bereitgestellten API-Key. Das Limit wurde nicht unabhängig aus dem Account ausgelesen; sein Betrag ist hier nicht bekannt. Der eine Lauf war erfolgreich. Ein Kontostand-/Abbuchungsnachweis liegt nicht vor; daraus wird kein Preis oder tatsächlicher Verbrauch abgeleitet.

## 6. Rechte, Attribution, Datenschutz

- **Output-Rechte:** Die AI Products Terms (§7) übertragen Abonnenten alle Rechte an Outputs; Free-User erhalten nur eine persönliche, nicht-kommerzielle Lizenz. Die API Terms (§3.2) verweisen für Outputs auf die AI Products Terms und machen den API-Kunden für die Rechte seiner Endnutzer verantwortlich. Ob ein reiner API-Vertrag als „Subscription“ im Sinne von §7 gilt, ist **nicht ausdrücklich geklärt**.
- **Attribution:** API Terms §7.1 verlangt bei der Integration/Darstellung von Funktionalität „spezifischer proprietärer KI-Modelle“ eine sichtbare, lesbare Angabe „Powered by Magnific“ oder „Powered by [model name]“. Magnific One ist ein Magnific-eigenes Modell; die konkrete Anwendbarkeit auf doop ist rechtlich noch zu bestätigen.
- **Training:** AI Products Terms §9: Magnific nutzt Inputs/Outputs nicht zum Training **eigener** KI-Modelle; Hosting, Sicherheit und Produktverbesserung bleiben vorbehalten. Das ist keine Aussage über Drittanbieter-Modelle oder über Retention.
- **DPA/Subprozessoren/Regionen/Retention:** API Terms §11.2 und Business Subscription Terms verweisen auf ein DPA „auf dem Developer Website“ bzw. „auf Anfrage“ an `rpd@magnific.com`. Ein öffentlich abrufbares DPA, eine Subprozessorliste, Regionsangaben oder konkrete API-Retentionfristen wurden **nicht gefunden**. Die Firmenadresse Málaga ist **kein** Nachweis des Verarbeitungsorts. Diese Punkte bleiben offene Nachweise.
- **Stock-Nutzung:** separate, weiterhin offene Entscheidung; nicht Teil dieses Probes.

## 7. Brand Kit und Q5

Das OpenAPI-Schema von Magnific One enthält **keinen** Brand-Kit-Parameter; `llms.txt` erwähnt Brand Kits nicht. Das belegt nur: **dieses eine Modell/Interface** bietet im geprüften Schema keinen Brand-Kit-Bezug. Es ist **keine** Aussage, dass alle Magnific-Interfaces keine Brand Kits unterstützen. Q5 bleibt offen.

Fallback bleibt `DESIGN-prowin.md` §7: Bildsprache/Briefing an den Prompt anhängen, keine Texte/Logos/Wasserzeichen, keine fiktiven Produktverpackungen. Der Probe-Prompt ist bewusst synthetisch und neutral:

```text
Bright tidy kitchen, soft daylight, empty worktop and quiet left text area; no products; no text, no letters, no logos, no watermarks
```

## 8. Probe und Mock-Abdeckung

`scripts/magnific-probe.ts` exportiert `runProbe(options)` und `main(args)`. Standard ist ein Dry-Run ohne Netzwerk und ohne Key-Datei. Live benötigt `--live --ack-cost --key-file <pfad>`; unbekannte oder unvollständige Flags werden vor dem Dateizugriff abgelehnt.

Bei injiziertem Testtransport lautet die Evidenzklasse `local-mock`, niemals `live-observation`. Die Gesamtlaufzeit wird mit einer monotonen Uhr begrenzt; auch die Pause zwischen Statusabfragen endet spätestens am lokalen Zeitlimit.

Antworten werden während des Stream-Lesens auf 64 KiB begrenzt; größere Antworten enden ohne Rohbody-Ausgabe mit `response-too-large`.

Der Live-Pfad sendet genau einen POST mit festem Prompt und explizit `{ mode: 'quality', quality: 'medium', resolution: '1k', aspect_ratio: '1:1' }`, `redirect: 'error'` und `x-magnific-api-key`. Danach höchstens 30 GETs auf **nur** die erzeugte Task-ID, 5 s Abstand, 180 s Gesamtdeadline, 30 s pro Request inklusive Body. Kein Retry, kein Redirect-Follow, kein Bild-Download, keine Nutzer-/Canvas-Daten.

Whitelisted Ausgabe: Zeitstempel, Modus/Evidenzklasse, feste Request-Konfiguration, HTTP-Statuscodes, beobachtete Task-Status, Ergebnisanzahl, optional validierte Task-ID. Kein Key, kein Rohbody, keine Ergebnis-URL, keine Fehlermeldung des Providers.

Bei Fehlern nach dem Sendeversuch bleibt diese bereinigte Teilevidenz unter `evidence` erhalten (`ok: false`, CLI-Exitcode 1). `submission: created` bedeutet, dass eine validierte Task-ID vorliegt; `unconfirmed` bedeutet, dass keine Task bestätigt werden konnte — ein möglicherweise trotzdem gestarteter Job darf nicht automatisch erneut angelegt werden. Task-IDs, die den Schlüssel enthalten, werden vor Ausgabe oder Polling verworfen, auch bei UUID-förmigen Schlüsseln.

Die Tests decken ab:

- Dry-Run und Gates (kein Fetch ohne `--ack-cost`/Key);
- exakten POST (Methode, Header, Body, `redirect: 'error'`) und nur passende GETs;
- Statusfolge `CREATED → IN_PROGRESS → COMPLETED`, `FAILED`;
- HTTP `400/401/403/429/500/503`, Netzwerkfehler, Redirect-Fehler;
- ungültiges JSON, Schemafehler, ungültige/fremde Task-ID, unbekannter Status, Abschluss ohne Ergebnis, Nicht-HTTPS-Ergebnis;
- 30-Poll-Grenze, Gesamtdeadline und hängenden Body;
- CLI-Dry-Run, unbekannte/unvollständige Flags, keine Secret-Ausgabe.

**Diese Tests beweisen den lokalen Vertrag, nicht das Providerverhalten.**

## 9. Live-Runbook (erst nach separater Freigabe)

Voraussetzungen:

1. Nutzer-Freigabe für genau einen bezahlten Lauf.
2. Preis für `quality: medium`/`1k` und Account-Cap im Dashboard geprüft und dokumentiert.
3. API-Key ausschließlich in einer Datei, nicht in Argumenten oder Umgebungsvariablen.
4. Credit-Stand vorher festhalten; keine parallelen Magnific-Jobs.

Befehle:

```bash
# Standard: kein Netzwerk, kein Key
bunx tsx scripts/magnific-probe.ts

# Ein bezahlter Lauf, nur nach Freigabe
bunx tsx scripts/magnific-probe.ts --live --ack-cost --key-file /pfad/zum/key
```

Grenzen des Laufs:

- ein POST, keine Wiederholung; ein Timeout **storniert oder erstattet den Provider-Job nicht**;
- maximal 30 Polls, 5 s Intervall, 180 s Deadline, 30 s pro Request;
- kein Download des erzeugten Bildes; der Abruf/Öffnen des Ergebnisses bleibt unverifiziert;
- keine Last-, Parallelen- oder Retry-Tests;
- nach dem Lauf Credit-Stand und HTTP-/Status-Evidenz dokumentieren.

## 10. Offene Punkte

| Punkt                                              | Status                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Live-Auth und Statusfolge                          | belegt durch einen kontrollierten Lauf am 09.11.2026                     |
| Exakte Latenz, Bilddownload und Dateimaße          | nicht geprüft                                                            |
| Exakter Preis `quality: medium` / `1k`             | blockiert (nicht gelistet)                                               |
| Preis/Cap-Bestätigung im Account                   | Cap vom Nutzer bestätigt; Preis/Betrag/Abbuchung nicht unabhängig belegt |
| Output-Rechte für reine API-Kunden                 | offen (AI-Products-Verweis, Abonnentenbegriff unklar)                    |
| Attribution „Powered by Magnific“ konkret für doop | offen (API Terms §7.1)                                                   |
| DPA, Subprozessoren, Regionen, Retention           | nicht öffentlich gefunden                                                |
| Brand Kit / Q5                                     | offen; Fallback `DESIGN-prowin.md` §7                                    |
| AC1                                                | Doku und kontrollierter Live-Lauf belegt; Limits/Fehler nur Doku/Mock    |
| AC3                                                | Kenntnisstand dokumentiert; fehlende Belege in TASK-84                   |

Kein TASK-39-Adapter, keine Stock-Entscheidung und keine Runtime-Änderung in diesem Schritt.
