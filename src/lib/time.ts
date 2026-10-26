export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 5) return 'gerade eben'
  if (s < 60) return `vor ${s} Sek.`
  const m = Math.floor(s / 60)
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const days = Math.floor(h / 24)
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
}
