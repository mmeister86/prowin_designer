import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Frame } from '../../shared/types'
import { useStore } from '../lib/store'
import { inspectElement, onFrameChange, styleElement, type ElementInfo, type StylePatch } from '../lib/frameBridge'
import { ancestorsOf, buildLayerTree, elementHtml, findLayer, layerName } from '../lib/layers'
import { replaceLayerHtml } from '../lib/layerEdits'
import {
  borderSummary,
  compactBox,
  lengthValue,
  rgbToHex,
  shorthandValue,
  sizeMode,
  type SizeMode,
} from '../lib/cssValues'
import { cn } from '@/lib/utils'
import { LayerKindIcon } from './LayerKindIcon'
import {
  Panel,
  PanelBody,
  PanelClose,
  PanelHeader,
  PanelTab,
  PanelTabPanel,
  PanelTabs,
  PanelTabsRoot,
} from './ui/panel'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Tooltip } from './ui/tooltip'
import { AlignCenterIcon, AlignJustifyIcon, AlignLeftIcon, AlignRightIcon, ArrowUpIcon } from './ui/icons'
import { Segmented, SegmentedItem } from './ui/segmented'
import {
  ColorField,
  FieldUnit,
  NumberField,
  PropertyRow,
  PropertySection,
  SelectField,
  StaticField,
  TextField,
  ToggleField,
} from './ui/property-field'

const TAB_KEY = 'doop:element-panel-tab'
/* the runtime answers in a frame or two; the wait lets a streaming agent's
   chunks settle before every re-read */
const INSPECT_DELAY_MS = 120
const HTML_SAVE_DELAY_MS = 700

type Tab = 'design' | 'html'

function readTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'html' ? 'html' : 'design'
  } catch {
    return 'design'
  }
}

/** The element properties rail — the second panel at the right, opened from
 *  a Layers row. Reads the element's computed styles out of the live frame
 *  and writes edits back as inline styles; the HTML tab edits its markup. */
export function ElementPanel({
  frame,
  selector,
  className,
  style,
}: {
  frame: Frame
  selector: string
  className?: string
  /** carries `right`, so it opens beside the Agents panel at the edge */
  style?: CSSProperties
}) {
  /* the tab sticks across elements and visits: walking the tree in HTML
     view must not snap back to Design on every row */
  const [tab, setTab] = useState<Tab>(readTab)
  /* the values carry the selector they were read from: switching elements
     keeps the panel mounted (no blank flash), but the old element's values
     are shown dimmed and locked until the new element's read lands, so a
     quick edit can never write them onto the new selection */
  const [read, setRead] = useState<{ selector: string; info: ElementInfo } | null>(null)
  const info = read?.selector === selector ? read.info : null
  const stale = read && !info ? read.info : null

  const tree = useMemo(() => buildLayerTree(frame.html), [frame.html])
  const node = useMemo(() => findLayer(tree, selector), [tree, selector])
  const parentNode = useMemo(() => ancestorsOf(tree, selector)?.at(-1) ?? null, [tree, selector])

  /* re-read after every html change — remote edits and our own saves alike —
     and when the runtime finishes rendering or loading fonts */
  useEffect(() => {
    let live = true
    let timer: number | null = null
    const read = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        inspectElement(frame.id, selector)
          .then((next) => {
            if (live && next) setRead({ selector, info: next })
          })
          .catch(console.error)
      }, INSPECT_DELAY_MS)
    }
    read()
    const off = onFrameChange(frame.id, read)
    return () => {
      live = false
      off()
      if (timer) window.clearTimeout(timer)
    }
  }, [frame.id, frame.html, selector])

  function apply(styles: StylePatch) {
    if (!info) return // nothing fresh to edit against yet
    styleElement(frame.id, selector, styles)
      .then((next) => {
        /* a reply for an element no longer selected must not replace the
           values of the one that is */
        if (next) setRead((r) => (r && r.selector !== selector ? r : { selector, info: next }))
      })
      .catch(console.error)
  }

  function selectTab(next: Tab) {
    setTab(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* private mode: the choice just doesn't stick */
    }
  }

  function close() {
    useStore.getState().pickElement(null)
  }

  const name = node ? layerName(node) : selector.split(' > ').at(-1)
  const parentLabel = parentNode ? `${parentNode.tag}${parentNode.detail}` : 'body'

  return (
    <Panel
      className={cn('top-2.5 max-h-[calc(100%-24px)] w-[244px] transition-[right] duration-150', className)}
      style={style}
    >
      <PanelTabsRoot value={tab} onValueChange={(v) => selectTab(v === 'html' ? 'html' : 'design')}>
        <PanelHeader className="pl-2">
          <PanelTabs>
            <PanelTab value="design">Design</PanelTab>
            <PanelTab value="html">HTML</PanelTab>
          </PanelTabs>
          <PanelClose onClick={close} />
        </PanelHeader>
        <div className="flex flex-none items-center gap-[7px] border-b border-line-soft px-3 py-2.5">
          <span className="grid size-5 flex-none place-items-center text-ink-faint">
            <LayerKindIcon kind={node?.kind ?? 'box'} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
            {name}
            <small className="ml-[5px] text-[11px] font-normal text-ink-faint">in {parentLabel}</small>
          </span>
          {parentNode && (
            <Tooltip label="Select parent" side="bottom" align="end">
              <Button
                variant="bare"
                size="icon-sm"
                className="size-[22px] text-ink-faint hover:bg-paper-deep hover:text-ink"
                aria-label="Select parent"
                onClick={() =>
                  useStore.getState().setSelectedElement({ frameId: frame.id, selector: parentNode.selector })
                }
              >
                <ArrowUpIcon className="size-3.5" />
              </Button>
            </Tooltip>
          )}
        </div>
        <PanelTabPanel value="design">
          <PanelBody>
            {info ? (
              <DesignTab info={info} apply={apply} />
            ) : stale ? (
              <div aria-busy className="pointer-events-none opacity-50" title="Reading the element…">
                <DesignTab info={stale} apply={apply} />
              </div>
            ) : (
              <Waiting />
            )}
          </PanelBody>
        </PanelTabPanel>
        <PanelTabPanel value="html">
          <HtmlTab key={selector} frame={frame} selector={selector} />
        </PanelTabPanel>
      </PanelTabsRoot>
    </Panel>
  )
}

function Waiting() {
  return <div className="px-3 py-6 text-center text-[12px] text-ink-faint">Reading the element…</div>
}

/* ---- Design tab ---- */

const DISPLAYS: { value: string; label: string }[] = [
  { value: 'block', label: 'block' },
  { value: 'flex-row', label: 'flex · row' },
  { value: 'flex-column', label: 'flex · column' },
  { value: 'grid', label: 'grid' },
  { value: 'inline-block', label: 'inline-block' },
  { value: 'inline-flex', label: 'inline-flex' },
  { value: 'inline', label: 'inline' },
  { value: 'none', label: 'none' },
]
const POSITIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky']
const WEIGHTS = ['300', '400', '500', '600', '700', '800']
const ALIGNS = [
  { value: 'left', label: 'Align left', Icon: AlignLeftIcon },
  { value: 'center', label: 'Align center', Icon: AlignCenterIcon },
  { value: 'right', label: 'Align right', Icon: AlignRightIcon },
  { value: 'justify', label: 'Justify', Icon: AlignJustifyIcon },
]
const SYSTEM_FONTS = [
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'ui-monospace, monospace', label: 'Monospace' },
]

function fontName(value: string) {
  return (
    value
      .match(/^(?:"([^"]+)"|'([^']+)'|([^,]+))/)
      ?.slice(1)
      .find(Boolean)
      ?.trim() ?? value
  )
}

/** Keep the current stack intact, and offer fonts already supplied by the
 *  frame alongside system faces that need no additional font download. */
function fontOptions(info: ElementInfo) {
  const seen = new Set<string>()
  return [
    ...[info.fontFamily, ...info.fontFamilies].map((value) => ({
      value,
      label: fontName(value),
    })),
    ...SYSTEM_FONTS,
  ].filter(({ value }) => {
    const family = fontName(value).toLowerCase()
    if (seen.has(family)) return false
    seen.add(family)
    return true
  })
}
const SIZE_MODES: { value: SizeMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fill', label: 'Fill' },
  { value: 'hug', label: 'Hug' },
]

function displayValue(info: ElementInfo): string {
  if (info.display === 'flex') return info.flexDirection.startsWith('column') ? 'flex-column' : 'flex-row'
  return DISPLAYS.some((d) => d.value === info.display) ? info.display : 'block'
}

function parentLayout(info: ElementInfo): string {
  const p = info.parent
  if (!p) return ''
  if (p.display === 'grid' || p.display === 'inline-grid') return 'grid'
  if (p.display === 'flex' || p.display === 'inline-flex') return `flex ${p.flexDirection.replace('-reverse', '')}`
  return p.display
}

function DesignTab({ info, apply }: { info: ElementInfo; apply: (styles: StylePatch) => void }) {
  const visible = info.visibility !== 'hidden'
  const fill = rgbToHex(info.backgroundColor)
  const borderColor = rgbToHex(info.borderColor)
  const gapMixed = info.rowGap !== info.columnGap
  const border = borderSummary(info.borderWidths)
  const textAlign =
    info.textAlign === 'start'
      ? info.direction === 'rtl'
        ? 'right'
        : 'left'
      : info.textAlign === 'end'
        ? info.direction === 'rtl'
          ? 'left'
          : 'right'
        : info.textAlign
  function setSize(axis: 'width' | 'height', mode: SizeMode) {
    if (mode === 'fixed') apply({ [axis]: `${info[axis] ?? 0}px` })
    else if (mode === 'fill') apply({ [axis]: '100%' })
    else apply({ [axis]: null })
  }
  return (
    <>
      <PropertySection title="Position">
        <PropertyRow label="Type">
          <SelectField
            value={info.position}
            options={POSITIONS.map((p) => ({ value: p, label: p }))}
            onChange={(v) => apply({ position: v === 'static' ? null : v })}
          />
        </PropertyRow>
        <PropertyRow label="Order">
          <StaticField>
            {info.index}
            <FieldUnit>
              of {info.count}
              {parentLayout(info) && ` · ${parentLayout(info)}`}
            </FieldUnit>
          </StaticField>
        </PropertyRow>
      </PropertySection>
      <PropertySection title="Size">
        <PropertyRow label="Width">
          <NumberField value={info.width} unit="px" onCommit={(v) => apply({ width: `${v}px` })} />
          <SelectField
            className="flex-[0_0_66px]"
            value={sizeMode(info.inline['width'])}
            options={SIZE_MODES}
            onChange={(v) => setSize('width', v)}
          />
        </PropertyRow>
        <PropertyRow label="Height">
          <NumberField value={info.height} unit="px" onCommit={(v) => apply({ height: `${v}px` })} />
          <SelectField
            className="flex-[0_0_66px]"
            value={sizeMode(info.inline['height'])}
            options={SIZE_MODES}
            onChange={(v) => setSize('height', v)}
          />
        </PropertyRow>
        <PropertyRow label="Min width">
          <TextField
            value={info.inline['min-width'] ?? (info.minWidth === '0px' ? '' : info.minWidth)}
            placeholder="auto"
            onCommit={(v) => apply({ 'min-width': lengthValue(v) })}
          />
        </PropertyRow>
      </PropertySection>
      <PropertySection title="Layout">
        <PropertyRow label="Display">
          <SelectField
            value={displayValue(info)}
            options={DISPLAYS}
            onChange={(v) =>
              v.startsWith('flex-')
                ? apply({ display: 'flex', 'flex-direction': v === 'flex-column' ? 'column' : 'row' })
                : apply({ display: v, 'flex-direction': null })
            }
          />
        </PropertyRow>
        <PropertyRow label="Gap">
          <NumberField
            value={info.rowGap ?? 0}
            unit={gapMixed ? 'row' : 'px'}
            onCommit={(v) => apply({ gap: `${v}px` })}
          />
          <TextField
            className="flex-[0_0_78px]"
            value={compactBox(info.padding)}
            unit="pad"
            onCommit={(v) => apply({ padding: shorthandValue(v) })}
          />
        </PropertyRow>
      </PropertySection>
      <PropertySection title="Styles">
        <PropertyRow label="Opacity">
          <NumberField
            className="flex-[0_0_52px]"
            value={info.opacity === null ? null : Math.round(info.opacity * 100)}
            unit="%"
            onCommit={(v) => apply({ opacity: String(Math.min(100, Math.max(0, v)) / 100) })}
          />
          <input
            type="range"
            min={0}
            max={100}
            aria-label="Opacity"
            className="h-6 min-w-0 flex-1 accent-ink"
            value={info.opacity === null ? 100 : Math.round(info.opacity * 100)}
            onChange={(e) => apply({ opacity: String(Number(e.target.value) / 100) })}
          />
        </PropertyRow>
        <PropertyRow label="Visible">
          <ToggleField
            value={visible}
            labels={['Yes', 'No']}
            onChange={(on) => apply({ visibility: on ? null : 'hidden' })}
          />
        </PropertyRow>
        <PropertyRow label="Fill">
          <ColorField value={fill} onCommit={(v) => apply({ 'background-color': v ?? 'transparent' })} />
        </PropertyRow>
        <PropertyRow label="Border">
          <ColorField
            value={borderColor}
            onCommit={(v) =>
              apply({ 'border-color': v, ...(v && info.borderStyle === 'none' ? { 'border-style': 'solid' } : {}) })
            }
          />
          <NumberField
            className="flex-[0_0_78px]"
            value={border.width}
            unit={border.sides || 'px'}
            onCommit={(v) =>
              apply({
                'border-width': `${v}px`,
                ...(v > 0 && info.borderStyle === 'none' ? { 'border-style': 'solid' } : {}),
              })
            }
          />
        </PropertyRow>
        <PropertyRow label="Radius">
          <NumberField value={info.borderRadius} unit="px" onCommit={(v) => apply({ 'border-radius': `${v}px` })} />
        </PropertyRow>
      </PropertySection>
      {info.hasText && (
        <PropertySection title="Text">
          <PropertyRow label="Font">
            <SelectField
              label="Font family"
              value={info.fontFamily}
              options={fontOptions(info)}
              onChange={(v) => apply({ 'font-family': v })}
            />
          </PropertyRow>
          <PropertyRow label="Size">
            <NumberField value={info.fontSize} unit="px" onCommit={(v) => apply({ 'font-size': `${v}px` })} />
            <SelectField
              className="flex-[0_0_66px]"
              value={WEIGHTS.includes(info.fontWeight) ? info.fontWeight : '400'}
              options={WEIGHTS.map((w) => ({ value: w, label: w }))}
              onChange={(v) => apply({ 'font-weight': v })}
            />
          </PropertyRow>
          <PropertyRow label="Color">
            <ColorField value={rgbToHex(info.color)} onCommit={(v) => apply({ color: v })} />
          </PropertyRow>
          <PropertyRow label="Align">
            <Segmented
              aria-label="Text alignment"
              className="w-full gap-1 rounded-none bg-transparent p-0"
              value={textAlign}
              onValueChange={(v) => apply({ 'text-align': v })}
            >
              {ALIGNS.map(({ value, label, Icon }) => (
                <SegmentedItem
                  key={value}
                  value={value}
                  aria-label={label}
                  title={label}
                  className="grid h-[26px] min-h-0 flex-1 place-items-center rounded-[6px] bg-sub p-0 hover:bg-paper-deep sm:flex-1"
                >
                  <Icon size="rail" />
                </SegmentedItem>
              ))}
            </Segmented>
          </PropertyRow>
        </PropertySection>
      )}
    </>
  )
}

/* ---- HTML tab ---- */

function HtmlTab({ frame, selector }: { frame: Frame; selector: string }) {
  const source = useMemo(() => elementHtml(frame.html, selector) ?? '', [frame.html, selector])
  const [draft, setDraft] = useState(source)
  const [typing, setTyping] = useState(false)
  /* the save waiting for the typing to pause; flushed when the editor goes
     away so a quick switch to another row neither loses nor delays the edit */
  const pendingSave = useRef<{ timer: number; run: () => void } | null>(null)
  useEffect(
    () => () => {
      if (!pendingSave.current) return
      window.clearTimeout(pendingSave.current.timer)
      pendingSave.current.run()
    },
    [],
  )
  /* remote html changes replace the draft unless the person is typing */
  const [seen, setSeen] = useState(source)
  if (seen !== source) {
    setSeen(source)
    if (!typing) setDraft(source)
  }

  function onChange(value: string) {
    setDraft(value)
    if (pendingSave.current) window.clearTimeout(pendingSave.current.timer)
    const run = () => {
      pendingSave.current = null
      const live = useStore.getState().canvas?.frames.find((f) => f.id === frame.id) ?? frame
      replaceLayerHtml(live, selector, value)
    }
    pendingSave.current = { timer: window.setTimeout(run, HTML_SAVE_DELAY_MS), run }
  }

  return (
    <Textarea
      variant="code"
      className="min-h-[320px] flex-1"
      value={draft}
      spellCheck={false}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
