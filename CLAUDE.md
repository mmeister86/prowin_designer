@.context/INDEX.md

Fork: https://github.com/mmeister86/prowin_designer
Upstream: https://github.com/kgoedecke/doop

## proWIN-Regeln

Vor Änderungen am Fork die verbindlichen Quellen lesen:

- [Umsetzungsplan](docs/prowin/doop-fork-umsetzung.md): Zielarchitektur, Entfernungsliste (§ 6),
  Datenschutz (§ 7.6), Upstream-Pflege (§ 15) und offene Entscheidungen (§ 17).
- [Konsolidierte Referenz](docs/prowin/bezugsdokumente-referenz.md): übernommene Anforderungen R1–R6
  und verworfene Ansätze R7. Alte Specs nur gemäß dieser Einordnung verwenden.
- Aufgaben und Abnahmekriterien stehen unter `backlog/tasks/`.

Diese Regeln beschreiben das Ziel des Fork-Umbaus, nicht bereits implementierte Schutzmaßnahmen.
Offene Fragen bleiben offen; Empfehlungen nicht als beschlossene oder verifizierte Lösungen behandeln.

### Architektur und Datenschutz

- Serverseitige LLM-Aufrufe ausschließlich über **Requesty EU** (`https://router.eu.requesty.ai/v1`),
  einschließlich Agent, Distiller und verbleibendem Bild-Tagging. Keine neuen direkten Fremd-Provider
  oder eigene LLM-Provider-Abstraktion einführen. Policy-Strings und EU-Modellketten vor Integration
  verifizieren (Q2/Q9). Bildgenerierung folgt dem separaten Magnific-Adapter laut Umsetzungsplan.
- Local Agent bleibt als gesonderter Pfad für Creator/Admins mit eigenem Claude-Konto erhalten (§ 7.3);
  er ist kein Fallback für den serverseitigen Requesty-Pfad.
- Der geplante **Datenschutz-Boot-Guard** (§ 7.6, TASK-20) muss den Start bei gesetzten
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ARK_API_KEY`, `POSTHOG_KEY` oder
  `VITE_POSTHOG_KEY` verhindern. Bis dahin diese Variablen ungesetzt lassen; Secrets nie versionieren.
- Egress-Prüfung und Frame-CSP gemäß § 7.6 umsetzen und bei Upstream-Merges erhalten.
  Schriften selbst hosten; kein Google-Fonts-CDN in Frames. Frame-HTML und Vision-Screenshots können
  personenbezogene Daten enthalten: Q10 klären, keine pauschale Zusage „keine pbD an KI“ machen.
- Neue proWIN-Logik in `server/prowin/`, `shared/prowin/` und `src/prowin/` isolieren.
  Im bestehenden Core nur dünne Einhängepunkte verwenden (Import und Aufruf).
- Verworfene Ansätze aus Umsetzung § 18 und Referenz R7 nicht wieder einführen: insbesondere
  Fabric.js/Convex/TanStack Start als Ersatzarchitektur, Cloudflare Workers, Vercel/vinext,
  OpenDesign als gehosteter Worker, Loomic als Basis, direktes Azure OpenAI, Magnific Brand Kit
  als führende Quelle, `@imgly/background-removal`, BiRefNet und interaktive Marketplace-Vorschauen.
  Keine zusätzliche Sharp-Exportstrecke oder TanStack-AI-Schicht einführen; bestehende doop-Nutzung
  nicht allein aufgrund dieser Ausschlüsse entfernen. Agent vs. Workflow bleibt Q1.

### Feature-Entfernungen und Upstream-Pflege

- TASK-12: Meta Ads, Refero, Hintergrundbibliothek und Automations sind vorläufig deaktiviert,
  nicht entfernt (`shared/prowin/features.ts`). Code und gespeicherte Daten erhalten; alte Env-Keys
  dürfen die Sperren nicht umgehen. Vor Reaktivierung der Bibliothek eigene Assets und Requesty-Tagging umsetzen.
- Jedes zu entfernende Feature erhält einen eigenen Branch und einen eigenen Commit:
  `chore(prowin): remove <feature>`. UI, Server, Routen, MCP-Tools, Konfiguration und betroffene Tests
  gemeinsam bereinigen. Vor Abschluss `bun run typecheck` und passende Tests
  (`bun run test -- tests/<betroffener-test>.test.ts`) ausführen.
- `origin` zeigt auf `https://github.com/mmeister86/prowin_designer`, `upstream` auf
  `https://github.com/kgoedecke/doop`. Mit `git remote -v` prüfen; fehlt `upstream`, einmalig
  `git remote add upstream https://github.com/kgoedecke/doop` ausführen.
- **Alle zwei bis vier Wochen** Upstream prüfen. Mit sauberem Arbeitsbaum und aktuellem lokalen
  `main` auf einem separaten Merge-Branch arbeiten (Datum ersetzen):

  ```bash
  git fetch upstream
  git switch -c chore/prowin-upstream-YYYY-MM-DD main
  git merge upstream/main
  ```

- Konflikte anhand der proWIN-Quellen lösen; entfernte Integrationen, Fremd-Provider oder Analytics
  nicht versehentlich wiederherstellen. Danach `bun run typecheck`, `bun run test`, `bun run lint`
  und `bun run build` ausführen. Login, Canvas-Anlage und Persistenz manuell prüfen; vorhandene
  Datenschutz-/Egress-Tests einbeziehen. Ergebnis und übernommene Upstream-Revision im PR festhalten.
  Erst nach erfolgreichen Prüfungen nach `main` integrieren.

# doop

Doop is the open-source alternative to Paper.design: a multiplayer design canvas for humans and AI
agents. Every design lives on a shareable Canvas (`/c/<id>`) holding Frames - artboards that
render real HTML in sandboxed iframes. People edit in the browser; AI agents edit through the
built-in MCP server, streaming designs in live. Everyone sees cursors, presence, frame edits, agent
status, and an activity feed in realtime over one WebSocket room per canvas.

## Tech stack

TypeScript/React/Express/Postgres (drizzle), realtime over `ws`, MCP server for agent access, Tauri
desktop shell. Full details in `.context/TECHSTACK.md`, which `.context/INDEX.md` links.

Always use the `clean-code:typescript` skill when writing or reviewing TypeScript code in this
repo.

## First-time setup after clone

```bash
bun install
bun run dev   # zero-config: embedded Postgres (pglite), server + web concurrently
```

Or self-host via Docker: `docker compose up` (real Postgres, port 4400).

## Project layout

```
src/               - React frontend (Vite entry: index.html)
src/components/ui/ - shadcn-generated UI primitives
src/pages/         - route-level pages
src/hooks/         - React hooks
src/lib/           - client-side utilities
server/            - Express backend, WebSocket room, MCP server, better-auth
server/db/         - drizzle-orm schema (schema.ts, auth-schema.ts) and migrations
shared/            - types/utilities shared between server and client
desktop/           - Tauri desktop app wrapper
desktop/src-tauri/ - Rust side of the desktop app
scripts/           - repo maintenance scripts
tests/             - vitest test suite
```

## Language

TypeScript. Always use the `clean-code:typescript` skill when writing or reviewing TypeScript
code. Formatter and lint rules are captured in `.context/CODESTYLE.md`, which `.context/INDEX.md`
links.
