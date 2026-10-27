import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createEgressDirectory } from './egressJournal.ts'

it('creates the missing Egress parent on a fresh system before allocating a private directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'egress-fresh-system-'))
  try {
    for (const name of ['TMPDIR', 'TEMP', 'TMP']) vi.stubEnv(name, root)
    expect(existsSync(join(root, 'opencode'))).toBe(false)
    const first = createEgressDirectory()
    const second = createEgressDirectory()
    expect(first).toContain(join(root, 'opencode', 'ai-egress-'))
    expect(statSync(first).isDirectory()).toBe(true)
    expect(statSync(second).isDirectory()).toBe(true)
    expect(second).not.toBe(first)
  } finally {
    vi.unstubAllEnvs()
    rmSync(root, { recursive: true, force: true })
  }
})
