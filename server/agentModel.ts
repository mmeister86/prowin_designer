import { permissionIdentity } from './prowin/accounts.ts'
import { env } from './env.ts'
import { getLocalAgentPreference } from './localAgentPreferences.ts'
import { localAgentRuns, type LocalHarnessRequest } from './localAgentRuns.ts'
import type { LocalAgentResult } from '../shared/localAgent.ts'
import Anthropic from '@anthropic-ai/sdk'
import { ModelAuthError, ModelUnavailableError, runAzureTurn } from './openaiAgent.ts'
import type { StopReason, TurnBlock } from './openaiAgent.ts'
import { requestyConfig, runChatCompletionsTurn } from './chatCompletionsAgent.ts'

/** Server-paid Requesty EU (or explicit legacy server configuration) and
 * Creator/Admin local execution. Private model accounts are not supported. */

export type ServerProvider = 'anthropic' | 'azure' | 'requesty'
export type Provider = ServerProvider | 'claude-local'

export interface AgentTurnRequest {
  /** ordered system blocks; `cache` marks an Anthropic cache breakpoint */
  system: { text: string; cache?: boolean }[]
  tools: Anthropic.Tool[]
  messages: Anthropic.MessageParam[]
  maxTokens: number
}

export interface AgentTurnResult {
  content: TurnBlock[]
  stop_reason: StopReason
}

export interface AgentModel {
  provider: Provider
  /** for logs and the canvas status line, e.g. "Requesty EU (policy/prowin-layout-gen)" */
  label: string
  /** the user whose account pays, when it isn't the server's key */
  userId?: string
  /** false = the model cannot see images and the run degrades to no visual
   *  review; absent means true (every pre-roster provider has vision) */
  vision?: boolean
  runHarness?: (req: LocalHarnessRequest) => Promise<LocalAgentResult>
  run(req: AgentTurnRequest): Promise<AgentTurnResult>
}

export { ModelAuthError, ModelUnavailableError }

/* ---------------------------------------------------------------- */
/* the server tier: pays for everyone's free tasks                  */
/* ---------------------------------------------------------------- */

let anthropic: Anthropic | null = null

function anthropicTier(): AgentModel | null {
  if (!env.ANTHROPIC_API_KEY) {
    warnOnce(
      '[doop-agent] ANTHROPIC_API_KEY not set — the free Doop Agent tier is off. Server work stays queued until the operator configures a provider. See README → "The Doop Agent".',
    )
    return null
  }
  if (!anthropic) anthropic = new Anthropic()
  const client = anthropic
  const model = env.DOOP_AGENT_MODEL
  return {
    provider: 'anthropic',
    label: `Doop (${model})`,
    run: (req) => runAnthropicTurn(client, model, req),
  }
}

/**
 * One Anthropic turn, streamed and collected into a message.
 *
 * Streaming is not for show here: it is what lets a turn run long. The SDK
 * refuses a non-streaming request whose max_tokens implies more than ten
 * minutes of generation ("Streaming is required for operations that may take
 * longer than 10 minutes"), and GitHub recon asks for 32k tokens per turn. A
 * bigger client timeout would silence that check but leave a silent HTTP
 * connection open for the whole generation, which proxies drop. Over SSE the
 * SDK's timeout only guards the wait for headers; the response itself stays
 * alive on the API's ping events until the message is complete.
 */
export async function runAnthropicTurn(
  client: Anthropic,
  model: string,
  req: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const res = await client.messages
    .stream({
      model,
      max_tokens: req.maxTokens,
      system: req.system.map((block) => ({
        type: 'text' as const,
        text: block.text,
        ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
      })),
      tools: req.tools,
      messages: req.messages,
    })
    .finalMessage()
  const stop: StopReason =
    res.stop_reason === 'refusal'
      ? 'refusal'
      : res.stop_reason === 'max_tokens'
        ? 'max_tokens'
        : res.stop_reason === 'tool_use'
          ? 'tool_use'
          : 'end_turn'
  return { content: res.content as TurnBlock[], stop_reason: stop }
}

function azureTier(): AgentModel | null {
  const endpoint = env.AZURE_OPENAI_ENDPOINT
  const deployment = env.AZURE_OPENAI_DEPLOYMENT
  const apiKey = env.AZURE_OPENAI_API_KEY
  if (!endpoint || !deployment || !apiKey) {
    warnOnce(
      '[doop-agent] DOOP_AGENT_PROVIDER=azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_API_KEY — the free Doop Agent tier is off until all three are set.',
    )
    return null
  }
  const config = { endpoint, deployment, apiKey }
  return {
    provider: 'azure',
    label: `Doop (${deployment})`,
    async run(req) {
      try {
        return await runAzureTurn(config, {
          system: joinSystem(req),
          tools: req.tools,
          messages: req.messages,
          maxTokens: req.maxTokens,
        })
      } catch (err) {
        /* these are the SERVER's credentials — "reconnect your account" would
           send users chasing a connection they don't have */
        if (err instanceof ModelAuthError) {
          throw new Error(
            'Azure OpenAI rejected this server’s credentials — check AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT',
            { cause: err },
          )
        }
        throw err
      }
    },
  }
}

function requestyTier(): AgentModel | null {
  const config = requestyConfig(env.DOOP_AGENT_MODEL)
  if (!config) {
    warnOnce('[doop-agent] DOOP_AGENT_PROVIDER=requesty needs REQUESTY_API_KEY — the server tier is off.')
    return null
  }
  return {
    provider: 'requesty',
    label: `Requesty EU (${config.model})`,
    vision: config.vision,
    async run(req) {
      try {
        return await runChatCompletionsTurn(config, {
          system: joinSystem(req),
          tools: req.tools,
          messages: req.messages,
          maxTokens: req.maxTokens,
        })
      } catch (err) {
        /* These are the operator's credentials/policy, never an account the
           requester can reconnect. Fail without switching providers. */
        if (err instanceof ModelAuthError) {
          throw new Error(
            'Requesty EU rejected the server credentials or policy access — check REQUESTY_API_KEY and the Requesty key permissions.',
            { cause: err },
          )
        }
        if (err instanceof ModelUnavailableError) {
          throw new Error(
            'Requesty EU cannot run the configured policy — check DOOP_AGENT_MODEL and its EU fallback models in Requesty.',
            { cause: err },
          )
        }
        throw err
      }
    },
  }
}

const serverTiers: Record<ServerProvider, () => AgentModel | null> = {
  anthropic: anthropicTier,
  azure: azureTier,
  requesty: requestyTier,
}

/* an unknown DOOP_AGENT_PROVIDER fails at boot (server/env.ts) */
function serverProvider(): ServerProvider {
  return env.DOOP_AGENT_PROVIDER
}

/** What the boot banner reports: which provider the free tier would run on,
 *  and whether it actually can. */
export function serverTierInfo(): { provider: ServerProvider; ready: boolean } {
  const provider = serverProvider()
  return { provider, ready: serverTiers[provider]() !== null }
}

const warnedAbout = new Set<string>()
function warnOnce(message: string) {
  if (warnedAbout.has(message)) return
  warnedAbout.add(message)
  console.log(message)
}

/* ---------------------------------------------------------------- */
/* local Creator/Admin harness                                      */
/* ---------------------------------------------------------------- */

/* the OpenAI-shaped transports take one system string; cache breakpoints are
   an Anthropic concept and simply flatten away */
function joinSystem(req: AgentTurnRequest): string {
  return req.system.map((block) => block.text).join('\n\n')
}

/** Select an eligible Creator's local harness, otherwise the configured server. */
export async function pickModel(payerId?: string): Promise<AgentModel | null> {
  if (payerId) {
    const local = await getLocalAgentPreference(payerId)
    if (local.enabled && (await permissionIdentity(payerId)).creator) {
      if (!localAgentRuns.online(payerId)) return null
      return {
        provider: 'claude-local',
        label: `Claude CLI (${local.model})`,
        userId: payerId,
        runHarness: (req) => localAgentRuns.startAuthorized(payerId, local.model, req),
        run: () =>
          Promise.reject(
            new Error('Repository imports require a server provider. Select the server agent in Settings.'),
          ),
      }
    }
  }

  return serverTiers[serverProvider()]()
}
