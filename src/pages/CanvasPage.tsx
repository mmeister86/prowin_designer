import { useLoadCanvasCapabilities } from '../prowin/canvasPermissions'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../lib/store'
import { MOD_KEY, isHideUiShortcut } from '../lib/keys'
import { canHideUi, hideUiHinted } from '../lib/hideUi'
import { connect, disconnect, sendWs } from '../lib/ws'
import { api } from '../lib/api'
import { navigate } from '../App'
import { DoopMark } from '../components/Logo'
import {
  BarPill,
  TopBar,
  TopBarTitle,
  barIconBtn,
  barPillBtn,
  barPillIconBtn,
  barPrimaryBtn,
} from '../components/TopBar'
import { LivePresence } from '../components/LivePresence'
import { ensureTab } from '../lib/desktop'
import { Stage } from '../components/Stage'
import { Inspector } from '../components/Inspector'
import { ElementPanel } from '../components/ElementPanel'
import { ActivityPanel } from '../components/ActivityPanel'
import { ConnectModal } from '../components/ConnectModal'
import { LimitWall } from '../components/TeamAllowance'
import { WorkingNow } from '../components/WorkingNow'
import { MobilePanelTabs, SideRail } from '../components/SideRail'
import { LayersPanel, LayersRailToggle } from '../components/LayersPanel'
import { Onboarding } from '../components/Onboarding'
import { ShareModal } from '../components/ShareModal'
import { PresentMode } from '../components/PresentMode'
import { getIdentity, setName } from '../lib/identity'
import {
  copyFrames,
  duplicateFrames,
  hasFrameClip,
  pasteFrameCentered,
  pasteImagesCentered,
} from '../lib/frameClipboard'
import { clearHistory, redo, undo } from '../lib/history'
import { deleteSelection, toggleLockSelection, toggleSelectionHidden } from '../lib/layerEdits'
import { authClient } from '../lib/auth'
import { useIsMobile } from '../hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Button } from '../components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import {
  BrainIcon,
  FolderIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PlusIcon,
  GearIcon,
  ShareIcon,
  ShareUpIcon,
  XIcon,
} from '../components/ui/icons'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Field } from '../components/ui/field'
import { PeerAvatars, PresenceFace } from '../components/PeerAvatars'
import { Toast, ToastAction, ToastSpinner } from '../components/ui/toast'
import { Tooltip } from '../components/ui/tooltip'
import { Modal, ModalActions, ModalLede, ModalTitle } from '../components/ui/modal'
import { createCenteredFrame } from '../lib/framePlacement'

/* The floating chrome's geometry, in px from the canvas area's edges. The
   panels sit 14px in from the edge; on the right the Agents panel (280)
   always hugs the edge, the Inspector (244) opens to its left, and the icon
   islands (40) sit left of whatever is open. On the left the tool rail follows the Layers
   panel (264), or its collapsed 40px island. --chrome-left/--chrome-right
   mark where the open canvas begins and ends, for the zoom pill and toasts. */
const EDGE = 14
const LAYERS_W = 264
const RAIL_W = 40
const INSPECTOR_W = 244
const AGENTS_W = 280

function chromeLayout({
  layersOpen,
  propertiesShown,
  agentsOpen,
}: {
  layersOpen: boolean
  propertiesShown: boolean
  agentsOpen: boolean
}) {
  const toolRail = layersOpen ? EDGE + LAYERS_W + 12 : EDGE + RAIL_W + 10
  const properties = agentsOpen ? EDGE + AGENTS_W + 8 : EDGE
  const island = propertiesShown ? properties + INSPECTOR_W + 10 : agentsOpen ? EDGE + AGENTS_W + 10 : EDGE
  return { toolRail, properties, island, left: toolRail + RAIL_W + 16, right: island + RAIL_W + 10 }
}

const STARTER_HTML = `<!doctype html>
<html>
<head>
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, sans-serif;
    height: 100vh;
    display: grid;
    place-items: center;
    background: #fafafa;
    color: #999;
  }
</style>
</head>
<body>
  <p>Design me — edit the HTML, or ask an agent.</p>
</body>
</html>`

export function CanvasPage({ canvasId }: { canvasId: string }) {
  useLoadCanvasCapabilities(canvasId)
  const canvas = useStore((s) => s.canvas)
  const connected = useStore((s) => s.connected)
  const presences = useStore((s) => s.presences)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const isMobile = useIsMobile()
  const [showActivity, setShowActivity] = useState(() => !window.matchMedia('(max-width: 900px)').matches)
  /* ?connect=1 (the "connect your agent" email) lands on the Connect AI
     modal; the flag comes off the URL once the page is up so a reload or a
     copied link does not reopen it */
  const [showConnect, setShowConnect] = useState(() => new URLSearchParams(location.search).get('connect') === '1')
  useEffect(() => {
    const url = new URL(location.href)
    if (url.searchParams.get('connect') !== '1') return
    url.searchParams.delete('connect')
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])
  const [showShare, setShowShare] = useState(false)
  const [presenting, setPresenting] = useState(false)
  /* ⌘. acts only over the canvas view, outside PresentMode */
  const hideUiActive = canHideUi({ view: 'canvas', presenting })
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [showMobileLayers, setShowMobileLayers] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const storeNotice = useStore((s) => s.notice)
  const updateReady = useStore((s) => s.updateReady)
  const limitWall = useStore((s) => s.limitWall)
  const canvasNotFound = useStore((s) => s.canvasNotFound)

  /* keep the desktop shell's tab label in step with the live canvas name.
     The store's canvas briefly lags a navigation (the previous page's data
     until this one's ws init lands), so only sync when it's really ours —
     otherwise closing a tab re-adds it from its own stale state. */
  useEffect(() => {
    if (canvas?.id === canvasId) ensureTab(canvas.id, canvas.name)
  }, [canvas, canvasId])

  useEffect(() => {
    connect(canvasId)
    return () => {
      disconnect()
      useStore.getState().setCanvas(null)
      useStore.getState().setPresences([])
      useStore.getState().setCanvasNotFound(false)
      select(null)
      useStore.getState().setTool('select')
      clearHistory()
    }
  }, [canvasId, select])

  /* broadcast which frame I'm focused on */
  useEffect(() => {
    sendWs({ type: 'editing', frameId: selectedId })
  }, [selectedId])

  /* frame keyboard shortcuts: delete, copy/paste/duplicate, undo/redo */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* ⌘K from anywhere, fields included: open the side panel on the Agents
         tab and put the keyboard in its "Design it" composer. Asking for the
         composer ends ⌘. hide-UI — a field under `hidden` cannot take focus. */
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowActivity(true)
        if (useStore.getState().uiHidden) useStore.getState().toggleUiHidden()
        useStore.getState().setPanelTab('tasks')
        useStore.getState().requestComposerFocus()
        return
      }
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const selectedIds = useStore.getState().selectedIds
      /* a picked element (from the canvas or the layers tree) is what ⌫
         removes — the frame it lives in only goes when nothing inside it is
         selected. Auto-repeat is ignored: a held key must not take the
         element and then, on the next repeat, the frame under it. */
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat && deleteSelection()) e.preventDefault()
      if (e.key === 'Escape') {
        select(null)
        useStore.getState().setFollowing(null)
      }
      /* ⌘. hides every panel and toolbar; ⌘. again brings them back as they
         were. Escape deliberately leaves the UI hidden, as in Figma. */
      if (isHideUiShortcut(e) && hideUiActive) {
        e.preventDefault()
        useStore.getState().toggleUiHidden()
        if (useStore.getState().uiHidden && !hideUiHinted()) showToast(`UI hidden · ${MOD_KEY}. to show`)
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) void redo()
        else void undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        void redo()
        return
      }
      /* ⌘⇧H hides or shows what is selected — the picked element, else the
         frames — as the eye in the Layers panel would */
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
        if (toggleSelectionHidden()) e.preventDefault()
        return
      }
      /* ⌘⇧L locks or unlocks what is selected: the picked layer, else the frames */
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        if (toggleLockSelection()) e.preventDefault()
        return
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        /* ⌘C and ⌘D act on the whole selection */
        const frames = useStore.getState().canvas?.frames.filter((f) => selectedIds.includes(f.id)) ?? []
        /* don't hijack ⌘C when the user is copying selected text */
        if (e.key === 'c' && frames.length && !window.getSelection()?.toString()) copyFrames(frames)
        if (e.key === 'd' && frames.length) {
          e.preventDefault()
          duplicateFrames(frames)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canvasId, hideUiActive]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ⌘V lands here as a real paste event: clipboard images upload and drop in
     as frames; otherwise a copied frame (⌘C) pastes centered. Handled on
     'paste' rather than keydown so the browser hands us the clipboard bytes
     without a permission prompt. */
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const images = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (images.length) {
        e.preventDefault()
        pasteImagesCentered(canvasId, images).catch((err: Error) => {
          setToast(`Couldn’t paste image — ${err.message}`)
          window.setTimeout(() => setToast(null), 4000)
        })
      } else if (hasFrameClip()) {
        e.preventDefault()
        pasteFrameCentered(canvasId)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canvasId])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2000)
  }

  /* a pending Memory suggestion gets its own toast beside the side panel;
     clicking it jumps to the Memory tab, ✕ mutes it for this session */
  const pendingProposal = useStore((s) => s.proposals.find((p) => p.status === 'pending'))
  const panelTab = useStore((s) => s.panelTab)
  const [mutedProposal, setMutedProposal] = useState<string | null>(null)

  /* a decision landing in Memory is invisible work — surface it as its own
     memory toast in the same top-right stack. Only decisions captured after
     this page loaded count, so the ws-init batch stays silent. The summarizer
     re-broadcasts the decision with a generalized summary a moment later; the
     upsert re-fires this effect and the toast text swaps in place. */
  const latestDecision = useStore((s) => s.decisions[0])
  const [decisionToast, setDecisionToast] = useState<string | null>(null)
  const loadedAt = useRef(0)
  const decisionToastTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!loadedAt.current) loadedAt.current = Date.now()
    if (latestDecision && latestDecision.at > loadedAt.current) {
      const line = latestDecision.summary ?? latestDecision.text
      setDecisionToast(line.length > 64 ? line.slice(0, 61) + '…' : line)
      if (decisionToastTimer.current) window.clearTimeout(decisionToastTimer.current)
      decisionToastTimer.current = window.setTimeout(() => setDecisionToast(null), 6000)
    }
  }, [latestDecision])

  async function addFrame() {
    const n = (canvas?.frames.length ?? 0) + 1
    const frame = await createCenteredFrame(canvasId, `Frame ${n}`, STARTER_HTML)
    select(frame.id)
  }

  const me = getIdentity()
  const others = useMemo(
    () => Object.values(presences).filter((p) => p.clientId !== me.clientId),
    [presences, me.clientId],
  )

  const selectedFrame = canvas?.frames.find((f) => f.id === selectedId) ?? null
  /* the panel only shows when a frame-name click (or deep link) opened it —
     selecting a frame by clicking its surface must not slide it in */
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  /* a right-click that selected the frame keeps the Inspector out until the
     context menu closes — it would slide in right under the open menu */
  const deferPanel = useStore((s) => !!s.ctxMenu?.deferPanel)
  const layersOpen = useStore((s) => s.layersOpen)
  /* ⌘. — the canvas view with nothing over it; the board and PresentMode keep their chrome */
  const uiHidden = useStore((s) => s.uiHidden) && hideUiActive
  /* the element panel takes the frame inspector's spot while a Layers row
     has it open; it follows the element selection until it is closed */
  const selectedElement = useStore((s) => s.selectedElement)
  const elementPanelOpen = useStore((s) => s.elementPanelOpen)
  const panelElement = elementPanelOpen && selectedElement?.frameId === selectedFrame?.id ? selectedElement : null
  /* the frame Inspector or the element panel, whichever has the slot */
  const propertiesShown = !!selectedFrame && !deferPanel && (!!panelElement || inspectorOpen)
  const chrome = chromeLayout({ layersOpen, propertiesShown, agentsOpen: showActivity })
  const chromeVars = {
    '--chrome-top': isMobile ? '0px' : '50px',
    '--rail-left': `${chrome.toolRail}px`,
    '--chrome-left': `${chrome.left}px`,
    '--chrome-right': `${chrome.right}px`,
  } as CSSProperties
  const meFace = { name: me.name, color: presences[me.clientId]?.color ?? 'var(--brand)' }

  function openConnect() {
    setShowConnect(true)
  }

  /* the id in the URL isn't a canvas — a typo, a stale link, or one someone
     just deleted. Say so plainly rather than opening a canvas shell that
     can't load anything and never will. */
  if (canvasNotFound) {
    return (
      <AuthScreen>
        <AuthCard title="Canvas not found" align="center">
          <AuthCardText>
            &ldquo;{canvasId}&rdquo; doesn&rsquo;t match a canvas we know about. It may have been deleted, or the link
            may be wrong.
          </AuthCardText>
          <Button className="self-center" onClick={() => navigate('/')}>
            Back to your canvases
          </Button>
        </AuthCard>
      </AuthScreen>
    )
  }

  return (
    /* --app-inset is 0 normally; the impersonation shell raises it so this
       fixed layer starts below the banner instead of under it */
    <div className="fixed inset-x-0 bottom-0 top-[var(--app-inset,0px)] bg-paper">
      {/* Floating pills over the canvas, which shows through the transparent
          bar: the title pill on the left, live presence centred, sharing on
          the right. Tablet (xs..md) folds the text actions into the •••
          sheet; phone (< xs) wraps to two rows. ⌘. hides the chrome (this
          bar, the panels, the toolbars) with display:none rather than
          unmounting it, so what it holds — a composer draft, the expanded
          layers, a scroll position — is exactly as it was when ⌘. brings it
          back. */}
      <TopBar variant="canvas" className={cn(uiHidden && 'hidden')}>
        <div className="flex min-w-0 items-center gap-2 max-xs:basis-full">
          <BarPill className="min-w-0 gap-1 pr-3 pl-1">
            <Tooltip label="All canvases" side="bottom" align="start">
              <Button
                variant="bare"
                size="icon-sm"
                className={barPillIconBtn}
                aria-label="All canvases"
                onClick={() => navigate('/')}
              >
                <FolderIcon className="size-3.5" />
              </Button>
            </Tooltip>
            <CanvasName />
            <Badge className="max-md:hidden" title="Canvas id — agents use this with the MCP tools">
              {canvasId}
            </Badge>
            {connected ? (
              <span className="ml-1 whitespace-nowrap text-ink-faint max-lg:hidden">— Auto-saved</span>
            ) : (
              <span className="ml-1 whitespace-nowrap text-accent-ink">— Reconnecting…</span>
            )}
          </BarPill>
        </div>
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 max-[1180px]:hidden">
          <LivePresence me={meFace} others={others} onRenameSelf={() => setRenaming(true)} />
        </div>
        <div className="ml-auto flex flex-none items-center gap-2 max-md:hidden">
          {/* the presence pill needs the bar's centre; narrower desktops keep
              the plain avatar stack (and its follow buttons) over here */}
          <div
            className="mr-1 flex items-center min-[1181px]:hidden"
            title={others.map((p) => p.name).join(', ') || 'Just you here'}
          >
            <PresenceFace name={meFace.name} color={meFace.color} kind="user" />
            <span className="-ml-[7px] flex items-center">
              <PeerAvatars others={others} />
            </span>
          </div>
          <BarPill>
            <Button variant="bare" className={barPillBtn} onClick={() => setShowShare(true)}>
              <ShareUpIcon className="size-3.5" />
              Share
            </Button>
            <Tooltip label={selectedId ? 'Present this frame' : 'Select a frame to present'} side="bottom">
              <span className="inline-flex">
                <Button
                  variant="bare"
                  size="icon-sm"
                  className={barPillIconBtn}
                  aria-label="Present selected frame"
                  disabled={!selectedId}
                  onClick={() => setPresenting(true)}
                >
                  <PlayIcon className="size-3.5" />
                </Button>
              </span>
            </Tooltip>
          </BarPill>
          {/* the bar's one black action — it opens the MCP connection modal */}
          <Button variant="primary" className={barPrimaryBtn} onClick={openConnect}>
            <PlusIcon className="size-3.5" strokeWidth={1.4} />
            Connect AI
          </Button>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 max-md:flex max-xs:order-3">
          <div
            className="mr-1 flex items-center max-sm:hidden"
            title={others.map((p) => p.name).join(', ') || 'Just you here'}
          >
            <PresenceFace name={meFace.name} color={meFace.color} kind="user" />
            <span className="-ml-[7px] flex items-center">
              <PeerAvatars others={others} />
            </span>
          </div>
          <Button variant="primary" className={barPrimaryBtn} onClick={openConnect}>
            <PlusIcon className="size-3.5" strokeWidth={1.4} />
            <span className="max-sm:hidden">Connect AI</span>
            <span className="sm:hidden">AI</span>
          </Button>
          <Tooltip label="Canvas actions" side="bottom" align="end">
            <Button
              variant="ghost"
              size="icon"
              className={barIconBtn}
              aria-label="Canvas actions"
              onClick={() => setShowMobileActions(true)}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </TopBar>

      {/* the canvas runs under the transparent top bar to the window's top
          edge; the floating chrome gets its own layer that starts below the
          bar, so every panel offset stays measured from there */}
      <div className="absolute inset-0 overflow-hidden" style={chromeVars}>
        <Stage onAddFrame={addFrame} rightInset={isMobile ? 0 : chrome.right} />
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 top-[50px] max-md:top-14 max-xs:top-[100px]',
            uiHidden && 'hidden',
          )}
        >
          <div className="pointer-events-none absolute top-3.5 right-[var(--chrome-right)] z-30 flex flex-col items-end gap-2 transition-[right] duration-150 [&>*]:pointer-events-auto max-md:top-[56px] max-md:right-2 max-md:left-2">
            {pendingProposal && mutedProposal !== pendingProposal.id && !(showActivity && panelTab === 'memory') && (
              <div className="flex items-center rounded-[10px] bg-surface shadow-ring">
                <Button
                  variant="bare"
                  className="h-8 pr-1 pl-3 text-[12px] font-medium text-ink hover:bg-transparent hover:text-ink"
                  onClick={() => {
                    useStore.getState().setPanelTab('memory')
                    setShowActivity(true)
                  }}
                >
                  <DoopMark size={12} /> Memory suggestion — review
                </Button>
                <Button
                  variant="bare"
                  size="icon-sm"
                  className="mr-1 size-6 rounded-[6px] text-ink-faint"
                  title="Hide for now"
                  aria-label="Hide for now"
                  onClick={() => setMutedProposal(pendingProposal.id)}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            )}
            {decisionToast && (
              <Button
                variant="bare"
                className="max-w-full items-center gap-2.5 whitespace-normal rounded-[12px] bg-surface px-3.5 py-2.5 text-left font-normal shadow-pop transition-shadow hover:bg-surface hover:shadow-ring-hover sm:max-w-[320px] [&_svg]:text-ink-soft"
                title="Open Memory"
                onClick={() => {
                  useStore.getState().setPanelTab('memory')
                  setShowActivity(true)
                  setDecisionToast(null)
                }}
              >
                <BrainIcon className="size-4" />
                <span>
                  <b className="block text-[12.5px] font-medium text-ink">Saved to Memory</b>
                  <span className="mt-[1px] block text-[12px] leading-[1.4] text-ink-soft">{decisionToast}</span>
                </span>
              </Button>
            )}
          </div>
          {/* the presence pill in the bar already carries each agent's status
              line; this per-agent stack is only for windows too narrow for it */}
          <WorkingNow style={{ left: chrome.left }} className="min-[1180px]:hidden" />
          <Onboarding canvasId={canvasId} />
          {!isMobile && (layersOpen ? <LayersPanel onAddFrame={addFrame} /> : <LayersRailToggle />)}
          {isMobile && !showActivity && (
            <MobilePanelTabs
              onOpen={(tab) => {
                useStore.getState().setPanelTab(tab)
                setShowActivity(true)
              }}
            />
          )}
          {!isMobile && selectedFrame && panelElement && !deferPanel && (
            <ElementPanel
              /* keyed by frame, not element: picking the next element swaps
                 the values in place instead of remounting the panel blank */
              key={selectedFrame.id}
              frame={selectedFrame}
              selector={panelElement.selector}
              style={{ right: chrome.properties }}
            />
          )}
          {!isMobile && selectedFrame && inspectorOpen && !panelElement && !deferPanel && (
            <Inspector frame={selectedFrame} style={{ right: chrome.properties }} />
          )}
          {!isMobile && showActivity && (
            <ActivityPanel canvasId={canvasId} onClose={() => setShowActivity(false)} style={{ right: EDGE }} />
          )}
          {!isMobile && (
            <SideRail
              style={{ right: chrome.island }}
              agentsOpen={showActivity}
              onToggleAgents={() => setShowActivity((open) => !open)}
              inspectorOpen={propertiesShown}
              inspectorAvailable={!!selectedFrame}
              onToggleInspector={() => {
                const s = useStore.getState()
                if (propertiesShown) {
                  /* the element panel and the inspector share the slot —
                     hiding it closes whichever is showing */
                  s.setElementPanelOpen(false)
                  s.setInspectorOpen(false)
                } else s.setInspectorOpen(true)
              }}
              me={meFace}
              onRenameSelf={() => setRenaming(true)}
            />
          )}
        </div>
      </div>

      {isMobile && (
        <>
          <Sheet open={showMobileActions} onOpenChange={setShowMobileActions}>
            <SheetContent
              side="bottom"
              className="gap-0 rounded-t-2xl border-line bg-surface p-0 pb-[env(safe-area-inset-bottom)] shadow-pop"
            >
              <div className="border-b border-line-soft px-5 py-4 pr-14">
                <SheetTitle className="font-display text-lg font-extrabold">Canvas actions</SheetTitle>
                <SheetDescription className="mt-1 text-xs text-ink-soft">
                  Layers, import, export, share, or your account settings.
                </SheetDescription>
              </div>
              {/* the same glyphs as the desktop bar and islands; pages live
                  in the Layers sheet, as on desktop */}
              <div className="grid gap-2 p-4 [&_svg]:size-3.5 [&_svg]:text-ink-soft">
                <Button
                  variant="ghost"
                  className="h-11 justify-start gap-2.5 border-line bg-surface px-4"
                  onClick={() => {
                    setShowMobileActions(false)
                    setShowMobileLayers(true)
                  }}
                >
                  <LayersIcon /> Layers
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 justify-start gap-2.5 border-line bg-surface px-4"
                  onClick={() => {
                    setShowMobileActions(false)
                    setShowShare(true)
                  }}
                >
                  <ShareIcon /> Share canvas
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 justify-start gap-2.5 px-4 text-ink-soft"
                  onClick={() => navigate('/settings')}
                >
                  <GearIcon /> Settings
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Sheet open={showMobileLayers && !uiHidden} onOpenChange={setShowMobileLayers}>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              /* the first focusable is the panel's close button, whose
                 tooltip would pop on the sheet's auto-focus; the finger is
                 the focus on a phone anyway */
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="max-h-[calc(100svh-56px)] gap-0 rounded-t-2xl border-line bg-surface p-0 shadow-pop data-[side=bottom]:h-[min(78svh,680px)]"
            >
              <SheetTitle className="sr-only">Layers</SheetTitle>
              <LayersPanel onAddFrame={addFrame} surface="inline" onClose={() => setShowMobileLayers(false)} />
            </SheetContent>
          </Sheet>
          {/* ⌘. closes both sheets (and their backdrops) for the moment only:
              the open state they read from is untouched, so they are back
              as they were when ⌘. restores the chrome */}
          <Sheet
            open={!!selectedFrame && inspectorOpen && !deferPanel && !uiHidden}
            onOpenChange={(open) => {
              if (!open) select(null)
            }}
          >
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="max-h-[calc(100svh-56px)] gap-0 rounded-t-2xl border-line bg-surface p-0 shadow-pop data-[side=bottom]:h-[min(78svh,680px)]"
            >
              <SheetTitle className="sr-only">Frame inspector</SheetTitle>
              {selectedFrame && <Inspector frame={selectedFrame} surface="inline" />}
            </SheetContent>
          </Sheet>
          <Sheet open={showActivity && !uiHidden} onOpenChange={setShowActivity}>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="max-h-[calc(100svh-56px)] gap-0 rounded-t-2xl border-line bg-surface p-0 shadow-pop data-[side=bottom]:h-[min(78svh,680px)]"
            >
              <SheetTitle className="sr-only">Canvas activity</SheetTitle>
              <ActivityPanel canvasId={canvasId} onClose={() => setShowActivity(false)} surface="inline" />
            </SheetContent>
          </Sheet>
        </>
      )}

      {renaming && <RenameSelfModal current={me.name} onClose={() => setRenaming(false)} />}
      {showConnect && <ConnectModal canvasId={canvasId} onClose={() => setShowConnect(false)} />}
      {presenting && selectedId && <PresentMode frameId={selectedId} onClose={() => setPresenting(false)} />}
      {showShare && canvas && (
        <ShareModal
          key={canvas.id}
          canvas={canvas}
          onChange={(patch) => {
            const current = useStore.getState().canvas
            if (current?.id === canvasId) useStore.getState().setCanvas({ ...current, ...patch })
          }}
          onClose={() => setShowShare(false)}
          onCopied={() => {
            setShowShare(false)
            showToast('Canvas link copied')
          }}
        />
      )}
      {limitWall && (
        <LimitWall
          canvasId={canvasId}
          onClose={() => useStore.getState().setLimitWall(false)}
          onOpenConnect={() => {
            useStore.getState().setLimitWall(false)
            setShowConnect(true)
          }}
        />
      )}
      {updateReady ? (
        <Toast>
          doop was updated
          <ToastAction onClick={() => location.reload()}>Reload</ToastAction>
        </Toast>
      ) : toast ? (
        <Toast>{toast}</Toast>
      ) : (
        storeNotice && (
          <Toast>
            {storeNotice.busy && <ToastSpinner />}
            {storeNotice.text}
          </Toast>
        )
      )}
    </div>
  )
}

/** Your display name, the identity on your cursor and in the feed. It lives on
 *  the account, so saving it updates the account and rejoins the canvas. */
function RenameSelfModal({ current, onClose }: { current: string; onClose: () => void }) {
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const clean = draft.trim()

  function save() {
    if (!clean || clean === current || busy) return onClose()
    setBusy(true)
    authClient.updateUser({ name: clean }).then(
      () => {
        setName(clean)
        location.reload()
      },
      (err: unknown) => {
        console.error(err)
        setBusy(false)
      },
    )
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <>
        <ModalTitle>Your display name</ModalTitle>
        <ModalLede>Shown on your cursor, in the activity feed, and on everything you leave for an agent.</ModalLede>
        <Field className="mt-5" label="Name" labelVariant="form" htmlFor="display-name">
          <Input
            id="display-name"
            autoFocus
            value={draft}
            maxLength={60}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </Field>
        <ModalActions>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !clean || clean === current} onClick={save}>
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </ModalActions>
      </>
    </Modal>
  )
}

/* The canvas title doubles as its rename field. */
function CanvasName() {
  const canvas = useStore((s) => s.canvas)
  return (
    <TopBarTitle
      pill
      loading={!canvas}
      value={canvas?.name ?? ''}
      onCommit={(name) => {
        if (!canvas) return
        api.renameCanvas(canvas.id, name).catch(console.error)
        useStore.getState().renameCanvasLocal(name)
      }}
    />
  )
}
