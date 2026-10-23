// Keep the MCP call sites inert until server-side analytics is decided in TASK-42.
export function capture(_distinctId: string, _event: string, _properties: Record<string, unknown> = {}) {}

export function captureThrottled(
  _distinctId: string,
  _event: string,
  _properties: Record<string, unknown> = {},
  _windowMs = 30 * 60 * 1000,
) {}
