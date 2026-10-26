import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { navigate } from '../App'
import { useStore } from '../lib/store'
import { roleByAgentName } from '../../shared/agents'
import { AgentIcon } from './AgentIcon'
import { ClaudeDesktopInstall } from './ClaudeDesktopInstall'
import { canAddToClaudeDesktop, claudeConnectorInstallUrl } from '../lib/claudeConnection'
import { CursorInstall } from './CursorInstall'
import { CodexInstall } from './CodexInstall'
import { Button } from './ui/button'
import { CodeBlock } from './ui/code-block'
import { Disclosure } from './ui/collapsible'
import { Dot } from './ui/dot'
import { ChevronLeftIcon, PuzzleIcon } from './ui/icons'
import { Modal, ModalActions, ModalLede, ModalSpacer, ModalTitle } from './ui/modal'
import { barPrimaryBtn } from './TopBar'
import { cn } from '@/lib/utils'

/**
 * "Connect AI" is about agents that join the canvas from outside: Claude Code,
 * Codex, Cursor, the Claude app, or any MCP client. Pick the agent,
 * then follow its own three steps. Running the built-in Doop Agent on your own
 * ChatGPT or Claude plan is an account setting and lives in Settings, next to
 * the prompt bar's allowance meter — not here.
 */

type AgentId = 'claude-code' | 'claude' | 'codex' | 'cursor' | 'mcp'
type View = 'agents' | AgentId
type ClaudeConnection = 'desktop' | 'web'

interface AgentOption {
  id: AgentId
  name: string
  blurb: string
  icon: ReactNode
}

const AGENTS: AgentOption[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    blurb: 'Über Dein Terminal verbinden',
    icon: <AgentIcon name="claude" size={20} />,
  },
  { id: 'claude', name: 'Claude', blurb: 'Doop zu Claude hinzufügen', icon: <AgentIcon name="claude" size={20} /> },
  {
    id: 'codex',
    name: 'Codex',
    blurb: 'ChatGPT-Desktop-App und Codex CLI',
    icon: <AgentIcon name="codex" size={20} />,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    blurb: 'Doop zu Cursor hinzufügen',
    icon: <AgentIcon name="cursor" size={20} />,
  },
  {
    id: 'mcp',
    name: 'Anderer MCP-Client',
    blurb: 'Manuelle Verbindung verwenden',
    icon: <PuzzleIcon width={20} height={20} />,
  },
]

const agentById = (id: AgentId): AgentOption => AGENTS.find((agent) => agent.id === id) ?? AGENTS[0]!

/** `canvasId` is optional: opened from the home dashboard there is no canvas to
 *  suggest a prompt for, and no presence connection to watch for an arrival. */
export function ConnectModal({
  canvasId,
  onClose,
  initialAgent,
  showAgentStatus = true,
}: {
  canvasId?: string
  onClose: () => void
  initialAgent?: AgentId
  /** Standalone setup can suggest a canvas without subscribing to its presence. */
  showAgentStatus?: boolean
}) {
  const [view, setView] = useState<View>(initialAgent ?? 'agents')
  return (
    <Modal size="lg" className="flex flex-col overflow-hidden p-0 sm:p-0" onClose={onClose}>
      {view === 'agents' ? (
        <AgentPicker onPick={setView} />
      ) : (
        <AgentSteps
          agent={view}
          canvasId={canvasId}
          showAgentStatus={showAgentStatus}
          onBack={() => setView('agents')}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

/* ---------- pick the agent, then its three steps ---------- */

function AgentPicker({ onPick }: { onPick: (agent: AgentId) => void }) {
  const [agent, setAgent] = useState<AgentId>('claude-code')
  return (
    <>
      <div className={body}>
        <ModalTitle>Wähle Deinen Agenten</ModalTitle>
        <ModalLede>
          Lass einen Agenten, den Du bereits nutzt, über MCP auf dieser Arbeitsfläche arbeiten. Wähle ihn aus, um die
          Verbindungsanleitung zu sehen.
        </ModalLede>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {AGENTS.map((option) => (
            <ChoiceCard
              key={option.id}
              selected={agent === option.id}
              onClick={() => setAgent(option.id)}
              icon={option.icon}
              title={option.name}
              blurb={option.blurb}
            />
          ))}
        </div>
      </div>

      <ModalActions className={footer}>
        <Button
          variant="primary"
          className={barPrimaryBtn}
          onClick={() => {
            onPick(agent)
          }}
        >
          Verbinden
        </Button>
      </ModalActions>
    </>
  )
}

interface Step {
  title: string
  body: ReactNode
  code?: string
  action?: ReactNode
}

function agentSteps(
  agent: AgentId,
  mcpUrl: string,
  prompt: string,
  claudeConnection: ClaudeConnection,
  canvasId?: string,
): { lede: string; steps: Step[] } {
  const jsonConfig = JSON.stringify({ mcpServers: { doop: { type: 'http', url: mcpUrl } } }, null, 2)
  const pointAt: Step = {
    title: 'Auf diese Arbeitsfläche verweisen',
    body: prompt
      ? 'Füge dies als erste Nachricht ein. Alles Weitere erhält der Agent vom Server.'
      : 'Öffne eine Arbeitsfläche und bitte den Agenten, darauf zu arbeiten. Alles Weitere erhält er vom Server.',
    code: prompt || undefined,
  }
  switch (agent) {
    case 'claude-code':
      return {
        lede: 'Drei Schritte, etwa eine Minute. Danach gestaltet Claude Code auf dieser Arbeitsfläche in Deinem Namen.',
        steps: [
          {
            title: 'Doop als MCP-Server hinzufügen',
            body: (
              <>
                Führe dies einmal in einem beliebigen Terminal aus. Dadurch wird der Server <code>doop</code> für jedes
                Projekt registriert.
              </>
            ),
            code: `claude mcp add --transport http doop "${mcpUrl}"`,
          },
          {
            title: 'Über Claude Code anmelden',
            body: (
              <>
                Gib in Claude Code <code>/mcp</code> ein, wähle <strong>doop</strong> und dann{' '}
                <strong>Authentifizieren</strong>. Ein Browser-Tab öffnet sich, in dem Du die Verbindung genehmigen
                kannst.
              </>
            ),
          },
          pointAt,
        ],
      }
    case 'claude':
      if (claudeConnection === 'desktop') {
        return {
          lede: 'Füge Doop über die Desktop-App hinzu, bestätige in Claude und gestaltet gemeinsam.',
          steps: [
            {
              title: 'Doop zu Claude Desktop hinzufügen',
              body: 'Klicke in der Doop-Desktop-App auf „Zu Claude hinzufügen“ und bestätige die Installation in Claude. Deine Doop-Serveradresse wird automatisch eingetragen.',
              action: <ClaudeDesktopInstall mcpUrl={mcpUrl} />,
            },
            {
              title: 'Dein Doop-Konto verbinden',
              body: 'Aktiviere die Erweiterung in Claude. Melde Dich im geöffneten Browser bei Doop an und genehmige die Verbindung.',
            },
            {
              ...pointAt,
              body: prompt
                ? 'Starte einen neuen Claude-Chat, aktiviere Doop im Werkzeugmenü und sende dies als erste Nachricht.'
                : 'Starte einen neuen Claude-Chat, aktiviere Doop im Werkzeugmenü und sage ihm, auf welcher Arbeitsfläche er arbeiten soll.',
            },
          ],
        }
      }
      if (!claudeConnectorInstallUrl(mcpUrl)) {
        return {
          lede: 'Claudes Online-Verbindung benötigt einen öffentlich erreichbaren HTTPS-Server.',
          steps: [
            {
              title: 'Desktop-Verbindung für diesen Server verwenden',
              body: 'Diese Doop-Adresse ist lokal oder verwendet HTTP. Wähle oben „Desktop-App“, um Dich von Deinem Computer aus zu verbinden, oder öffne Doop unter seiner öffentlichen HTTPS-Adresse.',
            },
          ],
        }
      }
      return {
        lede: 'Füge Doop zu Deinem Claude-Konto hinzu, genehmige die Verbindung und beginne zu gestalten. Kein Download nötig.',
        steps: [
          {
            title: 'Doop zu Claude hinzufügen',
            body: 'Öffne Claude mit bereits eingetragenem Doop-Namen und der Serveradresse. Prüfe die Angaben und füge die Verbindung hinzu.',
            action: (
              <Button asChild variant="solid" className="mt-2.5">
                <a href={claudeConnectorInstallUrl(mcpUrl)!} target="_blank" rel="noopener noreferrer">
                  Zu Claude hinzufügen
                </a>
              </Button>
            ),
          },
          {
            title: 'Anmeldung genehmigen',
            body: 'Klicke bei der neuen Verbindung auf „Verbinden“. Ein Browser-Tab öffnet sich, in dem Du die Verbindung genehmigen kannst.',
          },
          {
            ...pointAt,
            body: prompt
              ? 'Aktiviere Doop im Werkzeugmenü eines neuen Chats und sende dies als erste Nachricht.'
              : 'Aktiviere Doop im Werkzeugmenü eines neuen Chats und sage ihm, auf welcher Arbeitsfläche er arbeiten soll.',
          },
        ],
      }
    case 'codex':
      return {
        lede: 'Füge Doop über die Desktop-App hinzu, melde Dich an und beginne mit Codex zu gestalten.',
        steps: [
          {
            title: 'Doop zu Codex hinzufügen',
            body: 'Doop Desktop richtet Codex für Dich ein. Das funktioniert mit Codex CLI und dem Codex-Tab in der ChatGPT-Desktop-App.',
            action: <CodexInstall mcpUrl={mcpUrl} canvasId={canvasId} />,
          },
          {
            title: 'Über Codex anmelden',
            body: 'Öffne einen neuen Codex-Chat. Wenn Doop eine Anmeldung benötigt, melde Dich über die MCP-Einstellungen an. Führe für Codex CLI den folgenden Befehl aus und genehmige die Verbindung im Browser.',
            code: 'codex mcp login doop',
          },
          pointAt,
        ],
      }
    case 'cursor':
      return {
        lede: 'Füge Doop zu Cursor hinzu, melde Dich an und gestaltet gemeinsam.',
        steps: [
          {
            title: 'Doop zu Cursor hinzufügen',
            body: 'Öffne Cursor und prüfe die Serververbindung. Kein Datei-Download nötig.',
            action: <CursorInstall mcpUrl={mcpUrl} />,
          },
          {
            title: 'Anmeldung genehmigen',
            body: 'Aktiviere den doop-Server in Cursor und schließe die Anmeldung im Browser ab. Danach kann Dein Agent auf den für Dich zugänglichen Arbeitsflächen arbeiten.',
          },
          {
            ...pointAt,
            body: prompt
              ? 'Öffne den Agenten-Chat und sende dies als erste Nachricht.'
              : 'Öffne den Agenten-Chat und sage ihm, auf welcher Arbeitsfläche er arbeiten soll.',
          },
        ],
      }
    case 'mcp':
      return {
        lede: 'Doop ist ein MCP-Server mit Streamable HTTP und OAuth. Jeder Client, der das unterstützt, kann hier gestalten.',
        steps: [
          {
            title: 'Diesen Server zur MCP-Konfiguration Deines Clients hinzufügen',
            body: (
              <>
                Windsurf, Zed, Cline und VS Code lesen eine JSON-Datei wie diese. Füge den Eintrag <code>doop</code>{' '}
                dort ein.
              </>
            ),
            code: jsonConfig,
          },
          {
            title: 'Anmeldung genehmigen',
            body: 'Bei der ersten Verbindung Deines Clients öffnet sich ein Browser-Tab zur Genehmigung. Danach arbeitet der Agent in Deinem Namen und seine Änderungen werden Dir zugeordnet.',
          },
          pointAt,
        ],
      }
  }
}

function AgentSteps({
  agent,
  canvasId,
  showAgentStatus,
  onBack,
  onClose,
}: {
  agent: AgentId
  canvasId?: string
  showAgentStatus: boolean
  onBack: () => void
  onClose: () => void
}) {
  const option = agentById(agent)
  const mcpUrl = `${location.origin}/mcp`
  const [claudeConnection, setClaudeConnection] = useState<ClaudeConnection>(() =>
    canAddToClaudeDesktop() || !claudeConnectorInstallUrl(mcpUrl) ? 'desktop' : 'web',
  )
  /* Deliberately thin: the MCP server ships its own INSTRUCTIONS on connect and the
     rest lives behind get_guide. The only thing this prompt knows that they don't is
     which canvas the human is looking at. */
  const prompt = canvasId
    ? `Arbeite auf der Doop-Arbeitsfläche ${canvasId}. Beginne mit get_guide({ topic: "doop-instructions" }) und befolge die Anleitung.`
    : ''
  const { lede, steps } = agentSteps(agent, mcpUrl, prompt, claudeConnection, canvasId)
  return (
    <>
      <div className={body}>
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-line-soft bg-paper">
            {option.icon}
          </span>
          <div>
            <ModalTitle>Verbinden {option.name}</ModalTitle>
            <ModalLede className="mt-1">{lede}</ModalLede>
          </div>
        </div>

        {agent === 'claude' && (
          <div className="mt-5 flex gap-2" role="group" aria-label="Claude-Verbindungsmethode">
            {(['web', 'desktop'] as const).map((connection) => (
              <Button
                key={connection}
                size="sm"
                variant={claudeConnection === connection ? 'solid' : 'ghost'}
                aria-pressed={claudeConnection === connection}
                onClick={() => setClaudeConnection(connection)}
              >
                {connection === 'desktop' ? 'Desktop-App' : 'Online verbinden'}
              </Button>
            ))}
          </div>
        )}

        <ol className="mt-6">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className={cn('grid grid-cols-[28px_1fr] gap-3.5', i > 0 && 'mt-3.5 border-t border-line-soft pt-3.5')}
            >
              <span className="mt-px grid size-[26px] place-items-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h4 className="text-copy font-semibold text-ink">{step.title}</h4>
                <p className="mt-0.5 text-body leading-[1.5] text-ink-soft [&_code]:rounded-[4px] [&_code]:bg-paper-deep [&_code]:px-1 [&_code]:font-mono [&_code]:text-caption [&_code]:text-ink">
                  {step.body}
                </p>
                {step.code && <CodeBlock text={step.code} className="mt-2.5" />}
                {step.action}
              </div>
            </li>
          ))}
        </ol>

        {agent === 'claude' && claudeConnection === 'web' && claudeConnectorInstallUrl(mcpUrl) && (
          <Disclosure label="Verbindungshilfe" className="mt-4 text-label leading-relaxed text-ink-soft">
            <p>
              Falls Claude zuerst eine Anmeldung verlangt, kehre hierher zurück und klicke erneut auf „Zu Claude
              hinzufügen“. Du kannst in Claude auch{' '}
              <strong>Anpassen → Verbindungen → Benutzerdefinierte Verbindung hinzufügen</strong> mit dieser Adresse
              verwenden:
            </p>
            <CodeBlock text={mcpUrl} className="mt-2" />
          </Disclosure>
        )}

        {agent === 'mcp' && (
          <p className="mt-4 text-xs leading-[1.5] text-ink-faint">
            Kein Browser für die Anmeldung (n8n, Mastra, CI)? Erstelle einen Agentenschlüssel unter{' '}
            <button
              type="button"
              className="font-medium text-accent-ink underline underline-offset-2"
              onClick={() =>
                navigate(`/settings?pane=keys${canvasId ? `&from=${encodeURIComponent(`/c/${canvasId}`)}` : ''}`)
              }
            >
              Einstellungen → Agentenschlüssel
            </button>{' '}
            und sende ihn als <code>Authorization: Bearer dpk_…</code>. Der Schlüssel handelt in Deinem Namen auf den
            Arbeitsflächen, auf die Du Zugriff hast.
          </p>
        )}
      </div>

      <ModalActions className={footer}>
        {canvasId && showAgentStatus ? <AgentArrival name={option.name} /> : <ModalSpacer />}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm px-2 py-2 text-xs font-medium text-ink-soft hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon width={14} height={14} />
          Zurück
        </button>
        <Button onClick={onClose}>Fertig</Button>
      </ModalActions>
    </>
  )
}

/* ---------- shared pieces ---------- */

/* The modal is a column: the screen's body scrolls in the middle and the
   action row sits on the bottom edge, so the back button and the main action
   stay in reach on the long agent screens (the JSON config plus the headless
   note runs past a laptop viewport). */
const body = 'min-h-0 flex-1 overflow-y-auto p-5'
const footer = 'mt-0 shrink-0 items-center border-t border-line-soft bg-surface px-5 py-4'

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  blurb,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  blurb: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-card border bg-surface py-3.5 pl-3.5 pr-9 text-left text-ink transition-colors',
        selected ? 'border-brand ring-3 ring-brand/15' : 'border-line hover:border-ink-faint',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-line-soft bg-paper">
        {icon}
      </span>
      <span className="block">
        <span className="block text-copy font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-[1.5] text-ink-soft">{blurb}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute right-4 top-1/2 size-4 -translate-y-1/2 rounded-full border',
          selected ? 'border-[5px] border-brand' : 'border-line',
        )}
      />
    </button>
  )
}

/** Live connection status: flips the moment an outside (non-resident) agent
 *  joins this canvas's presence, so nobody is left wondering whether the
 *  OAuth dance actually worked. */
export function AgentArrival({ name }: { name?: string }) {
  const presences = useStore((s) => s.presences)
  const arrived = useMemo(
    () => Object.values(presences).find((p) => p.kind === 'agent' && !roleByAgentName(p.name)),
    [presences],
  )
  return arrived ? (
    <span className="mr-auto inline-flex items-center gap-[7px] text-body text-success-ink">
      ✓ {arrived.name} ist da — es hat geklappt
    </span>
  ) : (
    <span className="mr-auto inline-flex items-center gap-[7px] text-body text-ink-faint">
      <Dot className="animate-[arrival-pulse_1.6s_ease-in-out_infinite] bg-brand" /> Warte auf{' '}
      {name ?? 'Deinen Agenten'}…
    </span>
  )
}
