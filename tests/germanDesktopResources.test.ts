import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(`desktop/src-tauri/${path}`, 'utf8')

describe('deutsche native Desktop-Ressourcen', () => {
  it('beschriftet native Menüs und das Exportpanel deutsch', () => {
    const main = read('src/main.rs')
    for (const text of [
      'Datei',
      'Tab schließen',
      'Bearbeiten',
      'Ansicht',
      'Fenster',
      'Export speichern',
      'Widerrufen',
      'Wiederholen',
      'Ausschneiden',
      'Kopieren',
      'Einfügen',
      'Alles auswählen',
      'Dienste',
      'Andere ausblenden',
      'Beenden',
      'Vollbild',
      'Minimieren',
      'Zoomen',
    ]) {
      expect(main).toContain(`"${text}"`)
    }
    expect(main).toContain('None => "https://doop.design"')
    expect(main).toContain('Some("Cmd+W")')
    expect(main).toContain('const CLOSE_TAB: &str = "close-tab"')
  })

  it('hält die exakten UI-kompatiblen Installer- und Runner-Fallbacks ein', () => {
    const claude = read('src/claude.rs')
    for (const text of [
      'Die Installation wurde nicht rechtzeitig abgeschlossen. Klicke zum Prüfen auf Aktualisieren oder nutze die Installationsanleitung.',
      'Das Installationsprogramm konnte nicht gestartet werden:',
      'Claude Code wurde installiert, konnte aber nicht gestartet werden. Sieh in der Installationsanleitung nach.',
      'Die Installation ist fehlgeschlagen. Prüfe Deine Internetverbindung oder nutze die Installationsanleitung.',
      'Die Installation von Claude Code läuft bereits.',
      'Die Installation wurde abgebrochen.',
      'Claude hat die Aufgabe nicht abgeschlossen. Prüfe Deine Anmeldung und Nutzungslimits und versuche es erneut.',
      'Claude wurde ohne Ergebnis beendet. Prüfe Deine CLI-Anmeldung und -Version und versuche es erneut.',
      'Claude Code installieren?',
      'Lokalen Claude für Doop verwenden?',
    ])
      expect(claude).toContain(text)
    expect(claude).toContain('claude auth login')
    expect(claude).toContain('event["result"].as_str().unwrap_or(')
    expect(claude).toContain('https://claude.ai/install.sh')
    expect(claude).toContain('"--output-format"')
    expect(read('src/claude_extension.rs')).toContain('Installiere Claude Desktop')
    expect(read('src/codex.rs')).toContain('Deine Codex-Konfiguration')
  })

  it('konfiguriert ausschließlich den deutschen NSIS-Installer und bewahrt die Produktverträge', () => {
    const config = JSON.parse(read('tauri.conf.json'))
    expect(config.bundle.windows.nsis.languages).toEqual(['German'])
    expect(config.bundle.windows.nsis.displayLanguageSelector).toBe(false)
    expect(config.bundle.windows.nsis.customLanguageFiles).toEqual({ German: 'nsis/German.nsh' })
    expect(read('nsis/German.nsh')).toContain('Die Deinstallation ist fehlgeschlagen!')
    expect(read('nsis/German.nsh')).not.toMatch(/Failed to|Unable to|Sie |Ihrem/)
    expect(config.bundle.macOS.infoPlist).toBe('Info.plist')
    expect(read('Info.plist')).toContain('<key>CFBundleDevelopmentRegion</key>')
    expect(read('Info.plist')).toContain('<string>de</string>')
    expect(config.productName).toBe('doop')
    expect(config.identifier).toBe('design.doop.desktop')
    expect(config.build.frontendDist).toBe('https://doop.design')
    expect(config.plugins['deep-link'].desktop.schemes).toEqual(['doop'])
    expect(config.bundle.macOS.dmg.background).toBe('dmg/background.png')
  })

  it('liefert die deutsche DMG-Vorlage und das tatsächliche Retina-PNG', () => {
    const html = read('dmg/background.html')
    expect(html).toContain('<html lang="de">')
    expect(html).toContain('doop installieren')
    expect(html).toContain('Programme')
    expect(html).toContain('Danach kannst Du')
    const png = readFileSync('desktop/src-tauri/dmg/background.png')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1320)
    expect(png.readUInt32BE(20)).toBe(800)
    const phys = png.indexOf(Buffer.from('pHYs'))
    expect(phys).toBeGreaterThan(0)
    expect(png.readUInt32BE(phys + 4)).toBe(5669)
  })
})
