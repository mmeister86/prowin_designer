// Loaded only by the integration server. Keep its real resident/actions/render
// loop; replace the paid upstream boundary with deterministic EU responses.
import { installAiEgress } from './ai-egress.mjs'
import process from 'node:process'
import { writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const originalFetch = globalThis.fetch
const routerFetch = async (url, init) => {
  if (url !== 'https://router.eu.requesty.ai/v1/chat/completions') return originalFetch(url, init)
  const body = JSON.parse(init.body)
  if (init.headers.Authorization !== 'Bearer requesty-integration-key') {
    throw new Error('Incorrect Requesty credentials or policy')
  }
  for (const [title, status] of [
    ['Credential failure test', 401],
    ['Policy failure test', 404],
  ]) {
    if (body.messages.some((message) => typeof message.content === 'string' && message.content.includes(title))) {
      return globalThis.Response.json(
        {
          error: {
            code: status === 404 ? 'model_not_found' : 'invalid_api_key',
            message: 'Internal operator diagnostic must stay private',
          },
        },
        { status },
      )
    }
  }
  if (
    body.messages.some(
      (message) => typeof message.content === 'string' && message.content.includes('Budget failure test'),
    )
  ) {
    return globalThis.Response.json(
      { error: { origin: 'router', message: 'Monthly spend limit exceeded' } },
      { status: 402 },
    )
  }
  const result = (message, finish_reason = 'tool_calls') =>
    globalThis.Response.json({
      model: 'bedrock/claude-sonnet-5-5@eu-central-1',
      choices: [{ finish_reason, message }],
    })
  const call = (name, input, id = `call-${name}`) =>
    result({
      content: null,
      tool_calls: [
        {
          id,
          type: 'function',
          function: { name, arguments: JSON.stringify(input) },
        },
      ],
    })
  if (body.model === 'policy/prowin-text-gen') {
    if (body.max_tokens === 100 && !body.tools?.length) {
      return result({ content: 'Prefer blue accents' }, 'stop')
    }
    if (body.max_tokens !== 1000 || body.tool_choice?.function?.name !== 'distill_result') {
      throw new Error('Distiller did not request its forced result tool')
    }
    return call('distill_result', { has_rule: true, guide_name: 'brand-notes', rule: '- Use blue accents' })
  }
  if (body.model !== 'policy/prowin-layout-gen') throw new Error('Incorrect Requesty layout policy')
  const tools = body.messages.filter((message) => message.role === 'tool')
  // Only this fixture marker opts into reference reading. Shared consumers
  // without it keep the existing create -> screenshot -> decision flow.
  const kickoff = body.messages.find(
    (message) => typeof message.content === 'string' && message.content.includes('Requesty reference fixture'),
  )?.content
  const referenceId = kickoff?.match(/id=([^,\s]+), name="Requesty reference fixture"/)?.[1]
  if (referenceId) {
    const sourceIndex = body.messages.findIndex(
      (message) => message.role === 'tool' && message.tool_call_id === 'call-reference-screenshot',
    )
    if (sourceIndex < 0) return call('screenshot_frame', { frame_id: referenceId }, 'call-reference-screenshot')
    const following = body.messages[sourceIndex + 1]
    const image =
      following?.role === 'user' && Array.isArray(following.content)
        ? following.content.find((part) => part.type === 'image_url')
        : undefined
    const encoded = image?.image_url.url.match(/^data:image\/png;base64,(.+)$/)?.[1]
    if (!encoded) throw new Error('Reference screenshot did not reach Requesty immediately after its tool result')
    if (!process.env.PROWIN_TEST_REFERENCE_SCREENSHOT) throw new Error('Missing reference screenshot capture path')
    writeFileSync(process.env.PROWIN_TEST_REFERENCE_SCREENSHOT, Buffer.from(encoded, 'base64'))
  }
  if (!tools.some((message) => message.tool_call_id === 'call-create_frame'))
    return call('create_frame', {
      name: 'Requesty integration frame',
      width: 320,
      height: 180,
      html: '<!DOCTYPE html><html><body style="margin:0;background:#fff">EU integration</body></html>',
    })
  const created = tools.find((message) => message.tool_call_id === 'call-create_frame')
  const frameId = created?.content.match(/created frame (\S+)/)?.[1]
  if (!frameId) throw new Error('Resident did not create the requested frame')
  const resultScreenshotId = referenceId ? 'call-result-screenshot' : 'call-screenshot_frame'
  if (!tools.some((message) => message.tool_call_id === resultScreenshotId)) {
    return call('screenshot_frame', { frame_id: frameId }, resultScreenshotId)
  }
  const resultIndex = body.messages.findIndex(
    (message) => message.role === 'tool' && message.tool_call_id === resultScreenshotId,
  )
  const followingResult = body.messages[resultIndex + 1]
  const resultImages =
    followingResult?.role === 'user' && Array.isArray(followingResult.content) ? followingResult.content : []
  if (
    !resultImages.some((part) => part.type === 'image_url' && part.image_url.url.startsWith('data:image/png;base64,'))
  ) {
    throw new Error('Resident screenshot did not reach Requesty as an image')
  }
  if (!tools.some((message) => message.tool_call_id === 'call-save_decision')) {
    return call('save_decision', { decision: 'Always use blue accents' })
  }
  return result({ content: 'Frame created and visually reviewed.' }, 'stop')
}

// The queue-admission fixture also uses this router, without an Egress journal.
globalThis.fetch = process.env.PROWIN_TEST_EGRESS_JOURNAL
  ? installAiEgress(routerFetch, process.env.PROWIN_TEST_EGRESS_JOURNAL)
  : routerFetch
