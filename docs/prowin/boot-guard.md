# Boot-Guard (TASK-20 / TASK-22)

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

**TASK-22 sperrt zusätzlich die direkte Providerwahl:**
`DOOP_AGENT_PROVIDER=azure` und `anthropic` verhindern ebenfalls den Start vor dem
Konfigurationsparser. Das schließt die Azure-Lücke, auch wenn nur Azure-Keys und
keine der sechs verbotenen Variablen gesetzt sind. Die Meldung nennt keine Werte.
`requesty`, eine fehlende Auswahl und leere/blanke Auswahl behalten das bisherige
Requesty-Defaultverhalten. Legacy-Transportmodule werden nicht entfernt.

`tests/bootGuard.test.ts` startet den echten Servereinstieg für jeden Key,
mehrere Keys und Grenzwerte in separaten Prozessen. Ein absichtlich ungültiger
Port belegt, dass der Guard vor der normalen Konfigurationsprüfung greift.
Geheimnisfreiheit und ausbleibende Datenbankanlage werden geprüft. Ein echter
Requesty-konfigurierter Server muss `/healthz` mit 200 beantworten.

## KI-/Analytics-Egress (TASK-22)

Der Guard sperrt Keys und direkte Serverprovider; er erzwingt **keine vollständige
Host-Allowlist**. Der [Egress-Nachweis](egress-pruefung.md) beschränkt sich gemäß
Nutzerentscheidung auf KI und Analytics:

- Requesty-Agent und Distiller über `router.eu.requesty.ai`; Hintergrundtagging
  nutzt denselben Transport, ist derzeit aber funktional deaktiviert.
- Expliziter Azure-/Anthropic-Serverprovider: durch den Providercheck beim Boot gesperrt.
- Legacy-Bildprovider OpenAI, Gemini und ARK bleiben in `server/imageGen.ts`
  implementiert, sind bei regulärem Boot durch die gesperrten Keys unerreichbar.
- Bild-/Icon-/Logosuche (`server/imageSearch.ts`): Pexels, Iconify, Brandfetch,
  DuckDuckGo sowie nachgeladene Bild-URLs bleiben unverändert und außerhalb dieser Prüfung.
- Remote-Assets und Chromium-Ressourcen, ausgehende Webhooks, konfigurierbares
  S3, SMTP, Auth-Endpunkte und Datenbankverbindungen sind ebenfalls nicht Teil
  dieser Host-Beschränkung. Stripe wird erst später aktiviert.

Ein Wrapper um `fetch` erfasst nicht automatisch SDK-, SMTP-, Datenbank- oder
Chromium-Verkehr. Die Testabdeckung muss diese Grenzen ausdrücklich ausweisen.
Magnific folgt mit der separaten Bildprovider-Migration.
