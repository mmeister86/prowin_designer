import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from '../lib/api'
import { authClient } from '../lib/auth'
import type { CanvasCapabilities } from '../../shared/prowin/permissions'

const denied: CanvasCapabilities = { manageLocks: false, localAgent: false, publish: false }
const usePermissions = create<{ userId?: string; entries: Record<string, CanvasCapabilities> }>(() => ({ entries: {} }))
const pending = new Map<string, Promise<void>>()
const keyFor = (userId: string, canvasId: string) => `${userId}:${canvasId}`

function refresh(userId: string, canvasId: string): Promise<void> {
  const key = keyFor(userId, canvasId)
  const previous = pending.get(key)
  if (previous) return previous
  const request = api
    .canvasCapabilities(canvasId)
    .catch(() => denied)
    .then((capabilities) => {
      usePermissions.setState((state) => ({ entries: { ...state.entries, [key]: capabilities } }))
    })
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

/** Load once per page/modal; stale UI permissions never replace server authorization. */
export function useLoadCanvasCapabilities(canvasId: string) {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  useEffect(() => {
    usePermissions.setState({ userId })
    if (!userId) return
    const update = () => {
      void refresh(userId, canvasId)
    }
    update()
    window.addEventListener('focus', update)
    const timer = window.setInterval(update, 30_000)
    return () => {
      window.removeEventListener('focus', update)
      window.clearInterval(timer)
    }
  }, [userId, canvasId])
  return useCanvasCapabilities(canvasId)
}

export function useCanvasCapabilities(canvasId: string): CanvasCapabilities {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  return usePermissions((state) => (userId ? (state.entries[keyFor(userId, canvasId)] ?? denied) : denied))
}

/** Also gates keyboard commands that reach frame locks without a visible control. */
export function canManageFrameLocks(canvasId: string): boolean {
  const { userId, entries } = usePermissions.getState()
  return !!userId && !!entries[keyFor(userId, canvasId)]?.manageLocks
}
