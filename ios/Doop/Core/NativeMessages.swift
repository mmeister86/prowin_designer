import Foundation

/// Only app-authored messages enter this error. Remote diagnostics are mapped
/// by stable codes/status or a validated own signup message in `api`.
public struct APIError: LocalizedError {
    public let status: Int
    public let message: String
    public var errorDescription: String? { message }

    public init(status: Int, message: String) {
        self.status = status
        self.message = message
    }
}

public enum NativeMessages {
    /// Shared HTTP error boundary: callers pass the original response bytes.
    public static func api(status: Int, data: Data) -> String {
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let code = payload?["code"] as? String ?? payload?["error"] as? String
        // This own validation has no dedicated code. Keep all specific code
        // handling intact; only the signup's plain/generic HTTP 400 qualifies.
        if status == 400, code == nil || code == "BAD_REQUEST",
           let message = payload?["message"] as? String,
           let domains = signupDomains(in: message) {
            return "Die Registrierung ist auf E-Mail-Adressen von \(domains) beschränkt. Verwende eine E-Mail-Adresse mit einer dieser Domains."
        }
        return api(status: status, code: code)
    }

    private static func signupDomains(in message: String) -> String? {
        let formats = [
            ("Die Registrierung ist auf E-Mail-Adressen von ", " beschränkt."),
            ("Sign up is restricted to ", " email addresses.")
        ]
        for (prefix, suffix) in formats {
            guard message.hasPrefix(prefix), message.hasSuffix(suffix),
                  message.count > prefix.count + suffix.count else { continue }
            let domains = String(message.dropFirst(prefix.count).dropLast(suffix.count))
            // ASCII DNS labels only; reject the whole list if even one item is
            // malformed. Do not trim, translate, or reflect arbitrary diagnostics.
            let valid = domains.components(separatedBy: ", ").allSatisfy { domain in
                domain.utf8.count <= 254 && domain.range(
                    of: #"\A@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}\z"#,
                    options: .regularExpression
                ) != nil
            }
            if valid { return domains }
        }
        return nil
    }

    public static func api(status: Int, code: String?) -> String {
        switch code {
        case "INVALID_EMAIL_OR_PASSWORD": return "E-Mail-Adresse oder Passwort ist falsch. Prüfe Deine Eingaben."
        case "INVALID_PASSWORD": return "Das Passwort ist falsch. Prüfe Deine Eingabe."
        case "INVALID_EMAIL": return "Gib eine gültige E-Mail-Adresse ein."
        case "USER_NOT_FOUND": return "Für diese E-Mail-Adresse gibt es noch kein Konto. Erstelle ein Konto."
        case "USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return "Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde Dich an."
        case "EMAIL_NOT_VERIFIED": return "Bitte bestätige zuerst Deine E-Mail-Adresse und melde Dich dann an."
        case "PASSWORD_TOO_SHORT": return "Das Passwort ist zu kurz. Verwende mindestens 8 Zeichen."
        case "PASSWORD_TOO_LONG": return "Das Passwort ist zu lang. Verwende höchstens 128 Zeichen."
        case "INVALID_TOKEN", "TOKEN_EXPIRED": return "Die Anmeldung ist ungültig oder abgelaufen. Starte sie erneut."
        case "SESSION_EXPIRED", "UNAUTHORIZED": return "Deine Sitzung ist abgelaufen. Melde Dich erneut an."
        case "SESSION_NOT_FRESH": return "Melde Dich ab und wieder an. Versuche die Aktion danach erneut."
        case "BANNED_USER": return "Dieses Konto wurde gesperrt. Wende Dich an Deine Administration."
        case "TOO_MANY_REQUESTS": return "Zu viele Versuche. Warte kurz und versuche es erneut."
        case "ACCOUNT_NOT_LINKED", "account_not_linked": return "Dieses Konto ist nicht verknüpft. Melde Dich mit Deiner bisherigen Anmeldemethode an."
        case "email_doesn't_match": return "Die E-Mail-Adresse stimmt nicht mit Deinem ursprünglichen Konto überein. Versuche es mit der ursprünglichen Adresse erneut."
        case "email_is_missing", "email_not_found": return "Dein Anmeldedienst hat keine E-Mail-Adresse übermittelt. Melde Dich mit E-Mail und Passwort an."
        case "desktop_handoff": return "Dieser Anmeldelink ist abgelaufen. Starte die Anmeldung erneut und schließe sie innerhalb weniger Minuten im Browser ab."
        case "SIGNUP_DISABLED": return "Die Registrierung ist deaktiviert. Wende Dich an Deine Administration."
        case "resident_limit": return "Dein Agentenkontingent ist aufgebraucht. Wende Dich an Deine Administration."
        default: break
        }
        switch status {
        case 400, 422: return "Die Anfrage konnte nicht verarbeitet werden. Prüfe Deine Eingaben und versuche es erneut."
        case 401: return "Deine Sitzung ist abgelaufen. Melde Dich erneut an."
        case 403: return "Du hast keine Berechtigung für diese Aktion. Wende Dich an Deine Administration."
        case 404: return "Der angeforderte Inhalt wurde nicht gefunden. Aktualisiere die Ansicht."
        case 409: return "Der Inhalt wurde inzwischen geändert. Aktualisiere die Ansicht und versuche es erneut."
        case 413: return "Der Inhalt ist zu groß. Verkleinere ihn und versuche es erneut."
        case 429: return "Zu viele Anfragen. Versuche es später erneut."
        case 500...599: return "Der Server ist gerade nicht verfügbar. Versuche es später erneut."
        default: return "Die Anfrage ist fehlgeschlagen. Versuche es erneut."
        }
    }

    public static func error(_ error: Error) -> String {
        if let error = error as? APIError { return error.message }
        let native = error as NSError
        if native.domain == NSURLErrorDomain {
            switch native.code {
            case URLError.notConnectedToInternet.rawValue: return "Keine Internetverbindung. Prüfe Deine Verbindung und versuche es erneut."
            case URLError.timedOut.rawValue: return "Der Server antwortet zu lange nicht. Versuche es erneut."
            case URLError.cannotFindHost.rawValue, URLError.cannotConnectToHost.rawValue: return "Der Server ist nicht erreichbar. Prüfe Deine Serveradresse und Verbindung."
            case URLError.networkConnectionLost.rawValue: return "Die Verbindung wurde unterbrochen. Versuche es erneut."
            case URLError.secureConnectionFailed.rawValue, URLError.serverCertificateUntrusted.rawValue,
                 URLError.serverCertificateHasBadDate.rawValue, URLError.serverCertificateHasUnknownRoot.rawValue,
                 URLError.serverCertificateNotYetValid.rawValue:
                return "Die sichere Verbindung zum Server ist fehlgeschlagen. Prüfe die Serveradresse und das Zertifikat."
            default: return "Die Verbindung ist fehlgeschlagen. Prüfe Deine Verbindung und versuche es erneut."
            }
        }
        if error is DecodingError { return "Die Serverantwort konnte nicht gelesen werden. Aktualisiere die App und versuche es erneut." }
        if native.domain == "com.apple.AuthenticationServices.AuthorizationError" {
            return "Die Anmeldung mit Apple ist fehlgeschlagen. Prüfe Deine Apple-Anmeldung in den Einstellungen und versuche es erneut."
        }
        if native.domain == "com.apple.AuthenticationServices.WebAuthenticationSession" {
            return "Die Anmeldeseite konnte nicht geöffnet werden. Starte die Anmeldung erneut."
        }
        if native.domain == NSCocoaErrorDomain {
            return "Der Inhalt konnte nicht verarbeitet oder gespeichert werden. Prüfe den freien Speicherplatz und versuche es erneut."
        }
        return "Die Aktion ist fehlgeschlagen. Versuche es erneut."
    }
}
