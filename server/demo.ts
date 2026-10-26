import * as actions from './actions.ts'

/**
 * The "Doop" demo agent: a scripted replay that streams a pre-authored
 * welcome frame through the SAME machinery real agents use (status → task,
 * presence, typewriter reveal, activity feed). No LLM involved — it's the
 * product demoing itself on a new user's first canvas.
 *
 * Trigger: markPending() at signup-canvas creation; maybePlay() on the
 * owner's first WebSocket join, so the show starts with an audience.
 */

const pending = new Set<string>() // canvasIds waiting for their first visitor

export function markPending(canvasId: string) {
  pending.add(canvasId)
}

export function maybePlay(canvasId: string) {
  if (!pending.delete(canvasId)) return
  play(canvasId).catch((err) => console.error('[demo] failed', err))
}

const WELCOME_HTML = `<!doctype html>
<html lang="de">
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
  * { margin: 0; box-sizing: border-box; }
  body {
    font-family: 'Instrument Sans', system-ui, sans-serif;
    background: #fdfdfc;
    color: #111110;
    height: 100vh;
    padding: 48px 52px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .eyebrow {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: .28em;
    text-transform: uppercase;
    color: #2743ee;
    margin-bottom: 18px;
  }
  h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 44px; line-height: 1.05; font-weight: 400; letter-spacing: -0.015em; max-width: 12em; }
  h1 em { font-style: italic; color: #2743ee; }
  .lede { margin-top: 16px; max-width: 36em; line-height: 1.55; font-size: 15px; color: #6e6b66; }
  .steps { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
  .step { display: flex; gap: 14px; align-items: baseline; }
  .n {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 12px;
    color: #fdfdfc;
    background: #111110;
    border-radius: 999px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    flex: none;
  }
  .step p { font-size: 14.5px; line-height: 1.5; color: #2b2a27; }
  .step code {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 12.5px;
    background: #f1efea;
    padding: 2px 7px;
    border-radius: 5px;
    white-space: nowrap;
  }
  /* exact replica of the app's topbar "✦ Connect AI" button (.btn.primary),
     so the step points at something that looks like what they'll click */
  .btn-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: 'Instrument Sans', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    background: #2743ee;
    border: 1px solid #2743ee;
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px;
    white-space: nowrap;
    margin: 0 6px 0 3px;
  }
  .foot {
    margin-top: auto;
    padding-top: 24px;
    border-top: 1px solid #d9d6cf;
    font-size: 13px;
    color: #9a968e;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .sig { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 15px; color: #6e6b66; }
</style>
</head>
<body>
  <div class="eyebrow">Live gestaltet · von einem Agenten</div>
  <h1>Ein <em>Agent</em> hat diese Zeichenfläche gerade live gestaltet.</h1>
  <p class="lede">
    Jedes Zeichen kam über denselben Weg, den auch Deine KI nutzen wird: einen MCP-Toolaufruf.
    Alle auf der Arbeitsfläche sehen die Änderungen live – mit Status unten,
    einer Aufgabe rechts und einem Eintrag im Aktivitätsverlauf.
  </p>
  <div class="steps">
    <div class="step"><span class="n">1</span><p>Klicke oben auf <span class="btn-chip">✦ KI verbinden</span> und kopiere den Befehl für Deinen Agenten.</p></div>
    <div class="step"><span class="n">2</span><p>Bestätige die Verbindung im Browser – Dein Agent arbeitet dann <em>in Deinem Namen</em>.</p></div>
    <div class="step"><span class="n">3</span><p>Gib ihm einen Designauftrag und beobachte diese Arbeitsfläche.</p></div>
  </div>
  <div class="foot">
    <span>Antworte mit ↩ auf eine Aufgabe – Agenten greifen Deine Rückmeldung direkt auf.</span>
    <span class="sig">— Doop</span>
  </div>
</body>
</html>`

const CHUNK_SIZE = 350
const CHUNK_MS = 450

async function play(canvasId: string) {
  const actor = actions.resolveActor({ name: 'Doop', kind: 'agent' })
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  await sleep(1500) // let the room render before the show starts
  actions.setAgentStatus(canvasId, actor, 'Ich gestalte Deinen Willkommensgruß …')

  await sleep(700)
  const frame = actions.createFrame(
    canvasId,
    { name: 'Willkommen bei Doop', x: 120, y: 120, width: 760, height: 560, html: '', demo: true },
    actor,
  )
  if (!frame) return

  for (let i = 0; i < WELCOME_HTML.length; i += CHUNK_SIZE) {
    const done = i + CHUNK_SIZE >= WELCOME_HTML.length
    actions.appendFrameHtml(frame.id, WELCOME_HTML.slice(i, i + CHUNK_SIZE), actor, { start: i === 0, done })
    await sleep(CHUNK_MS)
  }

  /* wait for the reveal to catch up (~500 chars/s) before signing off */
  await sleep(Math.min(20_000, WELCOME_HTML.length * 2 + 3000))
  actions.setAgentStatus(canvasId, actor, 'Fertig – verbinde jetzt Deinen eigenen Agenten')
  await sleep(6000)
  actions.setAgentStatus(canvasId, actor, '') // clear: completes the task, presence expires on its own
}
