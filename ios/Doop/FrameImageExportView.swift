import CoreTransferable
import SwiftUI
import UniformTypeIdentifiers

/// One prepared image attachment: the actual PNG/JPG bytes as a file, never
/// a remote URL, so share targets receive the design itself.
struct FrameImageFile: Transferable {
    let url: URL
    let format: FrameImageFormat

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .png) { SentTransferredFile($0.url) }
            .exportingCondition { $0.format == .png }
        FileRepresentation(exportedContentType: .jpeg) { SentTransferredFile($0.url) }
            .exportingCondition { $0.format == .jpg }
    }
}

/// Prepare the selected frame once, then share the file on an explicit second
/// tap. Identity is live: the sheet observes the current frame and drops a
/// pending or already-prepared file when that frame changes or is deleted, so
/// a stale preparation never resurfaces and no other frame is shared silently.
/// shortcut: the file lives in tmp until the OS reclaims it; no manual delete
/// so share targets can read lazily after dismissal.
struct FrameImageExportView: View {
    @ObservedObject var model: CanvasModel
    let frameID: String
    @Environment(\.dismiss) private var dismiss
    @State private var format: FrameImageFormat = .png
    @State private var job: Job?
    @State private var fileURL: URL?
    @State private var fileName = ""
    @State private var error: String?

    private struct Job: Equatable {
        let id = UUID()
        let frameID: String
        let name: String
        let format: FrameImageFormat
        let revision: String
    }

    private var liveFrame: DesignFrame? {
        model.canvas?.frames.first { $0.id == frameID }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "square.and.arrow.up").font(.largeTitle)
                if liveFrame == nil {
                    Text("Diese Zeichenfläche wurde gelöscht. Das Bild kann nicht mehr geteilt werden.")
                        .font(.callout).multilineTextAlignment(.center)
                } else {
                    Picker("Format", selection: $format) {
                        Text("PNG").tag(FrameImageFormat.png)
                        Text("JPG").tag(FrameImageFormat.jpg)
                    }.pickerStyle(.segmented).padding(.horizontal, 40)
                        .onChange(of: format) { _ in reset() }
                    if let fileURL {
                        Text(fileName).font(.callout.monospaced()).lineLimit(1).truncationMode(.middle)
                        ShareLink(item: FrameImageFile(url: fileURL, format: format),
                                  preview: SharePreview(fileName, image: Image(systemName: "photo")))
                            .buttonStyle(.borderedProminent)
                    } else if job != nil {
                        ProgressView("Bild wird vorbereitet…")
                    } else {
                        Button("Bild vorbereiten", action: prepare).buttonStyle(.borderedProminent)
                    }
                    if let error {
                        Text(error).font(.callout).foregroundStyle(.red).multilineTextAlignment(.center)
                        Button("Erneut versuchen", action: prepare)
                    }
                }
            }.padding(24)
                .navigationTitle("Bild teilen")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
                .task(id: job) { await runJob() }
                .onChange(of: liveFrame) { _ in reset() }
        }
    }

    private func reset() {
        job = nil
        fileURL = nil
        fileName = ""
        error = nil
    }

    private func prepare() {
        guard let live = liveFrame else { return }
        error = nil
        fileURL = nil
        job = Job(frameID: live.id, name: live.name, format: format, revision: FrameImageExport.identity(of: live))
    }

    private func runJob() async {
        guard let current = job else { return }
        do {
            let url = try await model.client.exportImage(frameID: current.frameID, name: current.name, format: current.format)
            guard !Task.isCancelled, job?.id == current.id,
                  let live = liveFrame, live.id == current.frameID,
                  FrameImageExport.identity(of: live) == current.revision else { return }
            fileURL = url
            fileName = url.lastPathComponent
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled, job?.id == current.id,
                  let live = liveFrame, live.id == current.frameID,
                  FrameImageExport.identity(of: live) == current.revision else { return }
            self.error = NativeMessages.error(error)
            job = nil
        }
    }
}
