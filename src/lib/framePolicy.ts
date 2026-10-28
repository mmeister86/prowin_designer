/** Apply the policy before any supplied markup, including complete HTML documents. */
export function frameSrcDoc(html: string, origin: string = location.origin): string {
  const instance = new URL(origin)
  if (instance.protocol !== 'http:' && instance.protocol !== 'https:') {
    throw new Error('Frame assets require an HTTP(S) instance origin')
  }
  // 'self' cannot identify the instance inside sandboxed, opaque-origin srcDoc frames.
  const host = instance.origin
  const policy = [
    "default-src 'none'",
    `script-src ${host} 'unsafe-inline'`,
    `style-src ${host} 'unsafe-inline'`,
    `img-src ${host} data: blob:`,
    `font-src ${host} data: blob:`,
    `media-src ${host} data: blob:`,
    `connect-src ${host}`,
    `base-uri ${host}`,
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
  ].join('; ')
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${html}`
}
