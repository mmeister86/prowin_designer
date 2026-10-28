export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PROMPT_REFERENCES = 4

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) return 'Das Bild überschreitet die Grenze von 5 MB.'
  const supported = file.type
    ? ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)
    : /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)
  return supported ? null : 'Nicht unterstützter Dateityp. Erlaubt sind PNG, JPG, WebP, GIF und SVG.'
}
