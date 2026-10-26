// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'tester' } } }) } }))
vi.mock('../src/lib/shell', () => ({ isDesktopShell: () => true }))
vi.mock('../src/lib/localAgent', () => ({
  hasLocalClaude: () => true,
  canInstallClaude: () => true,
  invokeClaude: native.invoke,
  refreshLocalAgent: vi.fn(async () => undefined),
  disconnectLocalAgent: vi.fn(),
  selectLocalAgent: vi.fn(),
  useLocalAgent: () => ({ native: { installed: false, connected: false, enabled: false }, preference: null }),
}))
import { LocalClaudeRow } from '../src/components/LocalClaude'

const read = (path: string) => readFileSync(path, 'utf8')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('routes actual Rust installer rejection variants through the UI with distinct recovery instructions', async () => {
  const rust = read('desktop/src-tauri/src/claude.rs')
  const install = rust.slice(rust.indexOf('pub async fn claude_install'), rust.indexOf('pub async fn claude_login'))
  // Read the actual producer, including format! prefixes. A new producer error
  // must receive a deliberate recovery mapping rather than silently falling back.
  const variants = [...install.matchAll(/(?:map_err\(\|[^|]*\|\s*(?:format!\()?|return Err\()"([^"]+)"/g)].map(
    (match) => match[1]!.replace('{e}', 'synthetic private diagnostic'),
  )
  expect(variants).toHaveLength(6)
  const recoveries = [
    ['läuft bereits', 'Aktualisieren'],
    ['abgebrochen', 'erneut'],
    ['gestartet', 'Installationsanleitung'],
    ['Zeitlimit', 'Aktualisieren'],
    ['Internetverbindung', 'Installationsanleitung'],
    ['starten', 'Installationsanleitung'],
  ]
  for (const [index, message] of variants.entries()) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      native.invoke.mockRejectedValueOnce(message)
      await act(async () => root.render(createElement(LocalClaudeRow)))
      const installButton = [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Claude Code installieren',
      )!
      await act(async () => installButton.click())
      const alert = container.querySelector('[role="alert"]')?.textContent
      for (const recovery of recoveries[index]!) expect(alert, message).toContain(recovery)
      expect(alert).not.toContain('synthetic private diagnostic')
      expect(installButton.disabled).toBe(false)
    } finally {
      act(() => root.unmount())
      container.remove()
    }
  }
})

it('assigns German plists and translated sources to the actual iOS targets in both build configurations', () => {
  const project = read('ios/Doop.xcodeproj/project.pbxproj')
  const objects = new Map(
    [...project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = \{([\s\S]*?)^\t\t\};/gm)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  )
  for (const match of project.matchAll(/^\t\t([A-F0-9]{24})(?: \/\*[^\n]*?\*\/)? = \{([^\n]+)\};/gm)) {
    objects.set(match[1]!, match[2]!)
  }
  const refs = (body: string) => body.match(/[A-F0-9]{24}/g) ?? []
  const targets = [...objects.values()].filter((body) => body.includes('isa = PBXNativeTarget;'))
  expect(targets).toHaveLength(2)
  for (const name of ['Doop', 'DoopActivity']) {
    const target = targets.find((body) => body.includes(`name = ${name};`))!
    expect(target).toBeDefined()
    const configList = objects.get(target.match(/buildConfigurationList = ([A-F0-9]{24})/)![1]!)!
    const configs = refs(configList).map((id) => objects.get(id)!)
    expect(configs).toHaveLength(2)
    for (const config of configs) {
      expect(config).toContain(`INFOPLIST_FILE = ${name}/Info.plist;`)
      expect(read(`ios/${name}/Info.plist`)).toMatch(/CFBundleDevelopmentRegion<\/key>\s*<string>de<\/string>/)
    }
    const phases = refs(target.match(/buildPhases = \(([\s\S]*?)\);/)![1]!).map((id) => objects.get(id)!)
    const sources = phases.find((body) => body.includes('isa = PBXSourcesBuildPhase;'))!
    const paths = refs(sources).map((id) => {
      const buildFile = objects.get(id)!
      const fileId = buildFile.match(/fileRef = ([A-F0-9]{24})/)![1]!
      return objects.get(fileId)!.match(/path = ([^;]+);/)![1]!
    })
    expect(paths).toContain(name === 'Doop' ? 'Core/NativeMessages.swift' : 'DoopActivity/DoopActivity.swift')
    expect(paths).not.toContain(name === 'Doop' ? 'DoopActivity/DoopActivity.swift' : 'Core/NativeMessages.swift')
  }
})
