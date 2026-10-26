import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { roleByAgentName } from '../../shared/agents'
import { useIsMobile } from '../hooks/use-mobile'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './ui/sheet'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { ConnectModal } from './ConnectModal'

const obHint = 'text-[12px] leading-[1.45] text-ink-soft'
/* the copy-this-command affordance inside a step */
const obCopy =
  'self-start rounded-md border-line bg-paper-deep px-[9px] py-1 font-mono text-[11.5px] font-normal text-ink shadow-none hover:translate-x-0 hover:translate-y-0 hover:border-ink-soft hover:bg-paper-deep hover:shadow-none'

/**
 * Getting-started checklist, whose whole point is getting an agent of their
 * own onto the canvas over MCP. No "next" buttons: each step checks itself
 * off from live canvas state (a real agent joining presence, its first task
 * appearing). Progress persists in localStorage so completed steps stay
 * checked across canvases and sessions.
 */

const LS_KEY = 'doop:onboarding'

interface Progress {
  dismissed?: boolean
  connected?: boolean
  tasked?: boolean
  /* the AI notice is acknowledged on its own: closing the checklist must not
     count as accepting it, and users who closed it earlier still get it once */
  notice?: boolean
}

function load(): Progress {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(p: Progress) {
  localStorage.setItem(LS_KEY, JSON.stringify(p))
}

export function Onboarding({ canvasId }: { canvasId: string }) {
  const isMobile = useIsMobile()
  const tasks = useStore((s) => s.tasks)
  const presences = useStore((s) => s.presences)
  const [progress, setProgress] = useState<Progress>(load)
  const [copied, setCopied] = useState(false)
  const [showConnect, setShowConnect] = useState(false)

  /* live detection — flips only ever go false -> true */
  const live = useMemo(() => {
    /* "connected" means an OUTSIDE agent over MCP — the resident team
       (Doop and the specialists) doesn't count towards the setup steps */
    const outside = (name: string) => name !== '' && !roleByAgentName(name)
    const agentHere = Object.values(presences).some((p) => p.kind === 'agent' && outside(p.name))
    const agentWorked = tasks.some((t) => outside(t.agentName))
    return { connected: agentHere || agentWorked, tasked: agentWorked }
  }, [tasks, presences])

  /* a step, once seen live, stays done: fold the live signals into the
     stored progress as they light up */
  const next: Progress = {
    ...progress,
    connected: progress.connected || live.connected,
    tasked: progress.tasked || live.tasked,
  }
  if (next.connected !== progress.connected || next.tasked !== progress.tasked) {
    setProgress(next)
  }

  useEffect(() => save(progress), [progress])

  if (progress.dismissed && progress.notice) return null
  const showChecklist = !progress.dismissed
  const allDone = progress.connected && progress.tasked

  function dismiss() {
    setProgress({ ...progress, dismissed: true })
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }, console.error)
  }

  /* the same one-line prompt the Connect AI modal hands out: the MCP server
     ships its own instructions on connect, so the prompt only needs to name
     the canvas */
  const prompt = `Arbeite auf der Doop-Arbeitsfläche ${canvasId}. Beginne mit get_guide({ topic: "doop-instructions" }) und befolge die Anleitung.`

  const checklist = (
    <>
      {showChecklist && (
        <>
          <Step done={!!progress.connected} label="Verbinde Deinen eigenen Agenten">
            {!progress.connected && (
              <>
                <p className={obHint}>
                  Claude Code, Codex, Cursor oder jeder andere MCP-Client kann auf dieser Arbeitsfläche in Deinem Namen
                  gestalten.
                </p>
                <Button size="sm" className="self-start" onClick={() => setShowConnect(true)}>
                  KI verbinden
                </Button>
              </>
            )}
          </Step>

          <Step done={!!progress.tasked} label="Gib ihm eine Aufgabe">
            {progress.connected && !progress.tasked && (
              <>
                <Button size="sm" className={obCopy} onClick={() => copy(prompt)}>
                  {copied ? '✓ kopiert' : 'Einstiegseingabe kopieren'}
                </Button>
                <p className={obHint}>
                  Füge sie in den Chat Deines Agenten ein und sieh zu, wie die Zeichenfläche live entsteht.
                </p>
              </>
            )}
          </Step>

          {allDone && (
            <div className="flex flex-col gap-2.5 border-t border-line-soft pt-2.5">
              <p className="text-[12.5px] leading-[1.5] text-ink-soft">
                So funktioniert es. Noch ein Tipp: Fahre im Bereich über eine Aufgabe und antworte mit ↩ — Deine Notiz
                wird zu einer offenen Anfrage, die jeder Agent während der Arbeit aufnehmen kann.
              </p>
              <Button className="self-start" onClick={dismiss}>
                Verstanden
              </Button>
            </div>
          )}
        </>
      )}

      {!progress.notice && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-2.5">
          <p className="text-[11.5px] leading-[1.5] text-ink-faint">
            KI-Hinweis: Dein Design-HTML, die Screenshots, mit denen der Agent seine Arbeit prüft, und Deine
            Texteingaben werden an Requesty (EU) gesendet. E-Mail-Adressen, Telefonnummern und IBANs werden durch
            Platzhalter ersetzt, bevor eine Anfrage unseren Server verlässt. Namen und Postanschriften werden nicht
            erkannt. Die Bilderzeugung über Magnific (geplant) wird nur durch Deinen Klick ausgeführt, ohne Kontaktdaten
            in der Eingabe.
          </p>
          <Button
            variant="link"
            size="sm"
            className="self-start px-0 text-[11.5px] text-ink-faint"
            onClick={() => setProgress((p) => ({ ...p, notice: true }))}
          >
            Ausblenden
          </Button>
        </div>
      )}
    </>
  )

  const connect = showConnect && <ConnectModal canvasId={canvasId} onClose={() => setShowConnect(false)} />

  if (isMobile) {
    const done = [progress.connected, progress.tasked].filter(Boolean).length
    return (
      <>
        {connect}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="pointer-events-auto absolute left-3 top-3 z-30 h-10 gap-2 rounded-full bg-surface px-3 text-xs font-semibold shadow-card"
            >
              <span className="text-brand">✦</span> {showChecklist ? 'Erste Schritte' : 'KI-Hinweis'}
              {showChecklist && <span className="font-mono text-[10px] text-ink-faint">{done}/2</span>}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[min(78svh,620px)] gap-0 overflow-y-auto rounded-t-2xl border-line bg-surface p-0 shadow-pop"
          >
            <div className="border-b border-line-soft px-5 py-4 pr-14">
              <SheetTitle className="font-display text-lg font-extrabold">
                {showChecklist ? 'Erste Schritte' : 'KI-Hinweis'}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs text-ink-soft">
                {showChecklist
                  ? 'In zwei Schritten bringst Du Deinen eigenen Agenten auf die Arbeitsfläche.'
                  : 'So gelangen Deine Designs und Eingaben zur KI.'}
              </SheetDescription>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5">{checklist}</div>
            {showChecklist && (
              <Button
                variant="link"
                size="sm"
                className="mx-5 mb-5 self-start px-0 text-xs text-ink-faint"
                onClick={dismiss}
              >
                Checkliste ausblenden
              </Button>
            )}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    /* bottom left of the open canvas, beside the Layers panel and tool rail
       (--chrome-left) — clear of the zoom control on the right */
    <div className="pointer-events-auto absolute bottom-3.5 left-[var(--chrome-left,14px)] z-40 flex w-[300px] flex-col gap-2.5 rounded-[14px] bg-surface px-4 pt-3.5 pb-4 shadow-pop transition-[left] duration-150 max-md:right-4 max-md:bottom-4 max-md:left-auto">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{showChecklist ? 'Erste Schritte' : 'KI-Hinweis'}</span>
        {showChecklist && (
          <Button variant="bare" size="icon-sm" className="text-xs" onClick={dismiss} title="Ausblenden">
            ✕
          </Button>
        )}
      </header>

      {checklist}
      {connect}
    </div>
  )
}

function Step({ done, label, children }: { done: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className={cn('w-3.5 flex-none text-[13px]', done ? 'text-success-ink' : 'text-ink-faint')}>
        {done ? '✓' : '○'}
      </span>
      <div className="flex flex-col gap-[5px]">
        <span
          className={cn('text-[12.5px] font-medium', done ? 'text-ink-faint line-through decoration-1' : 'text-ink')}
        >
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}
