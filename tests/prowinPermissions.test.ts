import { describe, expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types.ts'
const roles = vi.hoisted(() => new Map<string, string>())
vi.mock('../server/workspaces.ts', () => ({
  roleOf: (workspace: string, user: string) => roles.get(`${workspace}:${user}`),
  isWorkspaceMember: () => false,
}))
import { canCreateTemplates } from '../server/prowin/permissions.ts'
const identity = { userId: 'alice', creator: true, admin: false }
const personal = { id: 'c', ownerId: 'alice' } as Canvas

describe('Creator ownership boundaries', () => {
  it('requires Creator status and personal ownership', () => {
    expect(canCreateTemplates(identity, personal)).toBe(true)
    expect(canCreateTemplates({ ...identity, creator: false }, personal)).toBe(false)
    expect(
      canCreateTemplates(identity, { ...personal, ownerId: 'bob', memberIds: ['alice'], linkAccess: 'edit' }),
    ).toBe(false)
    expect(canCreateTemplates(undefined, personal)).toBe(false)
  })
  it('requires a current privileged workspace membership even for the canvas owner', () => {
    const canvas = { ...personal, workspaceId: 'team' }
    roles.set('team:alice', 'creator')
    expect(canCreateTemplates(identity, canvas)).toBe(true)
    roles.set('team:alice', 'member')
    expect(canCreateTemplates(identity, canvas)).toBe(false)
    roles.delete('team:alice')
    expect(canCreateTemplates(identity, canvas)).toBe(false)
  })
  it('allows the instance admin only on canvases they already have access to', () => {
    expect(canCreateTemplates({ ...identity, admin: true }, personal)).toBe(true)
    expect(canCreateTemplates({ ...identity, admin: true }, { ...personal, ownerId: 'bob' })).toBe(false)
  })
})
