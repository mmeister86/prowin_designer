import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

/* Source-wiring checks for the native iOS image file sharing surface.
 * These assert integration requirements that cannot execute on Linux
 * (no Swift/Xcode here); they are explicitly NOT a substitute for
 * Swift core checks or real Share Sheet verification on Apple hardware. */

const read = (path: string) => readFileSync(path, 'utf8')

const core = () => read('ios/Doop/Core/FrameImageExport.swift')
const models = () => read('ios/Doop/Core/Models.swift')
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

it('exposes a live frame identity over the rendered and labelled fields', () => {
  const source = core()
  expect(source).toMatch(/identity\(of/)
  expect(source).toContain('html')
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

it('observes the live frame and invalidates pending and prepared files on change or deletion', () => {
  const source = view()
  // Live wiring, not a captured snapshot: the sheet reads the current frame each time.
  expect(source).toMatch(/model\.canvas\?\.frames\.first/)
  expect(source).toMatch(/liveFrame/)
  expect(source).toMatch(/FrameImageExport\.identity/)
  // The request carries the revision it rendered; stale results never publish.
  expect(source).toMatch(/revision/)
  expect(source).toMatch(/identity\(of:.*\) == .*revision|revision.*==.*identity/s)
  // Updates and deletion reset both pending and prepared state with an explanation.
  expect(source).toMatch(/onChange\(of: liveFrame\)/)
  expect(source).toMatch(/gelöscht/)
})

it('keeps the HTML export panel and canvas link sharing intact', () => {
  const source = canvas()
  expect(source).toContain('HTML speichern oder teilen')
  expect(source).toContain('Link zur Arbeitsfläche teilen')
  expect(source).toContain('FrameImageExportView(model:')
  expect(source).toContain('imageFrameID')
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

// Task 3 (revision follow-up): labelled source-wiring checks only. They assert
// the production merge boundary is wired, not native runtime behavior — Swift
// core checks in ios/Tests/FrameImageExportTests.swift remain the behavior proof
// and must run on macOS CI (no Swift toolchain on Linux).

it('[task3-wiring] decodes an optional revision on the frame model', () => {
  const source = models()
  expect(source).toMatch(/updatedAt:\s*Double\?/)
})

it('[task3-wiring] export identity carries an explicit revision/legacy marker', () => {
  const source = core()
  expect(source).toMatch(/updatedAt/)
  expect(source).toMatch(/legacy/i)
})

it('[task3-wiring] common canvas ingress merges newer revisions before the pending-move overlay', () => {
  const model = read('ios/Doop/CanvasModel.swift')
  // Scope to the didSet block only (brace-balanced from its opening brace).
  const start = model.indexOf('var canvas: CanvasDocument?')
  let depth = 0
  let end = model.length
  let opened = false
  for (let i = model.indexOf('{', start); i < model.length; i++) {
    if (model[i] === '{') {
      depth++
      opened = true
    } else if (model[i] === '}') {
      depth--
    }
    if (opened && depth === 0) {
      end = i
      break
    }
  }
  const didSet = model.slice(start, end)
  expect(didSet).toContain('keepingNewerFrameRevisions')
  expect(didSet).toContain('pendingMoves.apply')
  expect(didSet).toContain('pruneSelection()')
  // Same-canvas guard: the merge only runs against the previous same-canvas document.
  const sameCanvas = /if let previous = oldValue,\s*document\.id == previous\.id\s*\{([^{}]*)\}/.exec(didSet)
  expect(sameCanvas?.[1]).toContain(
    'document.frames = keepingNewerFrameRevisions(document.frames, than: previous.frames)',
  )
  // Order inside the observer: merge first, then overlay, then prune — and no
  // early return may skip the overlay or pruning on the revision path.
  const mergeAt = didSet.indexOf('keepingNewerFrameRevisions')
  const overlayAt = didSet.indexOf('pendingMoves.apply')
  const pruneAt = didSet.indexOf('pruneSelection()')
  expect(mergeAt).toBeGreaterThanOrEqual(0)
  expect(overlayAt).toBeGreaterThan(mergeAt)
  expect(pruneAt).toBeGreaterThan(overlayAt)
  expect(didSet).not.toMatch(/^\s*return\b/m)
})

it('[task3-wiring] merge keeps same-canvas frames only and never resurrects deletions', () => {
  const source = core()
  expect(source).toMatch(/keepingNewerFrameRevisions/)
  expect(source).toMatch(/canvasId/)
})

it('[task3-wiring] live export invalidation and both completion guards use the revision-bearing identity', () => {
  const source = view()
  expect(source).toMatch(/onChange\(of: liveFrame\)/)
  const guards = source.match(/identity\(of: live\) == current\.revision/g) ?? []
  expect(guards.length).toBeGreaterThanOrEqual(2)
})
