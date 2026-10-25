# Boot-Guard (TASK-20)

Der erste Import in `server/index.ts` ist der dependencyfreie Guard
`server/prowin/guard.ts`. Er prüft vor dem Konfigurationsparser und allen
Providerinitialisierungen diese Variablen:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ARK_API_KEY`
- `POSTHOG_KEY`
- `VITE_POSTHOG_KEY`

Jeder nichtleere Wert verhindert den Serverstart mit Exitcode 1. Das gilt auch
für reine Leerzeichen und `0`. Fehlende Variablen und leere Werte (`KEY=`)
sind erlaubt. Die Fehlermeldung nennt alle betroffenen Variablennamen und
keine Werte. Es gibt keine Ausnahme für `NODE_ENV=test`.

Für den Start alte Keys aus der Prozessumgebung bzw. der geladenen `.env`
entfernen oder leeren. Requesty wird weiterhin über `REQUESTY_API_KEY`
konfiguriert; ohne Key bleibt der Server-Tier aus. Die Sperre gilt unabhängig
vom gewählten Provider. Die verbliebenen Legacy-Transporttests prüfen einzelne
Module isoliert und erlauben keinen Serverstart mit diesen Keys.

`tests/bootGuard.test.ts` startet den echten Servereinstieg für jeden Key,
mehrere Keys und Grenzwerte in separaten Prozessen. Ein absichtlich ungültiger
Port belegt, dass der Guard vor der normalen Konfigurationsprüfung greift.
Geheimnisfreiheit und ausbleibende Datenbankanlage werden geprüft. Ein echter
Requesty-konfigurierter Server muss `/healthz` mit 200 beantworten.

## Übergabe an den Egress-Test (TASK-22)

Der Guard sperrt die sechs festgelegten Keys; er erzwingt keine vollständige
Host-Allowlist. Folgende verbleibende Pfade gehören in die Egress-Prüfung:

- Requesty-Agent und Distiller über `router.eu.requesty.ai`; Hintergrundtagging
  nutzt denselben Transport, ist derzeit aber funktional deaktiviert.
- Expliziter Azure-Provider (`server/agentModel.ts`, `server/openaiAgent.ts`):
  `AZURE_OPENAI_API_KEY` ist nicht Teil der sechs gesperrten Variablen, der
  Endpoint ist konfigurierbar. Seine Erreichbarkeit und Zielregion separat prüfen.
- Legacy-Bildprovider OpenAI, Gemini und ARK bleiben in `server/imageGen.ts`
  implementiert, sind bei regulärem Boot durch die gesperrten Keys unerreichbar.
- Bild-/Icon-/Logosuche (`server/imageSearch.ts`): Pexels, Iconify, Brandfetch,
  DuckDuckGo sowie nachgeladene Bild-URLs.
- Remote-Assets und Chromium-Ressourcen, ausgehende Webhooks, konfigurierbares
  S3, SMTP, Auth-Endpunkte, Datenbankverbindungen und Stripe nach Aktivierung.

Ein Wrapper um `fetch` erfasst nicht automatisch SDK-, SMTP-, Datenbank- oder
Chromium-Verkehr. Die Testabdeckung muss diese Grenzen ausdrücklich ausweisen.
Magnific folgt mit der separaten Bildprovider-Migration.
