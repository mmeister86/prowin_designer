import Foundation
import DoopCore

enum FrameImageExportChecks {
    static func run() {
        checkFormats()
        checkPaths()
        checkFilenames()
        checkIdentity()
        checkRevisions()
        checkMerge()
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

    private static func checkRevisions() {
        func decode(_ json: String) -> DesignFrame {
            try! JSONDecoder().decode(DesignFrame.self, from: Data(json.utf8))
        }
        func frame(id: String = "f1", html: String = "<p>a</p>", revision: String = "3") -> DesignFrame {
            // revision fragment: a number, "null", or "" for an absent key.
            let key = revision.isEmpty ? "" : #","updatedAt":\#(revision)"#
            return decode(#"{"id":"\#(id)","canvasId":"c","name":"Hero","x":0,"y":0,"width":390,"height":844,"html":"\#(html)"\#(key)}"#)
        }
        // Numeric, missing and null revisions decode; legacy stays stable.
        precondition(frame(revision: "3").updatedAt == 3)
        precondition(frame(revision: "").updatedAt == nil)
        precondition(frame(revision: "null").updatedAt == nil)
        let legacy = frame(revision: "")
        precondition(legacy == frame(revision: ""))
        precondition(frame(revision: "null") == frame(revision: ""))
        precondition(FrameImageExport.identity(of: legacy) == FrameImageExport.identity(of: frame(revision: "")))
        precondition(FrameImageExport.identity(of: legacy).contains("legacy"))
        // Same content, different revision: equality and identity both change.
        precondition(frame(revision: "1") != frame(revision: "3"))
        precondition(FrameImageExport.identity(of: frame(revision: "1")) != FrameImageExport.identity(of: frame(revision: "3")))
        // A1/B2/A3 identities are pairwise distinct.
        let a1 = frame(id: "a", revision: "1")
        let b2 = frame(id: "b", revision: "2")
        let a3 = frame(id: "a", html: "<p>c</p>", revision: "3")
        precondition(FrameImageExport.identity(of: a1) != FrameImageExport.identity(of: b2))
        precondition(FrameImageExport.identity(of: a1) != FrameImageExport.identity(of: a3))
        precondition(FrameImageExport.identity(of: b2) != FrameImageExport.identity(of: a3))
        // Same revision with changed reveal HTML still differs.
        precondition(frame(html: "<p>a</p>") != frame(html: "<p>b</p>"))
        precondition(FrameImageExport.identity(of: frame(html: "<p>a</p>")) != FrameImageExport.identity(of: frame(html: "<p>b</p>")))
    }

    private static func checkMerge() {
        func decode(_ json: String) -> DesignFrame {
            try! JSONDecoder().decode(DesignFrame.self, from: Data(json.utf8))
        }
        func frame(id: String, canvas: String = "c", html: String = "<p>a</p>", revision: String = "") -> DesignFrame {
            let key = revision.isEmpty ? "" : #","updatedAt":\#(revision)"#
            return decode(#"{"id":"\#(id)","canvasId":"\#(canvas)","name":"Hero","x":0,"y":0,"width":390,"height":844,"html":"\#(html)"\#(key)}"#)
        }
        let a1 = frame(id: "a", revision: "1")
        let a3 = frame(id: "a", html: "<p>c</p>", revision: "3")
        let b2 = frame(id: "b", revision: "2")
        // Newer incoming wins; older incoming is rejected.
        precondition(keepingNewerFrameRevisions([a3], than: [a1]) == [a3])
        precondition(keepingNewerFrameRevisions([a1], than: [a3]) == [a3])
        // Equal revisions pass through so changed reveal HTML is kept.
        let a3changed = frame(id: "a", html: "<p>new</p>", revision: "3")
        precondition(keepingNewerFrameRevisions([a3changed], than: [a3]) == [a3changed])
        // Unknown (legacy) revisions pass through either way.
        precondition(keepingNewerFrameRevisions([frame(id: "a")], than: [a3]) == [frame(id: "a")])
        precondition(keepingNewerFrameRevisions([a3], than: [frame(id: "a")]) == [a3])
        precondition(keepingNewerFrameRevisions([frame(id: "a", html: "<p>x</p>")], than: [frame(id: "a")]) == [frame(id: "a", html: "<p>x</p>")])
        // A3 followed by a delayed A1 keeps A3.
        precondition(keepingNewerFrameRevisions([a1], than: [a3, b2]) == [a3])
        // Same-frame A1 -> B2 -> A3 content cycle: A1 and A3 share identical
        // HTML on the same id but differ by revision; a delayed A1 cannot
        // replace the applied A3.
        let cycleA1 = frame(id: "f", html: "<p>A</p>", revision: "1")
        let cycleB2 = frame(id: "f", html: "<p>B</p>", revision: "2")
        let cycleA3 = frame(id: "f", html: "<p>A</p>", revision: "3")
        precondition(cycleA1.html == cycleA3.html && cycleA1 != cycleA3)
        precondition(FrameImageExport.identity(of: cycleA1) != FrameImageExport.identity(of: cycleA3))
        precondition(keepingNewerFrameRevisions([cycleB2], than: [cycleA1]) == [cycleB2])
        precondition(keepingNewerFrameRevisions([cycleA3], than: [cycleB2]) == [cycleA3])
        precondition(keepingNewerFrameRevisions([cycleA1], than: [cycleA3]) == [cycleA3])
        // Snapshot deletion never resurrects; new ids join; order follows incoming.
        precondition(keepingNewerFrameRevisions([], than: [a3]) == [])
        precondition(keepingNewerFrameRevisions([b2], than: [a3, b2]) == [b2])
        let c1 = frame(id: "c", revision: "1")
        precondition(keepingNewerFrameRevisions([a3, c1], than: [a3]) == [a3, c1])
        precondition(keepingNewerFrameRevisions([c1, a3], than: [a3]) == [c1, a3])
        // Different canvas IDs never mix: incoming wins.
        let foreign = frame(id: "a", canvas: "other", revision: "1")
        precondition(keepingNewerFrameRevisions([foreign], than: [a3]) == [foreign])
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
