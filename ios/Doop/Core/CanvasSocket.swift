import Foundation

public enum CanvasSocket {
    // The server sends all frame HTML, comments and history in a single `init`.
    // Foundation's 1 MiB default disconnects otherwise healthy large canvases.
    public static let maximumMessageSize = 64 * 1024 * 1024

    public static func task(session: URLSession, request: URLRequest) -> URLSessionWebSocketTask {
        let task = session.webSocketTask(with: request)
        task.maximumMessageSize = maximumMessageSize
        return task
    }

    public enum Failure: Equatable {
        case interrupted, sessionExpired, accessDenied, notFound, messageTooLarge, invalidData

        public var message: String {
            switch self {
            case .interrupted: return "Verbindung unterbrochen. Wird wieder verbunden…"
            case .sessionExpired: return "Deine Sitzung ist abgelaufen. Kehre zur Übersicht zurück und melde Dich erneut an."
            case .accessDenied: return "Du hast keinen Zugriff mehr auf diese Arbeitsfläche."
            case .notFound: return "Diese Arbeitsfläche existiert nicht mehr."
            case .messageTooLarge: return "Diese Arbeitsfläche ist zu groß, um sie unter iOS live zu laden. Öffne sie in der Web-App."
            case .invalidData: return "Die Aktualisierung der Arbeitsfläche konnte nicht gelesen werden. Aktualisiere die App oder öffne die Arbeitsfläche erneut."
            }
        }

        public var shouldRetry: Bool { self == .interrupted }
    }

    public static func failure(for error: Error, closeCode: Int) -> Failure {
        switch closeCode {
        case 4401: return .sessionExpired
        case 4403: return .accessDenied
        case 4404: return .notFound
        case URLSessionWebSocketTask.CloseCode.messageTooBig.rawValue: return .messageTooLarge
        default: break
        }
        let nsError = error as NSError
        if nsError.domain == NSPOSIXErrorDomain && nsError.code == Int(POSIXErrorCode.EMSGSIZE.rawValue) {
            return .messageTooLarge
        }
        if error is DecodingError { return .invalidData }
        return .interrupted
    }
}
