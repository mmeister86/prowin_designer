import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function createEgressDirectory(): string {
  const parent = join(tmpdir(), 'opencode')
  mkdirSync(parent, { recursive: true })
  return mkdtempSync(join(parent, 'ai-egress-'))
}
