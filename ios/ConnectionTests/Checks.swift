import CoreGraphics
import Foundation

/// Test-only collaborators for the production CanvasModel. The socket and
/// receive/retry loop are real; no live account or server is involved.
@MainActor
final class DoopClient {
    let server: ServerAddress
    let session: URLSession
    /// Test-only delayed PATCH response for moveFrame saves. The handler
    /// suspends until the test releases it, so a snapshot can land mid-save.
    var saveStarted = false
    var releaseSave = false
    var savedFrameJSON: String?

    init(port: Int) {
        server = ServerAddress("https://127.0.0.1:\(port)")!
        session = URLSession(configuration: .ephemeral, delegate: LoopbackTrust(), delegateQueue: nil)
    }

    func request(_ path: String) throws -> URLRequest {
        URLRequest(url: URL(string: path, relativeTo: server.origin)!.absoluteURL)
    }

    func data(_ path: String, method: String, body: [String: Any]? = nil) async throws -> Data {
        if path.hasPrefix("/api/frames/") && method == "PATCH" {
            saveStarted = true
            while !releaseSave {
                try await Task.sleep(nanoseconds: 10_000_000)
            }
            guard let json = savedFrameJSON else { preconditionFailure("Test must set savedFrameJSON before releasing the save") }
            return Data(json.utf8)
        }
        throw URLError(.unsupportedURL)
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        preconditionFailure("Opening a canvas must not issue a redundant REST download")
    }
}

private final class LoopbackTrust: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.host == "127.0.0.1", let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

@MainActor
final class AgentLiveActivities {
    static let shared = AgentLiveActivities()
    func observe(canvas: CanvasDocument?, tasks: [CanvasTask], client: DoopClient) {}
    func endCanvas(id: String, client: DoopClient) async {}
}

@main
struct ConnectionChecks {
    @MainActor static func main() async throws {
        let client = DoopClient(port: Int(CommandLine.arguments[1])!)
        defer { client.session.invalidateAndCancel() }
        let large = CanvasModel(id: "large", client: client)
        large.error = "Keep this unrelated save error"
        large.start()
        try await wait { large.connected }
        precondition(large.canvas!.frames[0].html.utf8.count > 1024 * 1024)
        precondition(large.connectionError == nil && large.error == "Keep this unrelated save error")
        // Cancel and immediately replace a receive; its catch must not alter
        // the replacement's connection status or leave a cancellation banner.
        for _ in 0..<20 {
            large.stop()
            large.start()
            try await wait { large.connected }
            try await Task.sleep(nanoseconds: 20_000_000)
            precondition(large.connected && large.connectionError == nil)
        }
        large.stop()
        try await Task.sleep(nanoseconds: 100_000_000)
        precondition(!large.connected && !large.connecting && large.connectionError == nil)

        let retry = CanvasModel(id: "retry", client: client)
        retry.start()
        try await wait { retry.connectionError != nil }
        try await wait { retry.connected }
        precondition(retry.canvas?.name == "Attempt 2" && retry.connectionError == nil)
        retry.stop()

        let malformed = CanvasModel(id: "malformed", client: client)
        malformed.start()
        try await wait { malformed.connectionError == CanvasSocket.Failure.invalidData.message }
        // A terminated run must release its task so an explicit restart works.
        malformed.connectionError = nil
        malformed.start()
        try await wait { malformed.connectionError == CanvasSocket.Failure.invalidData.message }
        precondition(!malformed.connected && !malformed.connecting)
        malformed.stop()

        let oversized = CanvasModel(id: "oversized", client: client)
        oversized.start()
        try await wait { oversized.connectionError == CanvasSocket.Failure.messageTooLarge.message }
        precondition(!oversized.connected && !oversized.connecting)
        // Wait past the transport retry delay and ask the fixture how many
        // joins it received: the permanent receive error must not reconnect.
        try await Task.sleep(nanoseconds: 2_500_000_000)
        let (attemptData, _) = try await client.session.data(for: client.request("/attempts/oversized"))
        let attempts = try JSONDecoder().decode(Int.self, from: attemptData)
        precondition(attempts == 1 && !oversized.connecting && !oversized.connected)
        oversized.stop()

        let missing = CanvasModel(id: "missing", client: client)
        missing.start()
        try await wait { missing.deleted }
        precondition(missing.connectionError == CanvasSocket.Failure.notFound.message)
        missing.stop()

        try await revisionRepair()
        print("Canvas connection integration checks passed (large init, 20 restarts, retry, invalid data, oversized receive, deleted canvas, revision repair).")
    }

    /// Combined observer regression on the production CanvasModel: while a
    /// moveFrame save for B awaits its response, a snapshot lands with a
    /// stale A (needs revision repair), a newer B at the pre-drop position
    /// (needs the pending overlay) and a deleted C (needs selection pruning).
    /// Then the save succeeds so no task is abandoned.
    @MainActor private static func revisionRepair() async throws {
        let client = DoopClient(port: 1)
        defer { client.session.invalidateAndCancel() }
        let model = CanvasModel(id: "revisions", client: client)
        func frame(_ id: String, _ html: String, _ rev: String, x: Double = 0, y: Double = 0) throws -> DesignFrame {
            let key = rev.isEmpty ? "" : #","updatedAt":\#(rev)"#
            return try JSONDecoder().decode(DesignFrame.self, from: Data(#"{"id":"\#(id)","canvasId":"revisions","name":"F","x":\#(x),"y":\#(y),"width":390,"height":844,"html":"\#(html)"\#(key)}"#.utf8))
        }
        let a3 = try frame("a", "<p>A3</p>", "3")
        let b2 = try frame("b", "<p>B2</p>", "2")
        let c1 = try frame("c", "<p>C</p>", "1")
        model.canvas = CanvasDocument(id: "revisions", name: "R", ownerId: nil, frames: [a3, b2, c1])
        model.selectedID = "c"
        model.selectedElement = SelectedElement(frameID: "c", nodeID: 1, selector: "body",
                                                label: "C", text: "C", rect: .zero, htmlHash: c1.html.hashValue)
        // Start the B move and hold its save response open.
        let move = Task { await model.moveFrame("b", x: 500, y: 600) }
        try await wait { client.saveStarted }
        precondition(model.canvas!.frames.first { $0.id == "b" }?.x == 500)
        // Stale A1 must not replace A3; newer B3 arrives at the pre-drop
        // position and keeps the pending one while accepting new fields;
        // omitted C must drop out and clear the element selection.
        model.canvas = CanvasDocument(id: "revisions", name: "R", ownerId: nil,
                                      frames: [try frame("a", "<p>A1</p>", "1"), try frame("b", "<p>B3</p>", "3", x: 10, y: 10)])
        let repaired = model.canvas!.frames
        precondition(repaired.count == 2)
        let keptA = repaired.first { $0.id == "a" }!
        precondition(keptA.updatedAt == 3 && keptA.html == "<p>A3</p>")
        let keptB = repaired.first { $0.id == "b" }!
        precondition(keptB.x == 500 && keptB.y == 600)
        precondition(keptB.html == "<p>B3</p>" && keptB.updatedAt == 3)
        precondition(!repaired.contains { $0.id == "c" })
        precondition(model.selectedElement == nil)
        // Let the held save succeed; the finished move upserts without error.
        client.savedFrameJSON = #"{"id":"b","canvasId":"revisions","name":"F","x":500,"y":600,"width":390,"height":844,"html":"<p>B3</p>","updatedAt":4}"#
        client.releaseSave = true
        await move.value
        precondition(model.error == nil)
        precondition(model.canvas!.frames.first { $0.id == "b" }?.updatedAt == 4)
    }

    @MainActor private static func wait(_ condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(10)
        while !condition() {
            precondition(Date() < deadline, "Timed out waiting for canvas connection")
            try await Task.sleep(nanoseconds: 10_000_000)
        }
    }
}
