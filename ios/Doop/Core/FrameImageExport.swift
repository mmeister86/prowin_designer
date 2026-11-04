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

private extension CharacterSet {
    /// Unreserved characters only, so the frame id can never break the path.
    static let frameImagePath = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
}
