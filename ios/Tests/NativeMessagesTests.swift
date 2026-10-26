import Foundation
import DoopCore

enum NativeMessagesChecks {
    static func run() {
        checkHTTPPayloads()
        precondition(NativeMessages.api(status: 401, code: "INVALID_EMAIL_OR_PASSWORD") == "E-Mail-Adresse oder Passwort ist falsch. Prüfe Deine Eingaben.")
        precondition(NativeMessages.api(status: 400, code: "EMAIL_NOT_VERIFIED").contains("bestätige"))
        precondition(NativeMessages.api(status: 400, code: "PASSWORD_TOO_SHORT").contains("8 Zeichen"))
        precondition(NativeMessages.api(status: 400, code: "SESSION_NOT_FRESH").contains("wieder an"))
        precondition(NativeMessages.api(status: 409, code: "resident_limit").contains("Kontingent"))
        precondition(NativeMessages.api(status: 429, code: nil).contains("später"))
        precondition(NativeMessages.api(status: 403, code: "BANNED_USER").contains("gesperrt"))
        precondition(NativeMessages.api(status: 400, code: "account_not_linked").contains("Anmeldemethode"))
        precondition(NativeMessages.api(status: 503, code: "secret provider diagnostics") == NativeMessages.api(status: 503, code: nil))
        precondition(NativeMessages.error(NSError(domain: "foreign", code: 7, userInfo: [NSLocalizedDescriptionKey: "secret diagnostics"])) == "Die Aktion ist fehlgeschlagen. Versuche es erneut.")
        precondition(NativeMessages.error(URLError(.notConnectedToInternet)).contains("Internetverbindung"))
        precondition(NativeMessages.error(URLError(.timedOut)).contains("lange"))
        precondition(NativeMessages.error(NSError(domain: "com.apple.AuthenticationServices.AuthorizationError", code: 1004)).contains("Apple"))
        precondition(NativeMessages.error(APIError(status: 0, message: "Eigene Meldung")) == "Eigene Meldung")
        precondition(CanvasSocket.Failure.sessionExpired.message.contains("erneut an"))
        precondition(CanvasSocket.Failure.messageTooLarge.message.contains("Web-App"))
        print("German native message checks passed.")
    }

    /// Uses original HTTP response bytes, exactly as DoopClient does.
    private static func checkHTTPPayloads() {
        func response(_ json: String, status: Int = 400) -> String {
            NativeMessages.api(status: status, data: Data(json.utf8))
        }
        let expected = "Die Registrierung ist auf E-Mail-Adressen von @prowin.de, @team.example.org beschränkt. Verwende eine E-Mail-Adresse mit einer dieser Domains."
        precondition(response(#"{"message":"Die Registrierung ist auf E-Mail-Adressen von @prowin.de, @team.example.org beschränkt."}"#) == expected)
        precondition(response(#"{"code":"BAD_REQUEST","message":"Sign up is restricted to @prowin.de, @team.example.org email addresses."}"#) == expected)
        precondition(response(#"{"code":"BAD_REQUEST","message":"Die Registrierung ist auf E-Mail-Adressen von @prowin.de, @team.example.org beschränkt."}"#) == expected)
        precondition(response(#"{"message":"Sign up is restricted to @prowin.de, @team.example.org email addresses."}"#) == expected)
        precondition(response(#"{"message":"Sign up is restricted to @EXAMPLE.COM email addresses."}"#).contains("@EXAMPLE.COM"))

        let fallback = "Die Anfrage konnte nicht verarbeitet werden. Prüfe Deine Eingaben und versuche es erneut."
        for json in [
            #"{"message":"secret provider diagnostics"}"#,
            #"{"message":42}"#,
            #"{"message":["@example.com"]}"#,
            #"{"message":"Sign up is restricted to @example.com email addresses. secret diagnostics"}"#,
            #"{"message":"Sign up is restricted to @example.com email addresses.\n"}"#,
            #"{"message":"Die Registrierung ist auf E-Mail-Adressen von @example.com, @bad..com beschränkt."}"#,
            #"{"message":"Sign up is restricted to @example.com, @-bad.com email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com, @bad-.com email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com, @bad_domain.com email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com, https://evil.com email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com,  email addresses."}"#,
            #"{"message":"Sign up is restricted to  email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com,@other.com email addresses."}"#,
            #"{"message":"Sign up is restricted to @example.com, @evil.com\nsecret email addresses."}"#,
            #"{"error":{"message":"Sign up is restricted to @example.com email addresses."}}"#,
            "{}", "[]", "null", "not JSON"
        ] {
            precondition(response(json) == fallback, "Unsafe payload accepted: \(json)")
        }
        for domain in ["@" + String(repeating: "a", count: 64) + ".com",
                       "@" + Array(repeating: String(repeating: "a", count: 63), count: 4).joined(separator: ".") + ".com"] {
            let data = try! JSONSerialization.data(withJSONObject: ["message": "Sign up is restricted to \(domain) email addresses."])
            precondition(NativeMessages.api(status: 400, data: data) == fallback)
        }
        // Stable codes retain precedence, including code over the legacy error field.
        precondition(response(#"{"code":"INVALID_EMAIL","error":"INVALID_PASSWORD","message":"Sign up is restricted to @example.com email addresses."}"#) == "Gib eine gültige E-Mail-Adresse ein.")
        precondition(response(#"{"error":"INVALID_PASSWORD","message":"secret diagnostics"}"#) == "Das Passwort ist falsch. Prüfe Deine Eingabe.")
        precondition(response(#"{"code":"UNKNOWN","error":"INVALID_PASSWORD","message":"Sign up is restricted to @example.com email addresses."}"#) == fallback)
        precondition(response(#"{"message":"Sign up is restricted to @example.com email addresses."}"#, status: 503) == "Der Server ist gerade nicht verfügbar. Versuche es später erneut.")
    }
}
