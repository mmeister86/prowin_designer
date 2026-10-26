import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  PREVIEW_MAX_HEIGHT,
  type CommunityCategory,
  type CommunityItem,
} from '../../shared/types'
import { api } from '../lib/api'
import { navigate } from '../App'
import { timeAgo } from '../lib/time'
import { AppRail, railLayout } from '../components/AppRail'
import { FramePreview } from '../components/FramePreview'
import { openCanvasTab } from '../lib/desktop'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Kbd } from '../components/ui/kbd'
import { Pressable } from '../components/ui/pressable'
import { SearchField } from '../components/ui/search-field'
import { MetaLine, Tile, TileBody, TileCover } from '../components/ui/tile'
import { EmptyState } from '../components/ui/empty-state'
import { Skeleton } from '../components/ui/skeleton'
import { Segmented, SegmentedItem } from '../components/ui/segmented'
import { ToggleChipGroup, ToggleChipItem } from '../components/ui/toggle-chip'
import { Modal, ModalEyebrow, ModalTitle } from '../components/ui/modal'
import { CopyIcon } from '../components/ui/icons'
import { Toast } from '../components/ui/toast'
import { DashContent, DashHeader, DashLayout, DashMain, DashSubtitle, DashTitle } from '../components/ui/dash'

type Shelf = 'all' | CommunityCategory
type Sort = 'trending' | 'newest'

/** The community gallery: designs people have published for others to
 *  preview and copy. Browsing is read-only by construction — a card shows
 *  rendered frame images, and the only way in is a copy of your own. */
export function Community() {
  const [items, setItems] = useState<CommunityItem[] | null>(null)
  const [shelf, setShelf] = useState<Shelf>('all')
  const [sort, setSort] = useState<Sort>('trending')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<CommunityItem | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.listCommunity().then(setItems).catch(console.error)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function copy(item: CommunityItem) {
    if (copyingId) return
    setCopyingId(item.id)
    try {
      const canvas = await api.copyCommunityCanvas(item.id)
      /* the count went up server-side; reflect it without a refetch */
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, copyCount: i.copyCount + 1 } : i)) ?? null)
      setOpen(null)
      if (!openCanvasTab(canvas.id, canvas.name)) navigate(`/c/${canvas.id}`)
    } catch (error) {
      console.error(error)
      showToast('Dieses Design konnte nicht kopiert werden')
    } finally {
      setCopyingId(null)
    }
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }

  const counts = useMemo(() => {
    const map = new Map<Shelf, number>([['all', items?.length ?? 0]])
    for (const item of items ?? []) map.set(item.category, (map.get(item.category) ?? 0) + 1)
    return map
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? [])
      .filter((item) => shelf === 'all' || item.category === shelf)
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q) ||
          item.authorName.toLowerCase().includes(q),
      )
      .sort((a, b) =>
        sort === 'trending'
          ? b.copyCount - a.copyCount || b.publishedAt - a.publishedAt
          : b.publishedAt - a.publishedAt,
      )
  }, [items, shelf, query, sort])

  /* shelves with nothing on them stay out of the rail — an empty gallery
     should read as one quiet invitation, not six */
  const shelves = COMMUNITY_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0)
  const empty = items !== null && items.length === 0

  return (
    <DashLayout className={railLayout}>
      <AppRail active="community" searchShortcut={false} />

      <DashMain className="[background:var(--paper)]">
        <DashHeader variant="bare" className="max-md:min-h-[104px]">
          <SearchField
            ref={searchRef}
            size="header"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Galerie durchsuchen"
            aria-label="Galerie durchsuchen"
            trailing={<Kbd className="hidden md:inline-flex">⌘K</Kbd>}
          />
          <span className="flex-1" />
        </DashHeader>

        <DashContent>
          <div className="flex items-start gap-4 md:items-end">
            <div>
              <DashTitle>Community</DashTitle>
              <DashSubtitle>
                {items === null
                  ? '…'
                  : `${items.length.toLocaleString('de-DE')} ${items.length === 1 ? 'Design' : 'Designs'} zum Kopieren und Weitergestalten veröffentlicht`}
              </DashSubtitle>
            </div>
            <Segmented
              className="ml-auto flex-none"
              aria-label="Sortierung"
              value={sort}
              onValueChange={(next) => setSort(next as Sort)}
            >
              <SegmentedItem value="trending">Beliebt</SegmentedItem>
              <SegmentedItem value="newest">Neueste</SegmentedItem>
            </Segmented>
          </div>

          {shelves.length > 0 && (
            <ToggleChipGroup
              className="mt-4 gap-1.5 md:hidden"
              aria-label="Kategorie"
              value={shelf}
              onValueChange={(next) => setShelf(next as Shelf)}
            >
              <ToggleChipItem value="all" size="sm">
                Alle · {counts.get('all')?.toLocaleString('de-DE')}
              </ToggleChipItem>
              {shelves.map((c) => (
                <ToggleChipItem key={c} value={c} size="sm">
                  {COMMUNITY_CATEGORY_LABELS[c]} · {counts.get(c)?.toLocaleString('de-DE')}
                </ToggleChipItem>
              ))}
            </ToggleChipGroup>
          )}

          {empty ? (
            <EmptyState
              className="mt-7"
              title="Noch nichts in der Galerie"
              description="Über das Freigabemenü kann jeder eine Arbeitsfläche hier veröffentlichen. Andere können sie ansehen und in ihr eigenes Konto kopieren. Das Original bleibt privat. Mach den Anfang."
              action={
                <Button variant="primary" onClick={() => navigate('/')}>
                  Arbeitsfläche zum Veröffentlichen auswählen
                </Button>
              }
            />
          ) : (
            <>
              {items !== null && (query.trim() || shelf !== 'all') && (
                <div className="mt-[18px] text-caption text-ink-faint">
                  {visible.length.toLocaleString('de-DE')} von {items.length.toLocaleString('de-DE')}
                </div>
              )}
              {items !== null && visible.length === 0 ? (
                <p className="mt-7 text-copy text-ink-soft">
                  Keine Treffer — versuche einen anderen Suchbegriff oder eine andere Kategorie.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3.5 xs:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] md:gap-4">
                  {items === null &&
                    [0, 1, 2, 3].map((i) => <Skeleton key={i} index={i} shape="tile" aspect="16/10" />)}
                  {visible.map((item) => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      copying={copyingId === item.id}
                      onOpen={() => setOpen(item)}
                      onCopy={() => copy(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </DashContent>
      </DashMain>

      {open && (
        <DesignModal
          key={open.id}
          item={open}
          copying={copyingId === open.id}
          onCopy={() => copy(open)}
          onClose={() => setOpen(null)}
        />
      )}
      {toast && <Toast>{toast}</Toast>}
    </DashLayout>
  )
}

function GalleryCard({
  item,
  copying,
  onOpen,
  onCopy,
}: {
  item: CommunityItem
  copying: boolean
  onOpen: () => void
  onCopy: () => void
}) {
  const cover = item.frames[0]
  return (
    <Tile>
      <Pressable onClick={onOpen}>
        <TileCover aspect="16/10">
          <FramePreview frameId={cover?.id} empty="keine Vorschau" />
          {item.frames.length > 1 && (
            <Badge className="absolute left-2 top-2 bg-surface/90">
              {item.frames.length.toLocaleString('de-DE')} Zeichenflächen
            </Badge>
          )}
        </TileCover>
        <TileBody>
          <div className="truncate font-display text-copy font-semibold">{item.name}</div>
          {item.description && <p className="mt-1 line-clamp-2 text-label text-ink-soft">{item.description}</p>}
          <MetaLine className="mt-[7px]">
            <span className="truncate">von {item.authorName}</span>
            <span className="flex-none">
              {item.copyCount.toLocaleString('de-DE')} {item.copyCount === 1 ? 'Kopie' : 'Kopien'}
            </span>
          </MetaLine>
        </TileBody>
      </Pressable>
      <Button
        size="sm"
        variant="primary"
        disabled={copying}
        onClick={onCopy}
        className="absolute right-2 top-2 opacity-100 shadow-pop md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <CopyIcon className="size-3.5" /> {copying ? 'Wird kopiert…' : 'Verwenden'}
      </Button>
    </Tile>
  )
}

/** One listing up close: every frame the owner published, at a glance,
 *  and the one action the gallery offers. */
function DesignModal({
  item,
  copying,
  onCopy,
  onClose,
}: {
  item: CommunityItem
  copying: boolean
  onCopy: () => void
  onClose: () => void
}) {
  return (
    <Modal size="xl" onClose={onClose}>
      <div className="min-w-0">
        <ModalEyebrow>{COMMUNITY_CATEGORY_LABELS[item.category]}</ModalEyebrow>
        <ModalTitle className="mt-1.5 truncate">{item.name}</ModalTitle>
        <p className="mt-1 text-caption text-ink-faint">
          von {item.authorName} · veröffentlicht {timeAgo(item.publishedAt)} · {item.copyCount.toLocaleString('de-DE')}{' '}
          {item.copyCount === 1 ? 'Kopie' : 'Kopien'}
        </p>
      </div>
      {item.description && <p className="mt-3 text-copy text-ink-soft">{item.description}</p>}
      <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2">
        {item.frames.map((frame) => (
          <figure key={frame.id} className="flex-none">
            {/* one shared height so mixed artboards read as a row, not a
                staircase. The box takes the shape of the image it holds: the
                preview render clips tall frames at PREVIEW_MAX_HEIGHT, so a
                6000px landing page arrives as a landscape shot of its top —
                sizing to the frame's real height would squeeze that into a
                portrait sliver and crop the sides away. */}
            <div
              className="h-[300px] max-w-[min(520px,80vw)] overflow-hidden rounded-pill border border-line bg-paper-deep"
              style={{ aspectRatio: `${frame.width} / ${Math.min(frame.height, PREVIEW_MAX_HEIGHT)}` }}
            >
              <FramePreview frameId={frame.id} />
            </div>
            <figcaption className="mt-1.5 truncate text-caption text-ink-faint">
              {frame.name} · {Math.round(frame.width).toLocaleString('de-DE')}×
              {Math.round(frame.height).toLocaleString('de-DE')}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-stretch gap-2.5 border-t border-line-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-caption text-ink-faint">
          Kopien landen als private Arbeitsflächen bei Dir — bearbeite sie frei, das Original bleibt unverändert.
        </span>
        <Button variant="primary" className="justify-center" disabled={copying} onClick={onCopy}>
          <CopyIcon className="size-4" /> {copying ? 'Wird kopiert…' : 'Zu meinen Arbeitsflächen kopieren'}
        </Button>
      </div>
    </Modal>
  )
}

/** A published frame through the public image pipeline. The frame id is
 *  all the gallery holds; a render that fails says so instead of leaving a
 *  blank tile that looks like an empty design. */
