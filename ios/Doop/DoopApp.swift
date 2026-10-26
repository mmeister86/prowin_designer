import SwiftUI

@main
struct DoopApp: App {
    var body: some Scene {
        WindowGroup { ContentView().environment(\.locale, Locale(identifier: "de_DE")) }
    }
}
