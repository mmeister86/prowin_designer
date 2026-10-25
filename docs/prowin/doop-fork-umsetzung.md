# proWIN Content Designer — doop-Fork: Umsetzung & Anpassung

> **Version:** 0.5 (Draft)
> **Author:** Matthias Meister
> **Date:** 22. Oktober 2026
> **Fork:** [`mmeister86/prowin_designer`](https://github.com/mmeister86/prowin_designer)
> **Upstream:** [`kgoedecke/doop`](https://github.com/kgoedecke/doop) @ `0f274ac` (2026-10-18), AGPL-3.0
> **Bezugsdokument:** `bezugsdokumente-referenz.md`. Fasst die sechs bisherigen Specs zusammen. Verweise in der Form **„→ R1.4“** zeigen auf dessen Abschnitte
> **Löst ab:** Stack-Teile der bisherigen Specs (Fabric.js, Convex, Cloudflare Workers, TanStack Start, Dodo). Was davon noch gilt, steht in R1 bis R7
> **Scope:** Fork-Umbau bis zum Testlauf mit der Arbeitsgruppe, danach Produktionsbetrieb fürs Weihnachtsgeschäft

---

## 0. TL;DR

- **doop wird die Basis.** Designs sind HTML-Frames, also ist jedes Element automatisch eine editierbare Ebene. Multiplayer, Element-Editor, PNG/JPG-Export, iOS- und Desktop-App sind schon da.
- **Convex fliegt raus, nicht rein.** doop arbeitet mit In-Memory-Store, Postgres und WebSocket-Rooms und kann damit Realtime bereits. Convex würde den Kern ersetzen, ohne eine neue Fähigkeit zu bringen.
- **Vieles lässt sich ohne Code abschalten.** Fast alle Integrationen sind env-gesteuert. Phase 0 deaktiviert sie per `.env`, Phase 1 entfernt sie danach chirurgisch.
- **Zwei DSGVO-Lecks werden gestopft:** Der Server-Tier läuft künftig über **Requesty EU** (neuer fester Provider), und **Distiller und Background-Tagging** rufen nicht mehr direkt Anthropic auf.
- **Neu dazu kommen:** proWIN-Brand (`DESIGN-prowin.md`), Template-Logik per `data-od-*`, Format-Presets mit Safe Zones, Magnific für Bilder, ormbg, Rybbit.
- **Reihenfolge:** Devbox → Umbau → Coolify ohne Stripe → Testlauf mit der Arbeitsgruppe (Anfang/Mitte November).

---

## 1. Ausgangslage

Das Zielgruppen-Feedback (Okt 2026) zum Fabric.js-Ansatz war eindeutig: zu komplex, „gibt es alles schon“, kein Mehrwert gegenüber Canva. Gewünscht sind:

1. generatives Erstellen **ebenenbasierter** (also editierbarer) Designs,
2. die proWIN-Designsprache „baked in“,
3. direktes Teilen aus der App.

doop erfüllt (1) strukturell: Ein Agent schreibt HTML, und HTML besteht aus Elementen. Für (2) und (3) braucht es die Anpassungen in diesem Dokument.

Vision, Rollen und Strategie (Adoption vor Umsatz, „Absender vs. Botschaft“) gelten unverändert (→ R1.1, R1.2).

Eine Arbeitsgruppe aus Beraterinnen (inkl. Förderin) erstellt gerade Werbematerial für anstehende Aktionen. Sie ist der erste reale Test. **Einschränkung:** Die Gruppe testet den _Creator_-Pfad. Den einfachen Beraterinnen-Pfad muss später zusätzlich jemand außerhalb der Gruppe testen.

---

## 2. Lizenz (AGPL-3.0)

| Punkt                  | Konsequenz                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **§ 13 Network Use**   | Wer die _veränderte_ Version übers Netz nutzt, hat Anspruch auf den Quellcode. Auch im Eigenbetrieb muss der Fork öffentlich sein. Umsetzung: Link „Quellcode“ im Footer auf `https://github.com/mmeister86/prowin_designer`. **Das Repo muss dafür öffentlich sein**, spätestens zum ersten Deploy mit externen Nutzerinnen. |
| **Verkaufsfall**       | Eine kommerzielle Lizenz ist laut `CLA.md` ausdrücklich vorgesehen („offer the software under other terms (for example a commercial license)“). Sie kann nur der Maintainer erteilen.                                                                                                                                         |
| **Eigene Änderungen**  | Bleiben dein Urheberrecht, im Fork aber unter AGPL veröffentlicht.                                                                                                                                                                                                                                                            |
| ⚠️ **iOS / App Store** | Die Verteilung von (A)GPL-Code über den App Store gilt als rechtlich problematisch, weil Apples Nutzungsbedingungen zusätzliche Einschränkungen auferlegen. Das betrifft voraussichtlich auch TestFlight. Vor jeder Store-Verteilung klären (→ Q3).                                                                           |

_Kein Rechtsrat. Vor Store-Release oder Verkauf juristisch prüfen lassen._

---

## 3. doop-Architektur in Kürze

```
┌──────────────┐  REST + WebSocket (pro Canvas ein Room)  ┌───────────────────────────────┐
│ Web (Vite/   │ ◄──────────────────────────────────────► │ Node-Server (Express, :4400)  │
│ React)  :4300│                                          │  ├─ store.ts   In-Memory-State │
├──────────────┤                                          │  ├─ db/persist Write-through   │
│ iOS (SwiftUI │ ◄──── gleiche API ─────────────────────► │  │             → Postgres      │
│ + Blitz)     │                                          │  ├─ resident   Doop Agent      │
├──────────────┤                                          │  ├─ mcp.ts     MCP-Server      │
│ Desktop      │  (Tauri-Shell, lädt Web-URL)             │  ├─ screenshot puppeteer +     │
│ (Tauri)      │                                          │  │             System-Chromium │
└──────────────┘                                          │  └─ storage    S3 oder lokal   │
                                                          └───────────────────────────────┘
```

Daraus folgt:

- **Frames** (`shared/types.ts → Frame`) sind `{ x, y, width, height, html }`. Das HTML ist die einzige Wahrheit.
- **Der Server ist zustandsbehaftet**, weil alle Canvases im RAM liegen. Er braucht also einen dauerhaft laufenden Prozess (passt zu Coolify, nicht zu Cloudflare Workers).
- **Der Export rendert serverseitig** per Headless Chromium. Fonts müssen deshalb im Container liegen.
- **Der Doop Agent ist ein Agent-Loop** (Tool-Calls über mehrere Turns), kein One-Shot-Workflow (→ Q1).
- **Integrationen** hängen teils am Extension-Registry (`server/extensions.ts`: Linear, Slack), teils direkt im Core.
- **Frames im Browser** laufen in `<iframe sandbox="allow-scripts" srcDoc=…>`. Skripte laufen also, isoliert ohne Same-Origin.

---

## 4. Entscheidungen

| Bereich                 | Entscheidung                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Basis                   | doop-Fork, Upstream-Remote bleibt erhalten (§ 15)                                                      |
| Datenhaltung            | **Postgres** (doop-Standard), kein Convex                                                              |
| Hosting                 | Erst **Devbox** (lokal), dann **Coolify/Hetzner**                                                      |
| Auth                    | Better Auth (in doop enthalten). E-Mail/Passwort, Google, Apple. **Kein** SSO/OIDC, **kein** Microsoft |
| KI-Text/Layout          | **Requesty EU** als einziger Server-Provider (Modellwechsel über Routing Policies)                     |
| KI-Bilder               | **Magnific**                                                                                           |
| Payments                | **Stripe bleibt**. Beim ersten Deploy ist kein Key gesetzt, Billing also aus                           |
| Clients                 | Web + **Desktop (Tauri)** + **iOS** bleiben                                                            |
| Local Agent             | **Bleibt** (Claude Code auf dem eigenen Rechner, für Creator)                                          |
| Analytics               | **Rybbit** statt PostHog                                                                               |
| Übernommene Ausschlüsse | `@imgly`, BiRefNet, Vercel, eigene LLM-Provider-Abstraktion bleiben verworfen (→ R7)                   |

---

## 5. Phase 0: Lokales Setup auf der Devbox

```bash
git clone https://github.com/mmeister86/prowin_designer && cd prowin_designer
git remote add upstream https://github.com/kgoedecke/doop   # once; check with `git remote -v`
bun install
bun run dev        # Web :4300, API/WS/MCP :4400, PGlite unter data/pg
```

Erreichbar per Tailscale vom Mac aus (`http://devbox:4300`). PGlite reicht lokal. Postgres kommt erst auf Coolify.

### 5.1 Deaktivieren ohne Code (`.env`)

**Historischer Phase-0-Plan:** Die folgende Tabelle beschreibt den Stand vor den
Entfernungen. Die alten Integrationsvariablen sind keine aktuelle Konfigurationsanleitung.
TASK-3–18 haben die beschlossenen Pfade entfernt beziehungsweise gemäß TASK-12
fest deaktiviert. Der aktuelle M1-Prüfstand steht in der [Abnahmematrix](m1-abnahme.md).

Die meisten Integrationen sind aus, solange ihre Variablen **nicht gesetzt** sind. Für die Devbox gilt deshalb: nur das Nötige setzen.

| Feature                    | Aus, wenn …                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| Linear                     | `LINEAR_*` leer                                                                  |
| Slack                      | `SLACK_*` leer                                                                   |
| GitHub-App                 | `GITHUB_APP_*` leer                                                              |
| Gemini Cloud Worker        | `DOOP_GEMINI_CLOUD_WORKERS` leer                                                 |
| ChatGPT-Connect            | `CHATGPT_CONNECT_DISABLED=1`                                                     |
| SSO/OIDC                   | `OIDC_*` leer                                                                    |
| Microsoft-Login            | `MICROSOFT_*` leer                                                               |
| Meta Ads                   | `META_*` leer                                                                    |
| Web-Import via Context.dev | `CONTEXT_DEV_API_KEY` leer (⚠️ lokaler Chromium-Fallback bleibt aktiv → Phase 1) |
| PostHog                    | `POSTHOG_*`, `VITE_POSTHOG_KEY` leer                                             |
| Stripe                     | `STRIPE_*` leer → Billing aus, alle Workspaces aktiv                             |
| Fremd-Modelle              | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ARK_API_KEY` leer      |

UI-Einträge, Routen und MCP-Tools bleiben trotzdem sichtbar. Das räumt Phase 1 auf.

---

## 6. Phase 1: Chirurgische Entfernung

**Vorgehen pro Feature:** eigener Branch, löschen, `bun run typecheck` + Tests, ein Commit pro Feature (`chore(prowin): remove <feature>`). So bleibt jeder Schritt einzeln revertierbar und der Upstream-Merge nachvollziehbar.

| Feature                                 | Server                                                                                      | Client / Sonstiges                                     | Hinweise                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Linear**                              | `server/linear/`                                                                            | Settings-Einträge                                      | Aus `extensions` in `server/extensions.ts` austragen                         |
| **Slack**                               | `server/slack/`                                                                             | Settings-Einträge                                      | wie Linear                                                                   |
| **GitHub-App**                          | `githubApp.ts`, `github.ts`, `githubRecon.ts`, Tabelle `github_connections`                 | Import-Quelle „GitHub repo“ in `ImportSources.tsx`     | Migration für die Tabelle                                                    |
| **Gemini Cloud**                        | `geminiCloudRuns.ts`, `geminiCloudWorker*.ts`, `geminiCloudMcp.ts`, `shared/geminiCloud.ts` | `workers/gemini/`                                      | Zweig in `pickModel()` (`agentModel.ts`) entfernen                           |
| **ChatGPT-Plugin/App**                  | `chatgptApp.ts`                                                                             | `chatgpt-plugin/`                                      |                                                                              |
| **BYO-Modellkonten**                    | TASK-18: entfernt; Alt-API liefert 410; Migration 0039 löscht Credentials                   | `AgentExecutionPanel.tsx` erhält Server-/Local-Auswahl | Siehe § 7.3 und [Migrationshinweise](model-account-removal.md)               |
| **Design Sync**                         | `ingest.ts`, Tabellen `sync_*`                                                              | `public/doop-sync.js`, Import-Quelle „Live app“        |                                                                              |
| **Webseiten-Import**                    | `importer.ts`, `webpageImport.ts`, `contextDev.ts`                                          | Import-Quelle „Website“                                | Prüfen, ob `cssPrune.ts` noch anderweitig genutzt wird                       |
| **Website-Publishing / -Viewer**        | `website.ts`, `websiteAccess.ts`, MCP-Tool `view_website`                                   |                                                        |                                                                              |
| **SSO/OIDC + Microsoft**                | OIDC-/Microsoft-Teile in `auth.ts`, `env.ts`                                                | Login-Buttons; iOS liest `/api/oidc-config`            | Google + Apple bleiben (Apple ist Store-Pflicht, wenn Google angeboten wird) |
| _Vorschlag:_ **Meta Ads**               | `meta.ts`, Pull-Provider in `shared/automations.ts`                                         |                                                        | Nicht auf deiner Liste, aber eine Fremd-Integration ohne Nutzen              |
| _Vorschlag:_ **Refero-Inspiration**     | `inspiration.ts`, Tool `search_inspiration`                                                 |                                                        | Externe Fremd-Designs. Ersetzen durch proWIN-Referenzframes (§ 8)            |
| _Vorschlag:_ **Hintergrund-Bibliothek** | `backgrounds.ts`                                                                            |                                                        | Zieht per `BACKGROUNDS_ORIGIN` Bilder von doop.design → § 7.5                |
| **PostHog**                             | `analytics.ts`                                                                              | `posthog-js` in ca. 10 Komponenten                     | Ersatz → § 12                                                                |

**Behalten:** Local Agent (`localAgent*.ts`, `LocalClaude.tsx`), Desktop (`desktop/`), iOS (`ios/`), Live Activities/APNs (gehört zu iOS), Webhooks, Workspaces, Community-Gallery (wird Marketplace, Lückenliste → R5.2), Design Memory, MCP-Server, Pexels-Suche (optional, nur mit Key).

**Offen:** Automations (geplante Workflows). Ohne Meta bleiben nur Agent-Task-Schritte. Vorerst UI ausblenden, später entscheiden (→ Q6).

**Aktueller Abnahmestand:** [TASK-19: M1-Abnahmematrix](m1-abnahme.md) dokumentiert
Entfernungen, die beschlossenen TASK-12-Ausnahmen, erhaltene Kernfunktionen und Testgrenzen.
Die Automations-Entscheidung ist durch TASK-12 als vorläufige Deaktivierung getroffen.

---

## 7. Phase 2: KI über Requesty EU

### 7.1 Ausgangslage im Code

- `server/agentModel.ts`: `ServerProvider = 'anthropic' | 'azure'`, Auswahl über `DOOP_AGENT_PROVIDER` (`env.ts`).
- `server/chatCompletionsAgent.ts`: OpenAI-kompatibler Transport (für OpenRouter/Gemini). Er übersetzt die Anthropic-Message-Form, in der der Agent-Loop geschrieben ist, nach Chat Completions.
- **Bewusst keine frei konfigurierbare Base-URL**: Der Kommentar im Code nennt SSRF als Grund. Operator-seitige URL-Variablen gibt es aber schon (`OPENROUTER_CHAT_URL`, `GEMINI_OPENAI_CHAT_URL`). Ein Operator-Env für Requesty passt also zum bestehenden Muster.

### 7.2 Requesty als Server-Provider

```ts
// server/env.ts
DOOP_AGENT_PROVIDER: str({ choices: ['anthropic', 'azure', 'requesty'], default: 'requesty' }),
REQUESTY_API_KEY: str({ default: undefined }),
// operator-level constant, never user input (same pattern as OPENROUTER_CHAT_URL)
REQUESTY_CHAT_URL: str({ default: 'https://router.eu.requesty.ai/v1/chat/completions' }),
```

```ts
// server/chatCompletionsAgent.ts
export function requestyConfig(model: string, vision = true): ChatCompletionsConfig | null {
  if (!env.REQUESTY_API_KEY) return null
  return {
    url: env.REQUESTY_CHAT_URL,
    headers: { Authorization: `Bearer ${env.REQUESTY_API_KEY}` },
    model,
    label: 'Requesty EU',
    vision,
  }
}
```

```ts
// server/agentModel.ts
export type ServerProvider = 'anthropic' | 'azure' | 'requesty'

function requestyTier(): AgentModel | null {
  const config = requestyConfig(env.DOOP_AGENT_MODEL ?? 'policy/prowin-design-agent')
  if (!config) {
    warnOnce('[doop-agent] DOOP_AGENT_PROVIDER=requesty needs REQUESTY_API_KEY — server tier is off.')
    return null
  }
  return {
    provider: 'requesty',
    label: `Requesty EU (${config.model})`,
    // same shape as the openrouter-key branch in byoModel()
    run: (req) =>
      runChatCompletionsTurn(config, {
        system: joinSystem(req),
        tools: req.tools,
        messages: req.messages,
        maxTokens: req.maxTokens,
      }),
  }
}

const serverTiers: Record<ServerProvider, () => AgentModel | null> = {
  anthropic: anthropicTier,
  azure: azureTier,
  requesty: requestyTier,
}
```

- `DOOP_AGENT_MODEL` zeigt auf eine **Requesty Routing Policy** im bestätigten Format `policy/<name>` (TASK-15, [Prüfprotokoll](requesty-pruefung.md)). Die bestehenden `policy/prowin-text-gen` und `policy/prowin-layout-gen` wurden authentifiziert aufgerufen.
- **Agent-Policy:** Der Agent-Loop braucht zuverlässiges **Tool-Calling** und **Vision** (er prüft seine eigenen Screenshots). Die vorhandene `policy/prowin-layout-gen` ist der Integrationskandidat; ihre vollständige Fallback-Kette bleibt zu bestätigen (→ R4.3). `prowin-design-agent` im obigen Codebeispiel ist ein unbestätigter Platzhalter, keine vorhandene oder freigegebene Policy. Die frühere Mistral-/Sonnet-4.6-/GPT-4.1-Kette ist überholt. Benchmark-Kriterien → Q2.
- `joinSystem()` existiert bereits in `agentModel.ts`. Es flacht die System-Blöcke zu einem String ab, wie es der OpenRouter-Pfad in `byoModel()` auch tut.

### 7.3 Free-Tier-Meter und BYO-Konten

`RESIDENT_TASK_LIMIT` ist standardmäßig **0** und deaktiviert serverbezahlte Aufgaben. **TASK-18 umgesetzt (24.10.2026):** BYO-Konten entfallen vollständig; ausschließlich aktuell berechtigter Local-Agent-Opt-in von Creator/Admins hebt den Server-Aufgabenzähler auf. Alte Local-Präferenzen nach Rollenentzug umgehen den Zähler nicht und blockieren die reguläre Serverauswahl nicht.

- **Test:** `RESIDENT_TASK_LIMIT` hoch setzen (z. B. `1000`) und das Budget-Limit **in Requesty** konfigurieren. Das ist die eigentliche Kostenbremse.
- **Später:** Meter pro Workspace/Monat statt pro Konto, gekoppelt an den Stripe-Plan (`allowance.ts`, `TeamAllowance.tsx`). Die Limit-Vorschläge der bisherigen Spec sind der Ausgangspunkt (→ R4.5). Die Tarife bleiben bis zur Klärung mit der Vertriebsleitung eingefroren (→ R1.9).
- BYO-Konten (ChatGPT, OpenAI, Anthropic, OpenRouter, Gemini) sind aus UI, APIs und Text-/Bildinferenz entfernt. Alt-Endpunkte liefern authentifiziert JSON mit 410; Migration 0039 entfernt gespeicherte Zugänge. [Upgrade und Grenzen](model-account-removal.md).
- **Local Agent bleibt**, aber nur für Creator/Admins sichtbar. Wer ihn nutzt, schickt Canvas-Inhalte über das _eigene_ Claude-Konto. Das ist für das Team okay, für Beraterinnen nicht.

### 7.4 Distiller → Requesty (Fund 2)

Der ursprüngliche `server/distill.ts` rief Anthropic an zwei Stellen direkt auf, unabhängig vom Agent-Provider. **TASK-17 umgesetzt (24.10.2026):** Zusammenfassung und Regelprüfung verwenden jetzt Requesty EU mit `DOOP_DISTILL_MODEL=policy/prowin-text-gen`, Vision aus und Aktivierung ausschließlich durch `REQUESTY_API_KEY`. Der Distill-Aufruf erzwingt das benannte Tool; ungültige oder unvollständige Antworten verbrauchen keine Evidenz. Details und Testgrenzen: [Requesty-Server](requesty-server.md#memory-distiller-und-verbleibendes-bild-tagging-task-17).

**Umbau:** Weil `runChatCompletionsTurn` bereits Anthropic-förmige Messages und Tools annimmt, ist der Eingriff klein:

```ts
// server/distill.ts — replace the Anthropic client
const config = () => requestyConfig(env.DOOP_DISTILL_MODEL, false) // Default in env.ts: policy/prowin-text-gen

async function complete(system: string, messages: Anthropic.MessageParam[], tools: Anthropic.Tool[] = []) {
  const cfg = config()
  if (!cfg) return null // distiller silently off, as before
  return runChatCompletionsTurn(cfg, { system, messages, tools, maxTokens: 1024 })
}
```

- Aufrufstellen auf `complete()` umstellen. `tool_use`-Blöcke aus `result.content` lesen wie bisher.
- Die Aktivierungsbedingung ändert sich von `ANTHROPIC_API_KEY` auf `REQUESTY_API_KEY`.
- `import Anthropic` bleibt nur für **Typen** erhalten.

### 7.5 Weitere direkte Modell-Aufrufe

| Datei               | Was                                                  | Maßnahme                                                                                                                                              |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backgrounds.ts`    | Verbleibendes Bild-Tagging                           | TASK-17: `requestyConfig(env.DOOP_AGENT_MODEL, true)` mit JSON-Schema; Bibliothek bleibt gemäß TASK-12 deaktiviert                                    |
| `backgrounds.ts`    | `BACKGROUNDS_ORIGIN` lädt Bilder **von doop.design** | Nicht setzen. Eigene proWIN-Bildbibliothek oder Feature entfernen. Sonst lädt der Browser der Beraterin Bilder von einem Fremdserver (IP-Übertragung) |
| `imageGen.ts`       | OpenAI/Gemini/Ark für Bilder                         | → Magnific (§ 10)                                                                                                                                     |
| `localAgentRuns.ts` | Claude lokal                                         | bleibt (§ 7.3)                                                                                                                                        |

### 7.6 DSGVO-Leitplanken (technisch erzwungen)

1. **Boot-Guard:** Der Server startet **nicht**, wenn `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ARK_API_KEY` oder `POSTHOG_KEY` gesetzt sind.
   ```ts
   // server/prowin/guard.ts — imported first in server/index.ts
   const FORBIDDEN = [
     'ANTHROPIC_API_KEY',
     'OPENAI_API_KEY',
     'GEMINI_API_KEY',
     'ARK_API_KEY',
     'POSTHOG_KEY',
     'VITE_POSTHOG_KEY',
   ] as const
   const set = FORBIDDEN.filter((k) => process.env[k])
   if (set.length) throw new Error(`[prowin] non-EU model/analytics keys must stay unset: ${set.join(', ')}`)
   ```
2. **Egress-Test:** ein Test mit `fetch`-Wrapper, der alle ausgehenden Hosts protokolliert. Ein Agent-Lauf darf nur `router.eu.requesty.ai`, die Magnific-API und (später) `api.stripe.com` erreichen.
3. **Frame-CSP:** `FRAME_BOOTSTRAP` (`FrameView.tsx`) bekommt eine Content-Security-Policy, die externe Fonts, Skripte und Bilder blockiert. Erlaubt sind nur die eigene Instanz, `data:` und `blob:`. Weil `srcDoc`-Iframes ohne `allow-same-origin` die Origin `null` haben, muss die Instanz-Origin explizit drinstehen (→ Q7).
4. **Fonts:** siehe § 8.3.
5. **Screenshots und Kontaktdaten (→ R4.6, Q10):** Der Agent schickt **Screenshots** an ein Vision-Modell, und im Frame-HTML stehen **echte Kontaktdaten** der Beraterin. Die alte Aussage „keine personenbezogenen Daten an die KI“ gilt damit nicht mehr automatisch. **Entschieden am 25.10.2026 (Option A, Platzhalter):** E-Mail, Telefon und IBAN werden vor jedem Requesty-Request durch Platzhalter ersetzt, Screenshots werden aus der redigierten HTML-Kopie gerendert, und gespeicherte Frames behalten die Originale. Namen und freie Adressen erkennt die Regex nicht (→ TASK-29), Bildinhalte gar nicht — beides steht im UI-Hinweis. Der Hinweis erscheint einmalig im Onboarding, die Pitch-Checkliste ist angepasst. Details: [Datenfluss zur KI](datenfluss-ki.md).

---

## 8. Phase 3: proWIN-Brand

### 8.1 Eine Quelle, drei Abnehmer

Das Magnific Brand Kit bietet laut Doku **keinen Export** (weder MD noch JSON) und kein Auslesen per API. Die Richtung kehrt sich deshalb um:

```
                    ┌──▶ Magnific Brand Kit   (manuell als Text/PDF-Quelle hochladen)
DESIGN-prowin.md ───┼──▶ Agent-Systemprompt   (resident.ts + guide.ts / get_guide)
  + tokens.css      └──▶ Design Memory        (GuidelineDoc „prowin-brand“ auf jedem Canvas)
```

**Gliederung von `DESIGN-prowin.md`:** Markenkern & Tonalität · Farben (nur Token-Namen + Hex) · Typografie (Familien, Größen-Skala, Gewichte) · Logo-Regeln (Schutzraum, Mindestgröße, nie generieren) · Bildsprache (für Magnific) · Produktnamen & Schreibweisen · Pflicht-Disclaimer · Do/Don't · Sprache (Du/Sie, „Online-Party: Do., 14. Okt., 20 Uhr“ statt „Gemeindehaus“) · Pflicht-Rollen pro Format. Die Abschnitte entsprechen den Feldern des bisherigen `BrandKit`-Interfaces (→ R4.2).

### 8.2 Einspeisung in doop

- **Systemprompt:** `DESIGN-prowin.md` wird beim Boot geladen und in den Resident-Systemprompt (`resident.ts`) eingefügt, als gecachter Block. MCP-Agents bekommen es zusätzlich über `get_guide` (`guide.ts`).
- **Design Memory:** Neue Canvases erhalten automatisch ein `GuidelineDoc` `{ name: 'prowin-brand', title: 'proWIN Brand', markdown }`. Es ist im `MemoryPanel` sichtbar und editierbar. Die globale Datei bleibt die Wahrheit.
- **Referenz-Frames:** ein „proWIN Referenzen“-Canvas mit 6 bis 10 guten Beispielen, als Memory-Referenzen gepinnt. Ersetzt die Refero-Inspiration.

### 8.3 Tokens & Fonts

`guide.ts` sagt den Agents heute wörtlich: „Google Fonts via `<link>` work.“ Das verstößt gegen die DSGVO (LG München) und widerspricht der Fontsource-Entscheidung.

- **Fonts:** Fontsource-Pakete einbinden. Der Server liefert sie unter `/fonts/*` aus. Im **Dockerfile** installieren, damit der Chromium-Export identisch rendert. Für iOS/Blitz prüfen, ob die Fonts per URL geladen werden (→ Q8).
- **Guide anpassen:** Google Fonts verbieten und nur die proWIN-Fontfamilien und Tokens erlauben.
- **Write-Normalisierung:** Beim Speichern eines Frames stellt der Server sicher, dass genau ein Block `<style data-od-brand>` mit `@font-face` und `:root`-Tokens vorhanden ist. Externe Font-Links werden entfernt. Inline statt verlinkt, weil drei Renderer dasselbe HTML zeigen müssen (Browser-Iframe, Chromium-Export, Blitz auf iOS).
- **Token-Änderungen** laufen per Migrationsskript, das den Block in allen Frames neu schreibt.

---

## 9. Phase 4: Template-Logik per `data-od-*`

### 9.1 Attribute

| Attribut                 | Werte                                                                                | Bedeutung                                       |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `data-od-id`             | stabiler String                                                                      | Pflicht für jedes editierbare/gesperrte Element |
| `data-od-role`           | `headline` \| `body` \| `image` \| `cta` \| `logo` \| `contact` \| `date` \| `decor` | Semantik, für UI-Labels und KI-Patches          |
| `data-od-label`          | z. B. „Dein Foto“                                                                    | Anzeigename im Formular/Panel                   |
| `data-od-locked`         | vorhanden = gesperrt                                                                 | Nur Creator dürfen ändern                       |
| `data-od-max-length`     | Zahl                                                                                 | Max. Zeichen für Text                           |
| `data-od-allowed-colors` | Token-Liste, z. B. `primary,cream`                                                   | Erlaubte Farben (nur Tokens)                    |

Ersetzt `EditableFieldMeta`. Die Zuordnung alt → neu steht in R1.4. Rollen und Berechtigungen → R1.2, R1.3.

### 9.2 Drei Durchsetzungsebenen

1. **UI** (`FrameView.tsx`, `LayersPanel.tsx`, `ElementPanel.tsx`): Gesperrte Elemente sind für Nicht-Creator nicht auswählbar (Schloss-Hinweis). Die Farbwahl zeigt nur `allowed-colors`, und Texteingaben werden auf `max-length` begrenzt.
2. **Server** (`actions.ts → updateFrame`, Commit von `appendFrameHtml`): vergleicht altes und neues HTML.
3. **Agent** (`guide.ts`, Systemprompt): erklärt die Attribute. Gesperrte Elemente niemals ändern, editierbare nur innerhalb der Constraints.

```ts
// server/prowin/templateGuard.ts
import { parseHTML } from 'linkedom' // add as dependency (happy-dom is dev-only today)

export function checkTemplateEdit(prevHtml: string, nextHtml: string, isCreator: boolean): string[] {
  if (isCreator) return []
  const byId = (html: string) => {
    const map = new Map<string, Element>()
    for (const el of parseHTML(html).document.querySelectorAll('[data-od-id]')) {
      map.set(el.getAttribute('data-od-id')!, el)
    }
    return map
  }
  const before = byId(prevHtml)
  const after = byId(nextHtml)
  const errors: string[] = []

  for (const [id, el] of before) {
    const next = after.get(id)
    if (el.hasAttribute('data-od-locked')) {
      if (!next || next.outerHTML !== el.outerHTML) errors.push(`locked element changed: ${id}`)
      continue
    }
    if (!next) continue
    const max = Number(el.getAttribute('data-od-max-length'))
    if (max && (next.textContent ?? '').length > max) errors.push(`max length exceeded: ${id}`)
  }
  return errors
}
```

Die Farbprüfung (nur `var(--token)` aus `allowed-colors`) kommt in denselben Guard.

### 9.3 Rollen

Wer ist „Creator“? Q4 ist entschieden: selbst aktivierter Creator-Kontostatus plus separate Workspace-Rechte ([Details](rollen-berechtigungen.md)). **Für den Testlauf:** Alle in der Arbeitsgruppe sind Creator, weil sie ja Vorlagen bauen. Der Guard wird erst relevant, wenn Beraterinnen diese Vorlagen nutzen.

---

## 10. Phase 5: Format-Presets & Safe Zones

### 10.1 Presets

Safe-Zone-Werte → R2.2, vollständige Preset-Liste → R1.6. Gestartet wird mit den fünf Kernformaten. A4 läuft bewusst in CSS-Pixeln (96 dpi) und wird mit Skalierung exportiert. Ein HTML-Layout auf 2480 px Breite wäre unhandlich.

```ts
// shared/prowin/formats.ts
export type Insets = { top: number; right: number; bottom: number; left: number }
const all = (n: number): Insets => ({ top: n, right: n, bottom: n, left: n })

export const FORMAT_PRESETS = {
  'ig-post': { label: 'Instagram Post', width: 1080, height: 1080, safe: all(50), exportScale: 1 },
  'ig-story': {
    label: 'Instagram Story',
    width: 1080,
    height: 1920,
    safe: { top: 200, right: 0, bottom: 250, left: 0 },
    exportScale: 1,
  },
  'wa-status': {
    label: 'WhatsApp Status',
    width: 1080,
    height: 1920,
    safe: { top: 150, right: 0, bottom: 200, left: 0 },
    exportScale: 1,
  },
  'fb-post': { label: 'Facebook Post', width: 1200, height: 630, safe: all(50), exportScale: 1 },
  a4: { label: 'A4 (Druck)', width: 794, height: 1123, safe: all(11) /* ≈ 3 mm */, exportScale: 3.125 /* → 300 dpi */ },
} as const satisfies Record<string, { label: string; width: number; height: number; safe: Insets; exportScale: number }>

export type FormatPresetId = keyof typeof FORMAT_PRESETS
```

### 10.2 Datenmodell

- `Frame` (`shared/types.ts`) bekommt `preset?: FormatPresetId`.
- Die Tabelle `frames` (`server/db/schema.ts`) bekommt eine Spalte `preset text`, plus Drizzle-Migration.
- Ein Frame mit Preset hat **feste Maße**. Resize ist für Nicht-Creator gesperrt.

### 10.3 Safe-Zone-Overlay

- Ein reines UI-Overlay in `FrameView.tsx` (analog `SnapGuides.tsx`). Es steht **nicht** im HTML und wird nicht exportiert. Das Verhalten (Farbe, Toggle, Creator-Override) folgt R2.2.
- Wenn ein Element mit `data-od-role` in die Safe Zone ragt: dezente Warnung, keine Blockade.
- Der Agent bekommt die Safe Zones des Presets als Text in seinen Kontext und wird angewiesen, Text und CTA außerhalb zu halten.

### 10.4 Export & Teilen

- `FrameExportModal.tsx` → PNG/JPG in Preset-Größe (`exportScale` als `deviceScaleFactor` in `screenshot.ts`). A4 zusätzlich als PDF über `page.pdf()` (später).
- **Teilen:** Web Share API (`navigator.share({ files })`) mit Download als Fallback. iOS nativ über das Share Sheet.

---

## 11. Phase 6: Magnific für Bilder — geplant, noch nicht gebaut (TASK-39/40)

- **Registry:** `shared/modelMenu.ts → IMAGE_MODELS` bekommt einen Eintrag `{ id: 'magnific-one', provider: 'magnific' }`. Die bisherigen Einträge (`openai`, `gemini`, `ark`) fliegen raus. `DOOP_IMAGE_MODEL=magnific-one`.
- **Adapter:** Provider-Zweig `magnific` in `server/imageGen.ts`, mit `MAGNIFIC_API_KEY` (neu in `env.ts`). Endpunkte, Auth-Header und Async-Modell (Task-ID + Polling) **exakt aus der offiziellen API-Doku** übernehmen, nicht raten. Polling mit Timeout. Das Ergebnis landet über `storage.ts` als Asset.
- **Brand Kit:** Ob die API ein Brand Kit referenzieren kann, sagt die Doku nicht (→ Q5). Fallback: Bildsprache-Abschnitt aus `DESIGN-prowin.md` an den Prompt anhängen (Prompt-Enhancement-Muster → R4.4).
- **Bildgenerierung nur auf ausdrücklichen Klick**, nicht automatisch durch den Agent ohne Bestätigung. Das ist der teuerste Schritt (→ R4.5).
- **Prompt-Regeln (im Adapter erzwungen, nicht nur im Agent-Prompt):**
  - Suffix „no text, no letters, no logos, no watermarks“. Text gehört immer ins HTML.
  - **Keine personenbezogenen Daten** im Bildprompt. Namen, Telefonnummern und Adressen aus dem Canvas-Kontext werden vor dem Request entfernt (einfacher Regex- und Rollen-Filter auf `contact`/`date`-Inhalte).
- **Rate Limit:** bestehendes `MCP_GENERATIONS_PER_MIN` weiterverwenden.

---

## 12. Phase 7: Kleine Bausteine

### 12.1 Hintergrund-Entfernung (ormbg, clientseitig)

- `@huggingface/transformers` mit ormbg-ONNX (Apache-2.0). Code, `cleanAlpha`-Bereinigung, Self-Hosting der Modelldateien und Lizenzbegründung → R1.7.
- Einstieg: Button „Hintergrund entfernen“ im Bild-Tab von `ElementPanel.tsx`. Das Ergebnis geht über den bestehenden Asset-Upload und ersetzt `src`.
- Nur Web/Desktop. iOS später (Core ML wäre dort naheliegend).

### 12.2 Rybbit statt PostHog

- Rybbit-Script in `index.html` (self-hosted Instanz).
- Ein dünner Wrapper `src/lib/track.ts` (`track(event, props)` → `window.rybbit?.event(...)`) ersetzt alle `posthog-js`-Aufrufe (ca. 10 Komponenten). Danach `posthog-js` entfernen.
- `server/analytics.ts` bleibt No-op, solange kein Key gesetzt ist. Ob Rybbit serverseitige Events annimmt, prüfen. Sonst bleibt es dabei.
- **Events:** `design_requested`, `frame_generated`, `element_edited`, `frame_exported`, `frame_shared`, `template_used`. Die bisherigen Events (→ R1.8) gehen darin auf: `design_exported` → `frame_exported`, `template_forked` → `template_used`, `ai_feature_used` → `frame_generated`. `template_published` und `upgrade_clicked` kommen später (Marketplace bzw. Stripe).
- Sobald die Frame-CSP steht: Rybbit-Host in `script-src`/`connect-src` der App-CSP aufnehmen (→ R1.8).

### 12.3 Animationen

Konzept, Phasen und Entscheidungen bleiben gültig, die Technik wird deutlich einfacher (→ R3):

- **Phase A (Presets):** CSS-`@keyframes` statt eigener Keyframe-Engine. Ein Preset ist eine CSS-Klasse am Element.
- **Export:** GIF/MP4 **serverseitig** per Chromium-Screencast. Der iOS-Safari-WebM-Engpass aus der Spec entfällt.
- **Edge Cases:** Welche noch gelten, steht in R3.3.
- Bleibt Post-MVP.

### 12.4 Pitch-Framing „Absender vs. Botschaft“

Kein Code. Fließt in Onboarding-Texte und die Startseite ein: proWINs Abo personalisiert den **Absender**, dieses Tool individualisiert die **Botschaft**. Die bisherige Wettbewerbstabelle ist an diesem Punkt veraltet und muss neu geschrieben werden (→ R1.1, R1.9).

---

## 13. Phase 8: Deployment auf Coolify (ohne Stripe)

| Thema                | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build                | Vorhandenes `Dockerfile` (enthält Chromium + `CHROME_PATH`). Ergänzen: proWIN-Fonts                                                                                                                                                                                                                                                                                                                                                                                |
| Datenbank            | Postgres-Service in Coolify, `DATABASE_URL`. **Backups** über Coolify aktivieren                                                                                                                                                                                                                                                                                                                                                                                   |
| Auth                 | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`                                                                                                                                                                                                                                                                                                                                                                                                         |
| Assets               | Lokales Volume (`./data/assets`) für den Test. Später Hetzner Object Storage (S3, EU) über `BUCKET`/`ENDPOINT`/…                                                                                                                                                                                                                                                                                                                                                   |
| E-Mail               | **Resend über SMTP, ohne Codeänderung** (doops `mailer.ts` nutzt nodemailer): `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587` (STARTTLS), `SMTP_USER=resend`, `SMTP_PASS=<Resend-API-Key>`, `EMAIL_FROM=…@mail.<domain>`. Port 465 nicht nutzen, Hetzner sperrt ihn ausgehend in der Regel. Wenn Mails hängen, auf 2587 ausweichen. Absender-Subdomain (z. B. `mail.<domain>`) mit Region **eu-west-1** anlegen, SPF/DKIM/DMARC laut Resend setzen. ⚠️ DSGVO → § 13.1 |
| KI                   | `DOOP_AGENT_PROVIDER=requesty`, `REQUESTY_API_KEY`, `DOOP_AGENT_MODEL`, `DOOP_DISTILL_MODEL`, `RESIDENT_TASK_LIMIT`                                                                                                                                                                                                                                                                                                                                                |
| Bilder               | `MAGNIFIC_API_KEY`, `DOOP_IMAGE_MODEL=magnific-one`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Stripe               | **nicht gesetzt** → Billing aus                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Proxy                | Traefik über Coolify, TLS. WebSockets (`/ws`) durchreichen                                                                                                                                                                                                                                                                                                                                                                                                         |
| Registrierung        | `SIGNUP_EMAIL_DOMAINS` oder Einladungen. Für den Test geschlossene Registrierung, `ADMIN_EMAILS` = du                                                                                                                                                                                                                                                                                                                                                              |
| AGPL                 | Footer-Link „Quellcode“ → `https://github.com/mmeister86/prowin_designer` (Repo öffentlich)                                                                                                                                                                                                                                                                                                                                                                        |
| Coolify-Quelle       | GitHub-App/Deploy-Key auf `mmeister86/prowin_designer`, Branch `main`, Build über das vorhandene `Dockerfile`                                                                                                                                                                                                                                                                                                                                                      |
| Desktop              | `DOOP_APP_URL=https://<deine-domain> bun run build` (im `desktop/`-Ordner)                                                                                                                                                                                                                                                                                                                                                                                         |
| iOS                  | Server-URL in den App-Einstellungen. Verteilung erst nach Klärung von Q3                                                                                                                                                                                                                                                                                                                                                                                           |
| Datenschutzerklärung | Auftragsverarbeiter-Liste → R6                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### 13.1 E-Mail über Resend: was dabei zu beachten ist

- **Warum Resend:** kein eigener Mailserver, Zustellbarkeit und Reputation sind Resends Problem. Bei Störungen gibt es ein Dashboard und Logs statt Postfix-Debugging. Stalwart bleibt für deine privaten Postfächer, die App verschickt nicht darüber.
- **Wofür doop Mails verschickt:** E-Mail-Bestätigung, Passwort-Reset, Kommentar-Benachrichtigungen. Mit gesetztem `SMTP_HOST` müssen neue Konten ihre E-Mail bestätigen (`REQUIRE_EMAIL_VERIFICATION`). Für den Testlauf ist das sinnvoll. Den Ablauf vorher einmal selbst durchspielen.
- ⚠️ **Daten liegen in den USA:** Laut Resend-Doku steuert die Region nur, _wo versendet wird_. Kontodaten, Metadaten und Logs (also auch Empfängeradressen) speichert Resend **immer in den USA**. Das ist eine Drittlandübermittlung. Nötig sind deshalb ein **DPA mit Resend**, eine Rechtsgrundlage (EU-US Data Privacy Framework oder Standardvertragsklauseln, prüfen) und ein Eintrag in der Datenschutzerklärung.
- **Datensparsam halten:** Nur Transaktionsmails, keine Design-Inhalte oder Kontaktdaten aus Frames in Mail-Texten. Kommentar-Mails nur mit Link, ohne Kommentartext (in `commentNotifications.ts` prüfen).
- **Fallback, falls proWIN später EU-only verlangt:** SMTP-Anbieter mit EU-Speicherung (z. B. Brevo oder Scaleway TEM, beide Frankreich, Konditionen dann prüfen). Weil doop reines SMTP nutzt, ist der Wechsel nur eine Änderung der `.env`.

---

## 14. Meilensteine

| #     | Ergebnis                   | Fertig, wenn …                                                                                                         |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| M0    | Devbox läuft               | `bun run dev` läuft, Login klappt, ein Canvas lässt sich anlegen                                                       |
| M1    | Entrümpelt                 | Alle Punkte aus § 6 entfernt, Typecheck und Tests grün                                                                 |
| M2    | KI DSGVO-sauber            | Agent läuft über Requesty, Distiller ebenso, Boot-Guard und Egress-Test grün                                           |
| M3    | proWIN-Look                | Brand-Prompt, Memory, Fonts self-hosted, Frame-CSP aktiv                                                               |
| M4    | Vorlagen-fähig             | `data-od-*`-Guard, Presets, Safe Zones, Export in Preset-Größe, Teilen                                                 |
| M5    | Bilder                     | Magnific-Adapter mit PII-Filter                                                                                        |
| M6    | Online                     | Coolify-Deploy, Rybbit, Backups, AGPL-Link                                                                             |
| **T** | **Testlauf Arbeitsgruppe** | Anfang/Mitte November, Beobachtungsprotokoll (§ 16)                                                                    |
| M7    | Nach dem Test              | ormbg, Beraterinnen-Mobile-Flow (eigene Spec, Canva-Modus → R1.5), Marketplace-Lücken (→ R5.2), Stripe, iOS-Verteilung |

---

## 15. Upstream-Strategie

doop entwickelt sich schnell (Server ca. 27 k Zeilen TS). Damit Upstream-Fixes übernehmbar bleiben:

- **Neues isolieren:** `server/prowin/`, `shared/prowin/`, `src/prowin/`. Im Core nur dünne Einhängepunkte (ein Import, ein Aufruf).
- **Entfernen in eigenen Commits** (§ 6). Upstream-Konflikte betreffen dann meist gelöschte Dateien und sind leicht aufzulösen.
- Alle 2 bis 4 Wochen `git fetch upstream && git merge upstream/main` auf einem eigenen Branch, mit Tests.
- **Für Coding-Agents:** `CLAUDE.md` in `mmeister86/prowin_designer` um einen Abschnitt „proWIN-Regeln“ ergänzen (DSGVO-Guard, keine neuen Fremd-Provider, Konventionen aus diesem Dokument).
- **Dieses Dokument und die Referenz** zusätzlich unter `docs/prowin/` im Fork ablegen. Dann haben Coding-Agents auf der Devbox sie direkt im Repo und müssen nicht aufs Projekt zugreifen.

---

## 16. Testlauf mit der Arbeitsgruppe

- **Aufgabe statt Einweisung:** „Erstellt das Material für Aktion X.“ Nichts erklären, nur zuschauen.
- **Messen:** Zeit bis zum ersten geteilten Post · Anzahl „Wie geht …?“ · Abbrüche (wo, warum) · Agent-Kosten pro fertigem Design (Requesty-Dashboard).
- **Schlüsselfrage am Ende:** „Würdet ihr das nächste Mal wieder hiermit arbeiten statt mit Canva?“
- **Neutrale Stimme:** Das Feedback der Förderin stärker gewichten als Feedback aus der Familie.

---

## 17. Offene Fragen

| #   | Frage                                                                   | Optionen                                                                                                       | Empfehlung                                                                                                                                                                           | Status                            |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Q1  | Agent-Loop vs. Workflow-Entscheidung (Okt 2026: „Workflow statt Agent“) | A) doop-Agent wie er ist, B) zusätzlich ein One-Shot-Generierungspfad                                          | **A für den Test**, Kosten/Latenz messen, danach entscheiden                                                                                                                         | offen                             |
| Q2  | Welche Modelle in `prowin-design-agent`?                                | Kette von `prowin-layout-gen` als Start, Vision-Modelle vorn (→ R4.3)                                          | Benchmark: 10 Briefs, Tool-Call-Fehlerrate, Kosten pro Design. Den geplanten 20-Prompt-Textbenchmark (→ R4.3) mitnehmen                                                              | offen                             |
| Q3  | iOS-Verteilung unter AGPL (App Store/TestFlight)                        | A) kommerzielle Lizenz/Freigabe vom Maintainer, B) nur Web/Desktop                                             | Maintainer früh kontaktieren                                                                                                                                                         | offen                             |
| Q4  | Wer ist Creator?                                                        | Instanz-Admin bleibt Matthias; Creator-Selbstregistrierung plus separate Workspace-Rollen Owner/Creator/Member | Beschlossen und umgesetzt in TASK-14, [Details](rollen-berechtigungen.md)                                                                                                            | entschieden (24.10.2026)          |
| Q5  | Kann die Magnific-API ein Brand Kit nutzen?                             | ja / nein → Prompt-Fallback                                                                                    | Mit Test-Request früh klären                                                                                                                                                         | offen                             |
| Q6  | Automations behalten?                                                   | ausblenden / entfernen / ausbauen                                                                              | ausblenden                                                                                                                                                                           | offen                             |
| Q7  | Frame-CSP mit `null`-Origin                                             | explizite Instanz-Origin, Proxy-Pfad                                                                           | Prototyp in `FRAME_BOOTSTRAP`                                                                                                                                                        | offen                             |
| Q8  | Fonts in Blitz (iOS)                                                    | per URL / im App-Bundle                                                                                        | im Code von `ios/Doop/Blitz` prüfen                                                                                                                                                  | offen                             |
| Q9  | Requesty-Modell-String für Routing Policies                             | `policy/<name>` laut aktueller Doku und erfolgreichen authentifizierten Aufrufen (→ R4.3)                      | Bestehende Policies verwenden; vollständige Modellketten und EU-Fallbacks weiter prüfen (TASK-15)                                                                                    | Syntax verifiziert (24.10.2026)   |
| Q10 | Personenbezogene Daten und Screenshots an die KI                        | A) Platzhalter vor Agent-Call ersetzen und danach wieder einsetzen, B) Rechtsgrundlage + UI-Hinweis            | **A umgesetzt** (TASK-21): E-Mail/Telefon/IBAN vor jedem Requesty-Request ersetzt, Frame-HTML reversibel, Namen/Adressen offen bis TASK-29 (→ [Datenfluss zur KI](datenfluss-ki.md)) | entschieden (25.10.2026, TASK-21) |
| Q11 | Reiner Ansichts-Link                                                    | doop kennt nur Mitbearbeiten per Link                                                                          | Für Beraterinnen-Sharing nachrüsten oder bewusst nur Gallery/Export (→ R5.2)                                                                                                         | offen                             |

---

## 18. Evaluiert und verworfen

| Option                                      | Grund                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Convex in doop**                          | Würde den zustandsbehafteten Kern (`store.ts`, `db/persist.ts`, WS-Rooms, ca. 31 DB-Dateien) ersetzen. Realtime/Multiplayer kann doop bereits |
| **Cloudflare Workers**                      | doop braucht einen dauerhaft laufenden Prozess (In-Memory-Store) und Chromium für den Export                                                  |
| **Gehostete OpenDesign-Instanz als Worker** | Agent-Loop über OpenCode, Single-Tenant-Token, sehr schneller Release-Takt. Als Ideenquelle (Apache-2.0-Skills) weiter nutzbar                |
| **Loomic als Basis**                        | Excalidraw-Whiteboard, bildzentriert, Text nicht sauber editierbar                                                                            |
| **Azure OpenAI direkt**                     | Funktioniert in doop out of the box, aber Requesty erlaubt Modellwechsel ohne Code                                                            |
| **Magnific Brand Kit als Quelle**           | Kein Export, kein API-Lesezugriff. Richtung umgekehrt (§ 8.1)                                                                                 |
| **Google Fonts in Frames**                  | DSGVO (LG München). Fontsource self-hosted                                                                                                    |

Aus den bisherigen Specs übernommene Ausschlüsse mit Neubewertung → R7.

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.5     | 2026-10-25 | Q10 entschieden (Option A, Platzhalter, TASK-21) und § 7.6 Punkt 5 auf den umgesetzten Datenfluss umgestellt; neues Dokument [Datenfluss zur KI](datenfluss-ki.md)                                                                                                                                                                                                                                         |
| 0.4     | 2026-10-23 | Fork-Repo `mmeister86/prowin_designer` eingetragen (Header, Clone-Befehl, AGPL-Link, Coolify-Quelle, CLAUDE.md), Docs zusätzlich unter `docs/prowin/` im Fork                                                                                                                                                                                                                                              |
| 0.3     | 2026-10-23 | E-Mail über **Resend** (SMTP) statt Stalwart, mit Port-Hinweis für Hetzner, Absender-Subdomain in eu-west-1 und neuem § 13.1 (DSGVO: Resend speichert Kontodaten und Logs in den USA)                                                                                                                                                                                                                      |
| 0.2     | 2026-10-22 | Verweise auf die sechs Einzel-Specs durch `bezugsdokumente-referenz.md` (R1–R7) ersetzt. **Korrektur:** Die Policy-Kette von `prowin-layout-gen` war falsch angegeben (das war `prowin-text-gen`). Policy-Strings auf `policy/<name>` umgestellt. Neu: DSGVO-Punkt 5 (Screenshots + pbD), Rybbit-Event-Abgleich, Bildgenerierung nur auf Klick, Q10 (pbD an KI), Q11 (Ansichts-Link), Q9 teilweise geklärt |
| 0.1     | 2026-10-22 | Erstfassung: Fork-Entscheidung, Entfernungsliste mit Dateipfaden, Requesty-Provider, Distiller-Fix, Brand/Fonts, Template-Guard, Presets, Magnific, Deployment, Meilensteine, offene Fragen                                                                                                                                                                                                                |
