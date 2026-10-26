import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(`ios/${path}`, 'utf8')

describe('German iOS resources', () => {
  it('declares German for the app and the separate activity bundle', () => {
    const project = read('Doop.xcodeproj/project.pbxproj')
    expect(project).toContain('developmentRegion = de;')
    for (const target of ['Doop', 'DoopActivity']) {
      expect(project.match(new RegExp(`INFOPLIST_FILE = ${target}/Info.plist;`, 'g'))).toHaveLength(2)
      const plist = read(`${target}/Info.plist`)
      expect(plist).toMatch(/<key>CFBundleDevelopmentRegion<\/key>\s*<string>de<\/string>/)
      expect(plist).toMatch(/<key>CFBundleLocalizations<\/key>\s*<array>\s*<string>de<\/string>\s*<\/array>/)
    }
    expect(read('Doop/DoopApp.swift')).toContain('Locale(identifier: "de_DE")')
    expect(read('DoopActivity/DoopActivity.swift')).toContain('Locale(identifier: "de_DE")')
  })

  it('retains deletion consequences and German VoiceOver labels', () => {
    const app = read('Doop/ContentView.swift')
    expect(app).toContain('Arbeitsflächen, die nur Dir gehören, werden entfernt')
    expect(app).toContain('geteilte Arbeitsflächen bleiben bei den anderen')
    expect(app).toContain('Das kann nicht rückgängig gemacht werden.')
    expect(app).toContain('.accessibilityLabel("Neue Arbeitsfläche")')
    expect(read('Doop/NativeCanvasView.swift')).toContain('.accessibilityLabel("Designaufgabe senden")')
  })

  it('uses German defaults only when creating new content', () => {
    expect(read('Doop/ContentView.swift')).toContain('name.isEmpty ? "Unbenannte Arbeitsfläche" : name')
    const canvas = read('Doop/CanvasModel.swift')
    expect(canvas).toContain('"name": "Unbenannte Zeichenfläche"')
    expect(canvas).toContain("<html lang='de'>")
    expect(canvas).toContain('Was möchtest Du gestalten?')
    expect(read('Doop/Core/ExportDirectory.swift')).toContain('"Doop-Export"')
  })

  it('keeps phase contracts and agent content while translating activity chrome', () => {
    const activity = read('DoopActivity/DoopActivity.swift')
    expect(activity).toContain('case "working": "In Arbeit"')
    expect(activity).toContain('case "queued": "Wartet auf einen Agenten"')
    expect(activity).toContain('"Arbeitsfläche öffnen"')
    expect(activity).toContain('Text(current)')
    expect(read('Doop/Core/AgentActivityState.swift')).toContain('phase == "working" || phase == "queued"')
  })

  it('never presents raw external diagnostics', () => {
    for (const file of ['DoopClient', 'CanvasModel', 'ContentView', 'NativeCanvasView']) {
      expect(read(`Doop/${file}.swift`)).not.toContain('error.localizedDescription')
    }
    const client = read('Doop/DoopClient.swift')
    expect(read('Doop/Core/NativeMessages.swift')).toContain('payload?["code"] as? String')
    expect(client).toContain('NativeMessages.api')
    expect(read('Doop/Core/NativeMessages.swift')).toContain('case "INVALID_EMAIL_OR_PASSWORD"')
    for (const code of [
      'BANNED_USER',
      'TOO_MANY_REQUESTS',
      'account_not_linked',
      "email_doesn't_match",
      'email_is_missing',
      'desktop_handoff',
    ]) {
      expect(read('Doop/Core/NativeMessages.swift')).toContain(`"${code}"`)
    }
  })

  it('routes original HTTP error data through the Core helper exercised by native checks', () => {
    const client = read('Doop/DoopClient.swift')
    expect(client).toContain('NativeMessages.api(status: http.statusCode, data: data)')
    expect(client).not.toContain('JSONSerialization.jsonObject')
    const core = read('Doop/Core/NativeMessages.swift')
    expect(core).toContain('public static func api(status: Int, data: Data) -> String')
    expect(core).toContain('JSONSerialization.jsonObject(with: data)')
    const checks = read('Tests/NativeMessagesTests.swift')
    expect(checks).toContain('NativeMessages.api(status: status, data: Data(json.utf8))')
    expect(checks).toContain('Die Registrierung ist auf E-Mail-Adressen von @prowin.de, @team.example.org beschränkt.')
    expect(checks).toContain('Sign up is restricted to @prowin.de, @team.example.org email addresses.')
    expect(read('Tests/ServerAddressTests.swift')).toContain('NativeMessagesChecks.run()')
  })

  it('pins explicit formatters and keeps technical and content contracts', () => {
    const view = read('Doop/NativeCanvasView.swift')
    expect(view.match(/format: \.number\.locale\(Locale\(identifier: "de_DE"\)\)/g)).toHaveLength(2)
    expect(read('Doop/ContentView.swift')).toContain(
      '.relative(presentation: .named).locale(Locale(identifier: "de_DE"))',
    )
    expect(read('Doop/ContentView.swift')).toContain(
      '.dateTime.hour().minute().second().locale(Locale(identifier: "de_DE"))',
    )
    expect(view).toContain('Text(comment.text)')
    expect(view).toContain('Text(task.status)')
    expect(read('Doop/CanvasModel.swift')).toContain('["title": prompt]')
    const project = read('Doop.xcodeproj/project.pbxproj')
    expect(project).toContain('Core/NativeMessages.swift in Sources')
    expect(read('Package.swift')).toContain('path: "Doop/Core"')
  })
})
