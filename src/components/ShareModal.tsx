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
import { api, errorMessage, paywalledWorkspace, type CanvasMember } from '../lib/api'
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
      else setError(errorMessage(caught, 'Verschieben fehlgeschlagen'))
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
      setError(errorMessage(caught, 'Einladung fehlgeschlagen'))
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
      setError(errorMessage(caught, 'Entfernen fehlgeschlagen'))
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
      setError(errorMessage(caught, 'Zugriffsänderung fehlgeschlagen'))
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
      setError('Der Link konnte nicht kopiert werden. Kopiere stattdessen die URL aus Deinem Browser.')
    }
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <>
        <ModalTitle className="min-w-0">„{canvas.name}“ teilen</ModalTitle>
        {isOwner && (
          <>
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
              <Input
                variant="well"
                className="flex-1"
                autoFocus
                placeholder="Per E-Mail einladen (doop-Konto)"
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
                Einladen
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
              name={`${person.name}${person.userId === meId ? ' (Du)' : ''}`}
              detail={person.email}
              trailing={
                person.owner ? (
                  <span className="text-label text-ink-faint">Eigentümer</span>
                ) : isOwner || person.userId === meId ? (
                  <IconButton
                    variant="danger"
                    size="sm"
                    aria-label={person.userId === meId ? 'Diese Arbeitsfläche verlassen' : `Entfernen: ${person.name}`}
                    disabled={busy}
                    onClick={() => remove(person.userId)}
                  >
                    <XIcon width={14} height={14} />
                  </IconButton>
                ) : (
                  <span className="text-label text-ink-faint">Kann bearbeiten</span>
                )
              }
            />
          ))}
          {people === null && <p className="text-label text-ink-faint">Wird geladen…</p>}
          {canvas.workspaceId && (
            <PersonRow
              className="px-[2px] py-1.5"
              avatar={
                <span className="grid size-7 flex-none place-items-center rounded-full bg-paper-deep text-ink-soft">
                  <BuildingIcon width={14} height={14} aria-hidden />
                </span>
              }
              name={`Alle in ${workspace?.name ?? 'diesem Arbeitsbereich'}`}
              detail={
                workspace
                  ? `${workspace.memberCount.toLocaleString('de-DE')} ${workspace.memberCount === 1 ? 'Person' : 'Personen'}`
                  : 'Mitglieder des Arbeitsbereichs'
              }
              trailing={<span className="text-label text-ink-faint">Kann bearbeiten</span>}
            />
          )}
        </div>
        {/* filing: a workspace canvas is open to the whole team, so the
            choice sits with the access controls rather than in a menu */}
        {isOwner && workspaces.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-line-soft pt-3.5 sm:flex-row sm:items-center">
            <span className="text-body font-medium text-ink">Arbeitsbereich</span>
            <Select
              value={canvas.workspaceId ?? PERSONAL_WORKSPACE}
              disabled={busy}
              onValueChange={(value) => void move(value === PERSONAL_WORKSPACE ? '' : value)}
            >
              <SelectTrigger className="sm:ml-auto sm:w-[240px]" aria-label="Arbeitsbereich dieser Arbeitsfläche">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL_WORKSPACE}>Persönlich — nur auf Einladung</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.active ? '' : ' (Tarif erforderlich)'}
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
              title="Aus = nur Du und eingeladene Personen können diese Arbeitsfläche öffnen"
            >
              <Checkbox checked={linkEdits} disabled={busy} onChange={(event) => toggleLink(event.target.checked)} />
              Alle mit dem Link können bearbeiten
            </label>
          ) : (
            <span className="text-label text-ink-faint">
              {linkEdits ? 'Alle mit dem Link können bearbeiten' : 'Arbeitsfläche nur auf Einladung'}
            </span>
          )}
          <Button className="justify-center gap-2" onClick={copy}>
            <CopyIcon className="size-3.5" />
            Link kopieren
          </Button>
        </div>
        {capabilities.publish && (
          <CommunityListing canvas={canvas} busy={busy} setBusy={setBusy} setError={setError} onChange={onChange} />
        )}
        {upgrade && (
          <UpgradeModal
            workspaceId={upgrade}
            reason="Um eine Arbeitsfläche in einen Arbeitsbereich zu verschieben, brauchst Du einen Team-Tarif."
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
      setError(errorMessage(caught, 'Veröffentlichung fehlgeschlagen'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3.5 border-t border-line-soft pt-3.5">
      <label
        className="flex cursor-pointer items-center gap-2 text-body font-medium text-ink"
        title="Alle auf doop können eine veröffentlichte Arbeitsfläche ansehen und kopieren. Die Arbeitsfläche selbst bleibt privat."
      >
        <Checkbox checked={published} disabled={busy} onChange={(event) => save(event.target.checked)} />
        In der Community-Galerie anzeigen
      </label>
      <p className="mt-1 pl-[26px] text-label leading-snug text-ink-faint">
        Andere können sie ansehen und in ihr eigenes Konto kopieren. Deine Arbeitsfläche bleibt privat.
      </p>
      {published && (
        <div className="mt-3 flex flex-col gap-2.5 pl-[26px]">
          <Textarea
            rows={2}
            maxLength={280}
            variant="well"
            placeholder="Was ist das für ein Design? Ein oder zwei Zeilen helfen anderen, es zu finden."
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
          <ToggleChipGroup
            aria-label="Galeriekategorie"
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
              Eintrag aktualisieren
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
