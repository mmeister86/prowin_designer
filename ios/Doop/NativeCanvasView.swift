import SwiftUI
import UIKit

struct NativeCanvasView: View {
    @StateObject private var model: CanvasModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var sheet: Panel?
    @State private var prompt = ""
    @State private var sending = false
    /// The scope key the person dismissed with the chip's ×; a new selection brings the chip back.
    @State private var dismissedScope: String?
    @State private var exportURL: URL?
    private let summary: CanvasSummary
    private enum Panel: String, Identifiable { case frames, inspector, tasks, comments, export; var id: String { rawValue } }

    init(summary: CanvasSummary, client: DoopClient) {
        self.summary = summary
        _model = StateObject(wrappedValue: CanvasModel(id: summary.id, client: client))
    }

    var body: some View {
        GeometryReader { geometry in
        VStack(spacing: 0) {
            HStack(spacing: 7) {
                Circle().fill(model.connected ? .green : .orange).frame(width: 6, height: 6)
                Text(model.connected ? "Live" : model.connecting ? "Verbindung wird hergestellt…" : "Getrennt")
                Spacer()
                if !model.presences.isEmpty { Label("\(model.presences.count) hier", systemImage: "person.2") }
                Text("\(model.canvas?.frames.count ?? 0) \(model.canvas?.frames.count == 1 ? "Zeichenfläche" : "Zeichenflächen")")
            }.font(.caption).foregroundStyle(.secondary).padding(.horizontal, 18).padding(.vertical, 10)
            if let error = model.error ?? model.connectionError {
                HStack {
                    Text(error).font(.caption)
                    Spacer()
                    Button { if model.error != nil { model.error = nil } else { model.connectionError = nil } } label: { Image(systemName: "xmark") }.accessibilityLabel("Meldung schließen")
                }.padding(12).background(Color.orange.opacity(0.12))
            }
            ZStack(alignment: .bottom) {
                BlitzCanvasSurface(model: model).ignoresSafeArea(.container, edges: .bottom)
                VStack(spacing: 10) {
                    if let element = model.selectedElement {
                        HStack(spacing: 10) {
                            Image(systemName: "scope").foregroundStyle(.tint)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(element.label).font(.callout.monospaced().bold()).lineLimit(1)
                                Text(element.text.isEmpty ? element.selector : element.text).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            Button("Kommentieren") { sheet = .comments }.font(.callout.bold())
                            Button { model.selectedElement = nil } label: { Image(systemName: "xmark") }.accessibilityLabel("Elementauswahl aufheben")
                        }.padding(.horizontal, 16).padding(.vertical, 12).modifier(FloatingGlass())
                    } else if model.inspecting, model.selected != nil {
                        Text("Tippe auf ein Element in der ausgewählten Zeichenfläche").font(.caption).padding(10).modifier(FloatingGlass())
                    }
                    VStack(spacing: 10) {
                        HStack(spacing: 10) {
                            if let scope = promptScope {
                                PromptScopeChip(scope: scope) { dismissedScope = scope.key }
                            } else {
                                Image(systemName: "sparkles").foregroundStyle(.tint)
                            }
                            TextField(promptPlaceholder, text: $prompt, axis: .vertical).lineLimit(1...4)
                                .textFieldStyle(.plain)
                                .accessibilityIdentifier("canvas.prompt")
                            Button(action: sendPrompt) {
                                if sending { ProgressView() } else { Image(systemName: "arrow.up.circle.fill").font(.title) }
                            }.disabled(sending || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !model.connected)
                                .accessibilityLabel("Designaufgabe senden")
                        }.padding(.horizontal, 16).padding(.vertical, 14).modifier(FloatingGlass())
                        GlassDock {
                            GlassDockButton(label: "Zeichenfläche hinzufügen", symbol: "plus", caption: "Hinzufügen") { Task { await model.addFrame() } }
                            GlassDockButton(label: "Arbeitsfläche einpassen", symbol: "arrow.up.left.and.arrow.down.right", caption: "Einpassen") { model.viewportCommand += 1 }
                            GlassDockButton(label: "Zeichenflächen", symbol: "square.3.layers.3d") { sheet = .frames }
                            GlassDockButton(label: "Eigenschaften der Zeichenfläche", symbol: "slider.horizontal.3", caption: "Eigenschaften") { sheet = .inspector }.disabled(model.selected == nil)
                            GlassDockButton(label: "Elemente untersuchen", symbol: "scope", caption: "Untersuchen", selected: model.inspecting) {
                                model.inspecting.toggle()
                                if !model.inspecting { model.selectedElement = nil }
                            }.disabled(model.selected == nil)
                        }
                    }
                }.frame(maxWidth: 620).padding(.horizontal, 16).padding(.top, 10)
                    .offset(y: geometry.safeAreaInsets.bottom < 80 ? max(0, geometry.safeAreaInsets.bottom - 16) : 0)
            }
        }
        .background(CanvasBackSwipeGuard())
        .navigationTitle(model.canvas?.name ?? summary.name).navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button { sheet = .tasks } label: { Label("Agentenaufgaben", systemImage: "sparkles") }
                    Button { sheet = .comments } label: { Label("Kommentare", systemImage: "bubble.left.and.bubble.right") }
                    ShareLink(item: model.client.server.origin.appendingPathComponent("c/\(model.id)")) { Label("Link zur Arbeitsfläche teilen", systemImage: "square.and.arrow.up") }
                    if model.selected != nil { Button("HTML der ausgewählten Zeichenfläche exportieren") { exportFrame() } }
                } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Aktionen der Arbeitsfläche")
            }
        }
        .sheet(item: $sheet) { panel in
            switch panel {
            case .frames: framesPanel
            case .inspector:
                if let frame = model.selected { FrameInspector(model: model, original: frame) }
            case .tasks: TasksPanel(model: model)
            case .comments: CommentsPanel(model: model)
            case .export:
                NavigationStack {
                    VStack(spacing: 24) {
                        Image(systemName: "doc.text").font(.largeTitle)
                        if let exportURL { ShareLink("HTML speichern oder teilen", item: exportURL).buttonStyle(.borderedProminent) }
                    }.navigationTitle("Zeichenfläche exportieren").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { sheet = nil } } }
                }
            }
        }
        .onAppear { if scenePhase == .active { model.start() } }
        .onDisappear { model.stop() }
        .onChange(of: scenePhase) { phase in if phase == .active { model.start() } else if phase == .background { model.stop() } }
        .onChange(of: model.deleted) { deleted in if deleted { dismiss() } }
    }
    }

    /// The selection scopes the prompt, as on the web, until the chip is dismissed.
    private var promptScope: PromptScope? {
        guard let scope = model.promptScope, scope.key != dismissedScope else { return nil }
        return scope
    }

    private var promptPlaceholder: String {
        guard let scope = promptScope else { return "Bitte Deinen Agenten um ein Design…" }
        return scope.isElement ? "Bitte Deinen Agenten, dieses Element zu ändern…" : "Bitte Deinen Agenten, diese Zeichenfläche zu ändern…"
    }

    private func sendPrompt() {
        let value = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        sending = true
        let scope = promptScope?.scope
        Task {
            do { try await model.queue(value, scope: scope); prompt = ""; sheet = .tasks }
            catch { model.error = NativeMessages.error(error) }
            sending = false
        }
    }
    private var framesPanel: some View {
        NavigationStack {
            List(model.canvas?.frames ?? []) { frame in
                Button {
                    model.select(frame.id)
                    sheet = nil
                } label: {
                    HStack {
                        Image(systemName: "rectangle")
                        VStack(alignment: .leading) { Text(frame.name); Text("\(Int(frame.width)) × \(Int(frame.height))").font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        if model.selectedID == frame.id { Image(systemName: "checkmark") }
                    }.padding(.vertical, 5)
                }
            }.navigationTitle("Zeichenflächen")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { sheet = nil } } }
        }
    }
    private func exportFrame() {
        guard let frame = model.selected else { return }
        do {
            let destination = try ExportDirectory().destination(suggestedFilename: frame.name + ".html")
            try Data(frame.html.utf8).write(to: destination, options: .atomic)
            exportURL = destination
            sheet = .export
        } catch { model.error = NativeMessages.error(error) }
    }
}

/// The prompt bar's scope: the selected frame's name, or the picked element's
/// `tag#id.class`, with an × that asks without it.
private struct PromptScopeChip: View {
    let scope: PromptScope
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: scope.isElement ? "scope" : "rectangle").font(.caption)
            Text(scope.label).font(.caption.monospaced().bold()).lineLimit(1).truncationMode(.tail)
            Button(action: dismiss) { Image(systemName: "xmark").font(.caption2.bold()) }
                .accessibilityLabel(scope.isElement ? "Elementbezug entfernen" : "Zeichenflächenbezug entfernen")
        }
        .foregroundStyle(.tint)
        .padding(.leading, 8).padding(.trailing, 6).padding(.vertical, 5)
        .background(Color.accentColor.opacity(0.12), in: Capsule())
        .frame(maxWidth: 150, alignment: .leading)
        .fixedSize(horizontal: true, vertical: false)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(scope.isElement ? "Bezogen auf \(scope.label) in \(scope.frameName)" : "Bezogen auf die Zeichenfläche \(scope.label)")
    }
}

private struct FrameInspector: View {
    @ObservedObject var model: CanvasModel
    let original: DesignFrame
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var width = 390.0
    @State private var height = 844.0
    @State private var html = ""
    @State private var error: String?
    @State private var saving = false
    @State private var deleting = false
    var body: some View {
        NavigationStack {
            Form {
                Section("Zeichenfläche") {
                    TextField("Name", text: $name)
                    HStack { Text("Breite"); Spacer(); TextField("Breite", value: $width, format: .number.locale(Locale(identifier: "de_DE"))).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                    HStack { Text("Höhe"); Spacer(); TextField("Höhe", value: $height, format: .number.locale(Locale(identifier: "de_DE"))).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                }
                Section("HTML") {
                    TextEditor(text: $html).font(.system(.caption, design: .monospaced)).frame(minHeight: 280)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityLabel("HTML der Zeichenfläche")
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
                Section { Button("Zeichenfläche löschen", role: .destructive) { deleting = true } }
            }
            .navigationTitle("Eigenschaften der Zeichenfläche").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(saving ? "Wird gespeichert…" : "Speichern", action: save).disabled(saving) }
            }
            .onAppear { name = original.name; width = original.width; height = original.height; html = original.html }
            .confirmationDialog("Diese Zeichenfläche löschen?", isPresented: $deleting, titleVisibility: .visible) {
                Button("Löschen", role: .destructive) { Task { do { try await model.deleteFrame(original.id); dismiss() } catch { self.error = NativeMessages.error(error) } } }
            }
        }
    }
    private func save() {
        guard width.isFinite, height.isFinite, (1...10000).contains(width), (1...10000).contains(height), !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "Gib einen Namen und Maße zwischen 1 und 10.000 ein."; return
        }
        guard let current = model.canvas?.frames.first(where: { $0.id == original.id }) else { error = "Diese Zeichenfläche wurde gelöscht."; return }
        var patch: [String: Any] = [:]
        if name != original.name { patch["name"] = name }
        if width != original.width { patch["width"] = width }
        if height != original.height { patch["height"] = height }
        if html != original.html {
            guard current.html == original.html else { error = "Diese Zeichenfläche wurde von einem anderen Mitglied bearbeitet. Schließe und öffne die Eigenschaften erneut, bevor Du ihr HTML änderst."; return }
            patch["html"] = html
        }
        saving = true
        Task { do { if !patch.isEmpty { try await model.patchFrame(original.id, patch: patch) }; dismiss() } catch { self.error = NativeMessages.error(error) }; saving = false }
    }
}

private struct TasksPanel: View {
    @ObservedObject var model: CanvasModel
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                if model.tasks.isEmpty { Text("Bitte Deinen Agenten, etwas zu gestalten. Hier erscheinen Aufgaben, während das Team arbeitet.").foregroundStyle(.secondary) }
                ForEach(model.tasks.sorted { $0.startedAt > $1.startedAt }) { task in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: task.failedAt != nil ? "exclamationmark.circle" : task.endedAt != nil ? "checkmark.circle" : "sparkles").foregroundStyle(task.failedAt != nil ? .orange : .blue)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(task.status).font(.body)
                            Text(task.agentName.isEmpty ? "Wartet auf einen Agenten" : task.agentName).font(.caption).foregroundStyle(.secondary)
                            if let reason = task.failureReason { Text(reason).font(.caption).foregroundStyle(.orange) }
                        }
                    }.padding(.vertical, 8)
                }
            }.navigationTitle("Agentenaufgaben").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
        }
    }
}

private struct CommentsPanel: View {
    @ObservedObject var model: CanvasModel
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var sending = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            List {
                Section(model.selectedElement.map { "Kommentar zu \($0.label)" } ?? "Kommentar zur Zeichenfläche hinzufügen") {
                    if let element = model.selectedElement, !element.text.isEmpty {
                        Text(element.text).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    }
                    Picker("Zeichenfläche", selection: $model.selectedID) {
                        Text("Zeichenfläche auswählen").tag(String?.none)
                        ForEach(model.canvas?.frames ?? []) { Text($0.name).tag(Optional($0.id)) }
                    }
                    TextField("Feedback hinterlassen…", text: $text, axis: .vertical).lineLimit(2...5)
                    Button("Kommentar senden") {
                        guard let id = model.selectedID else { return }
                        sending = true
                        Task { do { try await model.comment(text, frameID: id); text = "" } catch { self.error = NativeMessages.error(error) }; sending = false }
                    }.disabled(sending || model.selectedID == nil || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if let error { Text(error).foregroundStyle(.red) }
                }
                Section("Unterhaltung") {
                    if model.comments.isEmpty { Text("Noch keine Kommentare.").foregroundStyle(.secondary) }
                    ForEach(model.comments.sorted { $0.at > $1.at }) { comment in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(comment.from).font(.subheadline.bold()); Spacer(); if comment.resolvedAt != nil { Image(systemName: "checkmark.circle").foregroundStyle(.green) } }
                            Text(comment.text)
                            Text(model.canvas?.frames.first(where: { $0.id == comment.frameId })?.name ?? "Zeichenfläche").font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical, 6)
                    }
                }
            }.navigationTitle("Kommentare").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
        }
    }
}


/// Canvas panning must not trigger UINavigationController's edge-swipe navigation.
private struct CanvasBackSwipeGuard: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Controller { Controller() }
    func updateUIViewController(_ controller: Controller, context: Context) {}
    static func dismantleUIViewController(_ controller: Controller, coordinator: ()) {
        controller.restoreGesture()
    }

    final class Controller: UIViewController {
        private var gestures: [(UIGestureRecognizer, Bool)] = []

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard let navigationController, gestures.isEmpty else { return }
            var backGestures = [navigationController.interactivePopGestureRecognizer].compactMap { $0 }
            #if compiler(>=6.2) // iOS 26 SDK; CI still builds with Xcode 16
            if #available(iOS 26.0, *), let contentSwipe = navigationController.interactiveContentPopGestureRecognizer {
                backGestures.append(contentSwipe)
            }
            #endif
            gestures = backGestures.map { ($0, $0.isEnabled) }
            for (gesture, _) in gestures { gesture.isEnabled = false }
        }

        override func viewWillDisappear(_ animated: Bool) {
            restoreGesture()
            super.viewWillDisappear(animated)
        }

        func restoreGesture() {
            for (gesture, enabled) in gestures { gesture.isEnabled = enabled }
            gestures.removeAll()
        }
    }
}
