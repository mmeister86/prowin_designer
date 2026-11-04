import Foundation

/// Image attachment contract for native file sharing: both export formats
/// with exact MIME/extension, the encoded download path without forced
/// scale, bounded local filenames and safe response validation.
/// No SwiftUI here so the DoopCore checks can cover it without Apple UI.
public enum FrameImageFormat: String, CaseIterable {
    case png
    case jpg

    public var fileExtension: String { rawValue }
    public var mimeType: String { self == .png ? "image/png" : "image/jpeg" }
    public var label: String { self == .png ? "PNG" : "JPG" }
}

public enum FrameImageExport {
    /// Server renders can take seconds; a request still open after this is stuck.
    public static let requestTimeout: TimeInterval = 120

    /// What the export sheet watches: the rendered bytes and the label both
    /// come from these fields, so any change here invalidates a pending or
    /// already-prepared file. The id pins the sheet to its frame. The trailing
    /// marker carries the server revision so revision-only updates invalidate
    /// too; payloads without a revision fall back to the legacy marker and
    /// keep content-only protection.
    public static func identity(of frame: DesignFrame) -> String {
        "\(frame.id)|\(frame.name)|\(frame.width)|\(frame.height)|\(frame.html)|\(frame.updatedAt.map(String.init) ?? "legacy")"
    }

    /// Encoded frame-id path component, no forced scale: the server resolves
    /// the preset default for downloads on its own.
    public static func path(frameID: String, format: FrameImageFormat) -> String {
        let encoded = frameID.addingPercentEncoding(withAllowedCharacters: .frameImagePath) ?? frameID
        return "/i/\(encoded).\(format.fileExtension)?download"
    }

    /// Local filename derived from the captured frame name. Path segments,
    /// control characters and trailing dots go, overlong basenames are cut
    /// with the extension intact, an empty rest falls back to the placeholder.
    public static func safeFilename(name: String, format: FrameImageFormat) -> String {
        var base = name.split(separator: "/").last.map(String.init) ?? ""
        base = base.split(separator: "\\").last.map(String.init) ?? base
        base = base.components(separatedBy: .controlCharacters).joined()
        base = base.trimmingCharacters(in: .whitespacesAndNewlines)
        while base.hasSuffix(".") { base.removeLast() }
        if let ext = base.split(separator: ".").last,
           ["png", "jpg", "jpeg"].contains(ext.lowercased()), base.contains(".") {
            base = base.dropLast(ext.count + 1).trimmingCharacters(in: .whitespacesAndNewlines)
            while base.hasSuffix(".") { base.removeLast() }
        }
        if base.isEmpty || base == "." || base == ".." { base = "Zeichenfläche" }
        if base.count > 80 { base = String(base.prefix(80)).trimmingCharacters(in: .whitespacesAndNewlines) }
        if base.isEmpty { base = "Zeichenfläche" }
        // Filesystem components top out at 255 bytes: cap the UTF-8 encoded
        // basename as well (emoji and combined marks cost several bytes per
        // character), dropping whole grapheme clusters so Unicode stays valid.
        while base.utf8.count > 200 { base = String(base.dropLast()) }
        base = base.trimmingCharacters(in: .whitespacesAndNewlines)
        while base.hasSuffix(".") { base.removeLast() }
        if base.isEmpty { base = "Zeichenfläche" }
        return "\(base).\(format.fileExtension)"
    }

    /// Known server export errors map through the shared German boundary;
    /// arbitrary server text never reaches the UI.
    public static func failureMessage(status: Int, data: Data) -> String {
        NativeMessages.api(status: status, data: data)
    }

    /// Reject wrong MIME, error statuses and empty bodies before anything is
    /// written to disk, so no HTML/JSON error ever lands in a .png/.jpg file.
    public static func validatedImage(data: Data, response: HTTPURLResponse, format: FrameImageFormat) throws -> Data {
        guard (200..<300).contains(response.statusCode) else {
            throw APIError(status: response.statusCode, message: failureMessage(status: response.statusCode, data: data))
        }
        let mime = (response.value(forHTTPHeaderField: "Content-Type") ?? "").split(separator: ";").first
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() } ?? ""
        guard mime == format.mimeType else {
            throw APIError(status: 0, message: "Das \(format.label) konnte nicht gelesen werden. Versuche es erneut.")
        }
        guard !data.isEmpty else {
            throw APIError(status: 0, message: "Das \(format.label) ist leer. Versuche es erneut.")
        }
        return data
    }
}

/// Monotonic ingress for full-frame snapshots (init/reconnect): the incoming
/// snapshot stays authoritative for membership, but a frame present in both
/// states keeps the current entry only when both revisions are known and the
/// current one is newer. Equal revisions pass through so changed reveal HTML
/// under an unchanged version is never rejected; unknown (legacy) revisions
/// pass through; deletions never resurrect; order follows the incoming
/// snapshot. Canvas mismatches are left to the caller.
/// shortcut: legacy payloads without updatedAt keep content-only protection; closing the export-request/response version gap needs a separate protocol change.
public func keepingNewerFrameRevisions(_ incoming: [DesignFrame], than current: [DesignFrame]) -> [DesignFrame] {
    guard !current.isEmpty else { return incoming }
    let known = Dictionary(uniqueKeysWithValues: current.map { ($0.id, $0) })
    return incoming.map { next in
        guard let prev = known[next.id], prev.canvasId == next.canvasId,
              let old = prev.updatedAt, let fresh = next.updatedAt,
              old > fresh else { return next }
        return prev
    }
}

private extension CharacterSet {
    /// Unreserved characters only, so the frame id can never break the path.
    static let frameImagePath = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
}
