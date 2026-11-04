import Foundation
import DoopCore

enum FrameImageExportChecks {
    static func run() {
        checkFormats()
        checkPaths()
        checkFilenames()
        checkIdentity()
        checkValidation()
        print("Frame image export checks passed.")
    }

    private static func checkFormats() {
        precondition(FrameImageFormat.png.mimeType == "image/png")
        precondition(FrameImageFormat.jpg.mimeType == "image/jpeg")
        precondition(FrameImageFormat.png.fileExtension == "png")
        precondition(FrameImageFormat.jpg.fileExtension == "jpg")
        precondition(FrameImageFormat.png.label == "PNG")
        precondition(FrameImageFormat.jpg.label == "JPG")
    }

    private static func checkPaths() {
        precondition(FrameImageExport.path(frameID: "abc123", format: .png) == "/i/abc123.png?download")
        precondition(FrameImageExport.path(frameID: "abc123", format: .jpg) == "/i/abc123.jpg?download")
        let path = FrameImageExport.path(frameID: "abc123", format: .png)
        precondition(!path.contains("scale="), "Downloads must not force a scale")
        precondition(FrameImageExport.requestTimeout == 120)
        // The frame id is a single encoded path component.
        let tricky = FrameImageExport.path(frameID: "a/b c?d#e", format: .jpg)
        precondition(tricky == "/i/a%2Fb%20c%3Fd%23e.jpg?download", tricky)
    }

    private static func checkFilenames() {
        precondition(FrameImageExport.safeFilename(name: "Hero", format: .png) == "Hero.png")
        precondition(FrameImageExport.safeFilename(name: "Hero", format: .jpg) == "Hero.jpg")
        // Traversal and controls go, the extension survives.
        precondition(FrameImageExport.safeFilename(name: "../../design", format: .png) == "design.png")
        precondition(FrameImageExport.safeFilename(name: "a\\b", format: .jpg) == "b.jpg")
        precondition(FrameImageExport.safeFilename(name: "he\u{07}ro...", format: .png) == "hero.png")
        precondition(FrameImageExport.safeFilename(name: "Hero.PNG", format: .png) == "Hero.png")
        precondition(FrameImageExport.safeFilename(name: "Hero.jpeg", format: .jpg) == "Hero.jpg")
        for name in ["", "   ", ".", "..", "\n"] {
            precondition(FrameImageExport.safeFilename(name: name, format: .png) == "Zeichenfläche.png", name)
        }
        let long = String(repeating: "a", count: 200)
        let cut = FrameImageExport.safeFilename(name: long, format: .jpg)
        precondition(cut == String(repeating: "a", count: 80) + ".jpg", cut)
        let longSpaced = String(repeating: "a", count: 79) + "   b"
        precondition(FrameImageExport.safeFilename(name: longSpaced, format: .png).hasSuffix(".png"))
        // Filesystem components top out at 255 bytes: multibyte names must
        // fit in UTF-8 bytes, keep the extension and stay valid Unicode.
        let emoji = String(repeating: "🙂", count: 80)
        let emojiName = FrameImageExport.safeFilename(name: emoji, format: .png)
        precondition(emojiName.hasSuffix(".png"), emojiName)
        precondition(emojiName.utf8.count <= 255, "\(emojiName.utf8.count)")
        precondition(emojiName.dropLast(4).utf8.count <= 200, emojiName)
        let combined = String(repeating: "e\u{0301}🇩🇪", count: 40)
        let combinedName = FrameImageExport.safeFilename(name: combined, format: .jpg)
        precondition(combinedName.hasSuffix(".jpg"), combinedName)
        precondition(combinedName.utf8.count <= 255, "\(combinedName.utf8.count)")
        // Truncation drops whole grapheme clusters: never a dangling mark.
        precondition(combinedName.dropLast(4).last != "\u{0301}", combinedName)
    }

    private static func checkIdentity() {
        func frame(id: String = "f1", name: String = "Hero", width: Double = 390,
                   height: Double = 844, html: String = "<p>a</p>") -> DesignFrame {
            let json = #"{"id":"\#(id)","canvasId":"c","name":"\#(name)","x":0,"y":0,"width":\#(width),"height":\#(height),"html":"\#(html)"}"#
            return try! JSONDecoder().decode(DesignFrame.self, from: Data(json.utf8))
        }
        let original = frame()
        precondition(FrameImageExport.identity(of: original) == FrameImageExport.identity(of: frame()))
        // Position alone does not relabel or re-render the bytes.
        var moved = original
        moved.x = 50
        moved.y = 60
        precondition(FrameImageExport.identity(of: moved) == FrameImageExport.identity(of: original))
        precondition(FrameImageExport.identity(of: frame(name: "Other")) != FrameImageExport.identity(of: original))
        precondition(FrameImageExport.identity(of: frame(width: 400)) != FrameImageExport.identity(of: original))
        precondition(FrameImageExport.identity(of: frame(html: "<p>b</p>")) != FrameImageExport.identity(of: original))
        precondition(FrameImageExport.identity(of: frame(id: "f2")) != FrameImageExport.identity(of: original))
    }

    private static func checkValidation() {
        func response(status: Int, mime: String?) -> HTTPURLResponse {
            HTTPURLResponse(url: URL(string: "https://doop.design/i/f.png?download")!,
                            statusCode: status, httpVersion: nil,
                            headerFields: mime.map { ["Content-Type": $0] })!
        }
        // Happy path for both formats, parameters on the MIME are fine.
        let png = try! FrameImageExport.validatedImage(data: Data([1, 2, 3]),
                                                       response: response(status: 200, mime: "image/png"), format: .png)
        precondition(png.count == 3)
        let jpg = try! FrameImageExport.validatedImage(data: Data([1]),
                                                       response: response(status: 200, mime: "image/jpeg; charset=binary"), format: .jpg)
        precondition(jpg.count == 1)
        // Known server errors map safely through the shared boundary.
        do {
            _ = try FrameImageExport.validatedImage(data: Data("{}".utf8),
                                                    response: response(status: 500, mime: "application/json"), format: .png)
            preconditionFailure("HTTP 500 must throw")
        } catch let error as APIError {
            precondition(error.message == NativeMessages.api(status: 500, code: nil), error.message)
        } catch { preconditionFailure("Wrong error type") }
        do {
            _ = try FrameImageExport.validatedImage(data: Data("{}".utf8),
                                                    response: response(status: 429, mime: "application/json"), format: .jpg)
            preconditionFailure("HTTP 429 must throw")
        } catch let error as APIError {
            precondition(error.message.contains("Später") || error.message.contains("später"), error.message)
        } catch { preconditionFailure("Wrong error type") }
        // Arbitrary server text never leaks into the message.
        do {
            _ = try FrameImageExport.validatedImage(data: Data(#"{"message":"secret diagnostics"}"#.utf8),
                                                    response: response(status: 400, mime: "application/json"), format: .png)
            preconditionFailure("HTTP 400 must throw")
        } catch let error as APIError {
            precondition(!error.message.contains("secret diagnostics"), error.message)
        } catch { preconditionFailure("Wrong error type") }
        // Wrong MIME and empty bodies are rejected, never written as images.
        assertThrowsMismatch(mime: "text/html", format: .png)
        assertThrowsMismatch(mime: "image/jpeg", format: .png)
        assertThrowsMismatch(mime: nil, format: .jpg)
        do {
            _ = try FrameImageExport.validatedImage(data: Data(),
                                                    response: response(status: 200, mime: "image/png"), format: .png)
            preconditionFailure("Empty body must throw")
        } catch let error as APIError {
            precondition(error.message.contains("leer"), error.message)
        } catch { preconditionFailure("Wrong error type") }
    }

    private static func assertThrowsMismatch(mime: String?, format: FrameImageFormat) {
        do {
            _ = try FrameImageExport.validatedImage(
                data: Data([1]),
                response: HTTPURLResponse(url: URL(string: "https://doop.design/i/f.png?download")!,
                                          statusCode: 200, httpVersion: nil,
                                          headerFields: mime.map { ["Content-Type": $0] })!,
                format: format)
            preconditionFailure("MIME \(mime ?? "nil") must throw for \(format)")
        } catch let error as APIError {
            precondition(error.message.contains(format.label), error.message)
        } catch { preconditionFailure("Wrong error type") }
    }
}
