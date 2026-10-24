import { AsyncLocalStorage } from 'node:async_hooks'
import { canAccessCanvas } from '../access.ts'
import { roleOf } from '../workspaces.ts'
import { permissionIdentity } from './accounts.ts'
import type { Canvas } from '../../shared/types.ts'
import type { CanvasCapabilities, PermissionIdentity } from '../../shared/prowin/permissions.ts'

const scope = new AsyncLocalStorage<PermissionIdentity | undefined>()

/** Only trusted server entry points set the identity; actor names and request JSON never do. */
export async function withUserPermissions<T>(userId: string | undefined, action: () => T): Promise<Awaited<T>> {
  if (!userId) return await scope.run(undefined, action)
  return await scope.run(await permissionIdentity(userId), action)
}

export function canCreateTemplates(identity: PermissionIdentity | undefined, canvas: Canvas): boolean {
  if (!identity?.creator) return false
  if (identity.admin) return canAccessCanvas(identity.userId, canvas)
  if (canvas.workspaceId) {
    const role = roleOf(canvas.workspaceId, identity.userId)
    return role === 'owner' || role === 'creator'
  }
  return canvas.ownerId === identity.userId
}

export function canvasCapabilities(canvas: Canvas): CanvasCapabilities {
  const identity = scope.getStore()
  const allowed = canCreateTemplates(identity, canvas)
  return { manageLocks: allowed, localAgent: allowed, publish: allowed && canvas.ownerId === identity?.userId }
}

export class CreatorPermissionError extends Error {
  readonly status = 403
  constructor() {
    super('Creator rights in this canvas are required')
  }
}

export function assertCanChangeLock(canvas: Canvas, before: boolean, after: boolean | undefined): void {
  if (after !== undefined && after !== before && !canvasCapabilities(canvas).manageLocks) {
    throw new CreatorPermissionError()
  }
}

/** Recheck both opt-in and canvas scope, including already-issued local run tokens. */
export async function canUseLocalAgent(userId: string, canvasId: string): Promise<boolean> {
  const { store } = await import('../store.ts')
  const canvas = store.getCanvas(canvasId)
  return !!canvas && canCreateTemplates(await permissionIdentity(userId), canvas)
}
