// Loaded only by the integration server. Keep its real resident/actions/render
// loop; replace the paid upstream boundary with deterministic EU responses.
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (url !== 'https://router.eu.requesty.ai/v1/chat/completions') return originalFetch(url, init)
  const body = JSON.parse(init.body)
  if (init.headers.Authorization !== 'Bearer requesty-integration-key' || body.model !== 'policy/prowin-layout-gen') {
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
  const call = (name, input) =>
    result({
      content: null,
      tool_calls: [
        {
          id: `call-${name}`,
          type: 'function',
          function: { name, arguments: JSON.stringify(input) },
        },
      ],
    })
  const tools = body.messages.filter((message) => message.role === 'tool')
  if (!tools.length)
    return call('create_frame', {
      name: 'Requesty integration frame',
      width: 320,
      height: 180,
      html: '<!DOCTYPE html><html><body style="margin:0;background:#fff">EU integration</body></html>',
    })
  const created = tools.find((message) => message.tool_call_id === 'call-create_frame')
  const frameId = created?.content.match(/created frame (\S+)/)?.[1]
  if (!frameId) throw new Error('Resident did not create the requested frame')
  if (!tools.some((message) => message.tool_call_id === 'call-screenshot_frame')) {
    return call('screenshot_frame', { frame_id: frameId })
  }
  const images = body.messages.flatMap((message) => (Array.isArray(message.content) ? message.content : []))
  if (!images.some((part) => part.type === 'image_url' && part.image_url.url.startsWith('data:image/png;base64,'))) {
    throw new Error('Resident screenshot did not reach Requesty as an image')
  }
  return result({ content: 'Frame created and visually reviewed.' }, 'stop')
}
