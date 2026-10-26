import type { Frame } from '../../shared/types'
import { downloadFrameExport, type FrameExportFormat } from '../lib/frameExport'
import { Button } from './ui/button'
import { Modal, ModalActions, ModalLede, ModalTitle } from './ui/modal'

export function FrameExportModal({ frame, onClose }: { frame: Frame; onClose: () => void }) {
  function download(format: FrameExportFormat) {
    void downloadFrameExport(frame, format)
    onClose()
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <ModalTitle className="break-words">„{frame.name}“ exportieren</ModalTitle>
      <ModalLede>Lade diese Zeichenfläche als PNG- oder JPG-Bild herunter.</ModalLede>
      <div className="mt-5 grid gap-2">
        <Button variant="ghost" className="justify-start" onClick={() => download('png')}>
          PNG herunterladen
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => download('jpg')}>
          JPG herunterladen
        </Button>
      </div>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
      </ModalActions>
    </Modal>
  )
}
