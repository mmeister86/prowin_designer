import type { Insets } from '../../shared/prowin/formats.ts'
import { safeZoneIntrudes } from '../../shared/prowin/safeZones.ts'
import type { SafeZoneBox } from '../lib/safeZoneMeasure.ts'

export interface BandRect {
  x: number
  y: number
  width: number
  height: number
}

/** Four non-overlapping margin bands: top/bottom span the full width, the
 *  sides fill only the strip between them so corners are never double-drawn. */
export function bandRects(
  insets: Insets,
  width: number,
  height: number,
): { top: BandRect; right: BandRect; bottom: BandRect; left: BandRect } {
  const middleHeight = Math.max(0, height - insets.top - insets.bottom)
  return {
    top: { x: 0, y: 0, width, height: insets.top },
    bottom: { x: 0, y: height - insets.bottom, width, height: insets.bottom },
    left: { x: 0, y: insets.top, width: insets.left, height: middleHeight },
    right: { x: width - insets.right, y: insets.top, width: insets.right, height: middleHeight },
  }
}

const BAND_STYLE = 'rgba(255,0,0,0.1)'

/** Parent-only advisory overlay in design px. Pointer-events none, never
 *  touches the iframe DOM. Warns for every intruding box without role
 *  exemptions; touching the inner boundary is not a violation. */
export function SafeZoneOverlay({
  width,
  height,
  insets,
  boxes,
  visible,
}: {
  width: number
  height: number
  insets: Insets | null
  boxes: SafeZoneBox[]
  visible: boolean
}) {
  if (!visible || !insets) return null
  const bands = bandRects(insets, width, height)
  const intruders = boxes.filter((box) => safeZoneIntrudes(box, insets, width, height))
  return (
    <div className="pointer-events-none absolute inset-0 z-[2]" data-safe-zone-overlay="">
      {[bands.top, bands.bottom, bands.left, bands.right].map((band, i) => (
        <div
          key={i}
          data-safe-zone-band=""
          className="absolute"
          style={{ left: band.x, top: band.y, width: band.width, height: band.height, background: BAND_STYLE }}
        />
      ))}
      {intruders.map((box, i) => (
        <div
          key={i}
          data-safe-zone-warn=""
          className="absolute shadow-[inset_0_0_0_calc(2px/var(--zoom,1))_rgba(255,80,0,0.9)]"
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        />
      ))}
    </div>
  )
}
