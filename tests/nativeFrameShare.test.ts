import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

/* Source-wiring checks for the native iOS image file sharing surface.
 * These assert integration requirements that cannot execute on Linux
 * (no Swift/Xcode here); they are explicitly NOT a substitute for
 * Swift core checks or real Share Sheet verification on Apple hardware. */

const read = (path: string) => readFileSync(path, 'utf8')

const core = () => read('ios/Doop/Core/FrameImageExport.swift')
const client = () => read('ios/Doop/DoopClient.swift')
const view = () => read('ios/Doop/FrameImageExportView.swift')
const canvas = () => read('ios/Doop/NativeCanvasView.swift')
const project = () => read('ios/Doop.xcodeproj/project.pbxproj')

it('defines both image formats with exact MIME, extension and download path without scale', () => {
  const source = core()
  expect(source).toContain('image/png')
  expect(source).toContain('image/jpeg')
  expect(source).toContain('?download')
  expect(source).not.toContain('scale=')
  expect(source).toMatch(/timeout.*120|120.*timeout/i)
})

it('sanitizes the local filename and preserves the extension', () => {
  const source = core()
  expect(source).toMatch(/safeFilename|safe.*[Ff]ilename/i)
  expect(source).toContain('Zeichenfläche')
  expect(source).toMatch(/utf8\.count/)
})

it('validates HTTP status, expected MIME and non-empty body with safe German errors', () => {
  const source = core()
  expect(source).toMatch(/200\.\.<300|200\.\.\.300/)
  expect(source).toMatch(/NativeMessages\.api/)
  expect(source).not.toMatch(/localizedDescription|serverMessage.*message/i)
})

it('fetches the image through the existing session with same-server boundary and atomic write', () => {
  const source = client()
  expect(source).toContain('exportImage')
  expect(source).toContain('session.data')
  expect(source).toContain('server.contains')
  expect(source).toMatch(/\.atomic/)
  expect(source).toMatch(/forHTTPHeaderField: "Accept"/)
})

it('shares an explicit file representation, never a remote URL', () => {
  const source = view()
  expect(source).toContain('Transferable')
  expect(source).toContain('FileRepresentation')
  expect(source).toContain('SentTransferredFile')
  expect(source).toContain('ShareLink')
  expect(source).not.toMatch(/ShareLink\(item:.*http|ShareLink\(item:.*url.*http/i)
})

it('uses fixed UTType file representations with per-format applicability', () => {
  const source = view()
  expect(source).toContain('exportedContentType: .png')
  expect(source).toContain('exportedContentType: .jpeg')
  expect(source).toContain('exportingCondition')
  expect(source).not.toContain('exportedContentType: {')
})

it('guards preparation with identity capture, duplicate protection and cancellation', () => {
  const source = view()
  expect(source).toMatch(/\.task\(id:/)
  expect(source).toMatch(/CancellationError|isCancelled/)
  expect(source).toMatch(/vorbereitet|Vorbereiten|Erneut versuchen/)
})

it('keeps the HTML export panel and canvas link sharing intact', () => {
  const source = canvas()
  expect(source).toContain('HTML speichern oder teilen')
  expect(source).toContain('Link zur Arbeitsfläche teilen')
  expect(source).toContain('FrameImageExportView')
})

it('registers new sources and the photo usage description in Debug and Release', () => {
  const pbx = project()
  expect(pbx).toContain('Core/FrameImageExport.swift')
  expect(pbx).toContain('FrameImageExportView.swift')
  expect(pbx.match(/INFOPLIST_KEY_NSPhotoLibraryAddUsageDescription/g)?.length).toBeGreaterThanOrEqual(2)
  expect(pbx).toContain('Speichere Deine exportierten Designs in Deinen Fotos.')
})

it('documents the implemented flow with a pending manual checklist', () => {
  expect(read('docs/prowin/doop-fork-umsetzung.md')).toMatch(/10\.4[\s\S]{0,2000}ShareLink|Share Sheet/)
  expect(read('ios/README.md')).toMatch(/ShareLink|Share Sheet/)
})
