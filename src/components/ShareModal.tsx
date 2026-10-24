import { useLoadCanvasCapabilities } from '../prowin/canvasPermissions'
import { useEffect, useState } from 'react'
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  type Canvas,
  type CommunityCategory,
} from '../../shared/types'
import { navigate } from '../App'
import type { WorkspaceSummary } from '../../shared/types'
import { api, ApiError, paywalledWorkspace, type CanvasMember } from '../lib/api'
import { PERSONAL_WORKSPACE, UpgradeModal } from './WorkspaceModals'
import { authClient } from '../lib/auth'
import { Avatar } from './ui/avatar'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { IconButton } from './ui/icon-button'
import { BuildingIcon, CopyIcon, XIcon } from './ui/icons'
import { Input } from './ui/input'
import { PersonRow } from './ui/list'
import { Modal, ModalTitle } from './ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { ToggleChipGroup, ToggleChipItem } from './ui/toggle-chip'

type ShareableCanvas = Pick<
  Canvas,
  'id' | 'name' | 'ownerId' | 'linkAccess' | 'memberIds' | 'workspaceId' | 'publishedAt' | 'description' | 'category'
>
type SharePatch = Partial<
  Pick<ShareableCanvas, 'linkAccess' | 'memberIds' | 'workspaceId' | 'publishedAt' | 'description' | 'category'>
>

/* One sharing surface for the canvas and dashboard. The caller owns canvas
   state; this component reports optimistic access changes back to it. */
export function ShareModal({
  canvas,
  onChange,
  onClose,
  onCopied,
}: {
  canvas: ShareableCanvas
  onChange: (patch: SharePatch) => void
  onClose: () => void
  onCopied: () => void
}) {
  const { data: session } = authClient.useSession()
  const meId = session?.user?.id
  const capabilities = useLoadCanvasCapabilities(canvas.id)
  const isOwner = !!canvas.ownerId && canvas.ownerId === meId
  const linkEdits = canvas.linkAccess === 'edit'
  const [people, setPeople] = useState<CanvasMember[] | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [upgrade, setUpgrade] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .listMembers(canvas.id)
      .then((members) => active && setPeople(members))
      .catch(() => active && setPeople([]))
    api
      .listWorkspaces()
      .then((res) => active && setWorkspaces(res.workspaces))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canvas.id])

  const workspace = canvas.workspaceId ? workspaces.find((w) => w.id === canvas.workspaceId) : undefined

  async function move(target: string) {
    if (busy) return
    const workspaceId = target || null
    setBusy(true)
    setError(null)
    try {
      await api.moveCanvas(canvas.id, workspaceId)
      onChange({ workspaceId: workspaceId ?? undefined })
    } catch (caught) {
      const walled = paywalledWorkspace(caught)
      if (walled) setUpgrade(walled)
      else setError(caught instanceof ApiError ? String(caught.body.error ?? 'move failed') : 'move failed')
    } finally {
      setBusy(false)
    }
  }

  async function invite() {
    const clean = email.trim()
    if (!clean || busy || people === null) return
    setBusy(true)
    setError(null)
    try {
      const member = await api.inviteMember(canvas.id, clean)
      setPeople((current) =>
        current?.some((person) => person.userId === member.userId) ? current : [...(current ?? []), member],
      )
      if (!canvas.memberIds?.includes(member.userId)) {
        onChange({ memberIds: [...(canvas.memberIds ?? []), member.userId] })
      }
      setEmail('')
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'invite failed') : 'invite failed')
    }
    setBusy(false)
  }

  async function remove(userId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.removeMember(canvas.id, userId)
      setPeople((current) => current?.filter((person) => person.userId !== userId) ?? null)
      onChange({ memberIds: canvas.memberIds?.filter((id) => id !== userId) })
      if (userId === meId && !isOwner) navigate('/')
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'removal failed') : 'removal failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleLink(next: boolean) {
    if (busy) return
    const linkAccess = next ? 'edit' : 'none'
    setBusy(true)
    setError(null)
    try {
      await api.setLinkAccess(canvas.id, linkAccess)
      onChange({ linkAccess })
    } catch (caught) {
      setError(
        caught instanceof ApiError ? String(caught.body.error ?? 'access update failed') : 'access update failed',
      )
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(`${location.origin}/c/${canvas.id}`)
      onCopied()
    } catch {
      setError('Couldn’t copy the link. Copy the URL from your browser instead.')
    }
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <>
        <ModalTitle className="min-w-0">Share “{canvas.name}”</ModalTitle>
        {isOwner && (
          <>
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
              <Input
                variant="well"
                className="flex-1"
                autoFocus
                placeholder="Invite by email (doop account)"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && invite()}
              />
              <Button
                variant="primary"
                className="justify-center"
                disabled={busy || people === null || !email.trim()}
                onClick={invite}
              >
                Invite
              </Button>
            </div>
          </>
        )}
        {error && <p className="mx-[2px] mt-2 text-label text-accent-ink">{error}</p>}
        <div className="mt-[14px] mb-1 flex max-h-[40vh] flex-col gap-[2px] overflow-y-auto">
          {(people ?? []).map((person) => (
            <PersonRow
              key={person.userId}
              className="px-[2px] py-1.5"
              avatar={<Avatar name={person.name} size={28} />}
              name={`${person.name}${person.userId === meId ? ' (you)' : ''}`}
              detail={person.email}
              trailing={
                person.owner ? (
                  <span className="text-label text-ink-faint">Owner</span>
                ) : isOwner || person.userId === meId ? (
                  <IconButton
                    variant="danger"
                    size="sm"
                    aria-label={person.userId === meId ? 'Leave this canvas' : `Remove ${person.name}`}
                    disabled={busy}
                    onClick={() => remove(person.userId)}
                  >
                    <XIcon width={14} height={14} />
                  </IconButton>
                ) : (
                  <span className="text-label text-ink-faint">Can edit</span>
                )
              }
            />
          ))}
          {people === null && <p className="text-label text-ink-faint">Loading…</p>}
          {canvas.workspaceId && (
            <PersonRow
              className="px-[2px] py-1.5"
              avatar={
                <span className="grid size-7 flex-none place-items-center rounded-full bg-paper-deep text-ink-soft">
                  <BuildingIcon width={14} height={14} aria-hidden />
                </span>
              }
              name={`Everyone in ${workspace?.name ?? 'the workspace'}`}
              detail={
                workspace
                  ? `${workspace.memberCount} ${workspace.memberCount === 1 ? 'person' : 'people'}`
                  : 'workspace members'
              }
              trailing={<span className="text-label text-ink-faint">Can edit</span>}
            />
          )}
        </div>
        {/* filing: a workspace canvas is open to the whole team, so the
            choice sits with the access controls rather than in a menu */}
        {isOwner && workspaces.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-line-soft pt-3.5 sm:flex-row sm:items-center">
            <span className="text-body font-medium text-ink">Workspace</span>
            <Select
              value={canvas.workspaceId ?? PERSONAL_WORKSPACE}
              disabled={busy}
              onValueChange={(value) => void move(value === PERSONAL_WORKSPACE ? '' : value)}
            >
              <SelectTrigger className="sm:ml-auto sm:w-[240px]" aria-label="Workspace this canvas lives in">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL_WORKSPACE}>Personal — invite-only</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.active ? '' : ' (needs a plan)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-2.5 flex flex-col items-stretch justify-between gap-2.5 border-t border-line-soft pt-3.5 sm:flex-row sm:items-center">
          {isOwner ? (
            <label
              className="relative flex cursor-pointer items-center gap-2 text-body font-medium text-ink"
              title="Off = only you and invited people can open this canvas"
            >
              <Checkbox checked={linkEdits} disabled={busy} onChange={(event) => toggleLink(event.target.checked)} />
              Anyone with the link can edit
            </label>
          ) : (
            <span className="text-label text-ink-faint">
              {linkEdits ? 'Anyone with the link can edit' : 'Invite-only canvas'}
            </span>
          )}
          <Button className="justify-center gap-2" onClick={copy}>
            <CopyIcon className="size-3.5" />
            Copy link
          </Button>
        </div>
        {capabilities.publish && (
          <CommunityListing canvas={canvas} busy={busy} setBusy={setBusy} setError={setError} onChange={onChange} />
        )}
        {upgrade && (
          <UpgradeModal
            workspaceId={upgrade}
            reason="Moving a canvas into a workspace needs a Team plan."
            onClose={() => setUpgrade(null)}
          />
        )}
      </>
    </Modal>
  )
}

/* The gallery is opt-in and owner-only. Listing hands out previews and
   copies, never access — so it sits apart from the access controls above,
   with its own switch and its own blurb. */
function CommunityListing({
  canvas,
  busy,
  setBusy,
  setError,
  onChange,
}: {
  canvas: ShareableCanvas
  busy: boolean
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  onChange: (patch: SharePatch) => void
}) {
  const published = canvas.publishedAt !== undefined
  const [description, setDescription] = useState(canvas.description ?? '')
  const [category, setCategory] = useState<CommunityCategory>(canvas.category ?? 'website')
  const dirty = published && (description.trim() !== (canvas.description ?? '') || category !== canvas.category)

  async function save(next: boolean) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (next) {
        const listing = await api.publishCanvas(canvas.id, { description: description.trim(), category })
        onChange(listing)
      } else {
        await api.unpublishCanvas(canvas.id)
        onChange({ publishedAt: undefined, description: undefined, category: undefined })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'publish failed') : 'publish failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3.5 border-t border-line-soft pt-3.5">
      <label
        className="flex cursor-pointer items-center gap-2 text-body font-medium text-ink"
        title="Anyone on doop can preview and copy a listed canvas. The canvas itself stays private."
      >
        <Checkbox checked={published} disabled={busy} onChange={(event) => save(event.target.checked)} />
        Show in the community gallery
      </label>
      <p className="mt-1 pl-[26px] text-label leading-snug text-ink-faint">
        People can preview it and copy it into their own account. Your canvas stays private.
      </p>
      {published && (
        <div className="mt-3 flex flex-col gap-2.5 pl-[26px]">
          <Textarea
            rows={2}
            maxLength={280}
            variant="well"
            placeholder="What is this design? One or two lines helps people find it."
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
          <ToggleChipGroup
            aria-label="Gallery shelf"
            className="gap-1.5"
            value={category}
            onValueChange={(next) => setCategory(next as CommunityCategory)}
          >
            {COMMUNITY_CATEGORIES.map((value) => (
              <ToggleChipItem key={value} value={value} size="sm" disabled={busy}>
                {COMMUNITY_CATEGORY_LABELS[value]}
              </ToggleChipItem>
            ))}
          </ToggleChipGroup>
          {dirty && (
            <Button size="sm" className="self-start" disabled={busy} onClick={() => save(true)}>
              Update listing
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
