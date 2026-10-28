import { useCanvasCapabilities } from '../prowin/canvasPermissions'
import { useState, type MutableRefObject } from 'react'
import type { Frame } from '../../shared/types'
import { errorMessage } from '../lib/api'
import { copyFrames, duplicateFrames, hasFrameClip, pasteFrameAtScreen } from '../lib/frameClipboard'
import { copyFramePng } from '../lib/frameExport'
import { deleteFramesTracked } from '../lib/history'
import { setFramesHidden, setFramesLocked } from '../lib/layerEdits'
import { useStore } from '../lib/store'
import { MOD_KEY } from '../lib/keys'
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from './ui/context-menu'
import { MenuHint } from './ui/menu'
import { FrameExportModal } from './FrameExportModal'
import { FrameHistoryModal } from './FrameHistoryModal'

async function copyImageUrl(frame: Frame) {
  const notify = useStore.getState().pushNotice
  try {
    await navigator.clipboard.writeText(`${location.origin}/i/${frame.id}.png?scale=2`)
    notify('Bild-URL kopiert')
  } catch (err) {
    notify(errorMessage(err, 'Die Bild-URL konnte nicht kopiert werden'))
  }
}

/** Right-click menu for a frame. FrameView owns the trigger, and passes the
 *  point the right-click happened at — Paste lands there. */
export function FrameContextMenu({ frame, at }: { frame: Frame; at: MutableRefObject<{ x: number; y: number }> }) {
  const [showExport, setShowExport] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  /* a right-click inside a multi-selection acts on the whole group */
  const groupSize = useStore((s) => (s.selectedIds.includes(frame.id) ? s.selectedIds.length : 1))
  /* Hide/Show reads as one item: the group shows when every frame in it is hidden */
  const allHidden = useStore((s) => {
    const ids = s.selectedIds.includes(frame.id) ? s.selectedIds : [frame.id]
    return (s.canvas?.frames ?? []).filter((f) => ids.includes(f.id)).every((f) => !!f.hidden)
  })
  function groupFrames(): Frame[] {
    const s = useStore.getState()
    const ids = s.selectedIds.includes(frame.id) ? s.selectedIds : [frame.id]
    return s.canvas?.frames.filter((f) => ids.includes(f.id)) ?? [frame]
  }
  const canManageLocks = useCanvasCapabilities(frame.canvasId).manageLocks
  /* Lock reads as one state for the group: it unlocks only once every frame
     in it is locked, otherwise it locks the rest (as ⌘⇧L does) */
  const allLocked = useStore((s) => {
    const ids = s.selectedIds.includes(frame.id) ? s.selectedIds : [frame.id]
    const group = s.canvas?.frames.filter((f) => ids.includes(f.id)) ?? [frame]
    return group.every((f) => f.locked)
  })
  function deleteSelection() {
    /* locked frames stay, as they do on ⌫ */
    deleteFramesTracked(groupFrames().filter((f) => !f.locked))
  }
  return (
    <>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          // The export dialog owns focus once the menu closes.
          if (showExport || historyOpen) event.preventDefault()
        }}
      >
        <ContextMenuItem
          onSelect={() =>
            useStore.getState().addComposerReferences(
              frame.canvasId,
              groupFrames().map((f) => f.id),
            )
          }
        >
          Als Referenz verwenden
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copyFrames(groupFrames())}>
          {groupSize > 1 ? `${groupSize.toLocaleString('de-DE')} Zeichenflächen kopieren` : 'Kopieren'}
          <MenuHint>{MOD_KEY}C</MenuHint>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasFrameClip()}
          onSelect={() => pasteFrameAtScreen(frame.canvasId, at.current.x, at.current.y)}
        >
          Einfügen
          <MenuHint>{MOD_KEY}V</MenuHint>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => duplicateFrames(groupFrames())}>
          {groupSize > 1 ? `${groupSize.toLocaleString('de-DE')} Zeichenflächen duplizieren` : 'Duplizieren'}
          <MenuHint>{MOD_KEY}D</MenuHint>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setFramesHidden(groupFrames(), !allHidden)}>
          {groupSize > 1
            ? `${groupSize.toLocaleString('de-DE')} Zeichenflächen ${allHidden ? 'einblenden' : 'ausblenden'}`
            : allHidden
              ? 'Einblenden'
              : 'Ausblenden'}
          <MenuHint>{MOD_KEY}⇧H</MenuHint>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => navigator.clipboard.writeText(`${location.origin}/c/${frame.canvasId}?frame=${frame.id}`)}
        >
          Link kopieren
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyFramePng(frame)}>Als PNG kopieren</ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyImageUrl(frame)}>Bild-URL kopieren</ContextMenuItem>
        <ContextMenuItem onSelect={() => setShowExport(true)}>Exportieren…</ContextMenuItem>
        <ContextMenuItem onSelect={() => setHistoryOpen(true)}>Versionsverlauf…</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canManageLocks} onSelect={() => setFramesLocked(groupFrames(), !allLocked)}>
          {groupSize > 1
            ? `${groupSize.toLocaleString('de-DE')} Zeichenflächen ${allLocked ? 'entsperren' : 'sperren'}`
            : allLocked
              ? 'Entsperren'
              : 'Sperren'}
          <MenuHint>{MOD_KEY}⇧L</MenuHint>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem tone="danger" disabled={allLocked} onSelect={deleteSelection}>
          {groupSize > 1 ? `${groupSize.toLocaleString('de-DE')} Zeichenflächen löschen` : 'Zeichenfläche löschen'}
          <MenuHint>⌫</MenuHint>
        </ContextMenuItem>
      </ContextMenuContent>
      {showExport && <FrameExportModal frame={frame} onClose={() => setShowExport(false)} />}
      {historyOpen && <FrameHistoryModal frame={frame} onClose={() => setHistoryOpen(false)} />}
    </>
  )
}
