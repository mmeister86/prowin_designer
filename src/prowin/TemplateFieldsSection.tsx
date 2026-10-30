import { useMemo, useState } from 'react'
import type { Frame } from '../../shared/types'
import {
  TEMPLATE_ROLES,
  brandColorTokenNames,
  extractTemplateFields,
  templateFieldSignature,
  validateTemplateField,
  type TemplateField,
} from '../../shared/prowin/templateAttributes'
import { BRAND_TOKENS } from '../../shared/prowin/brandTokens'
import { useCanvasCapabilities } from './canvasPermissions'
import { templateFieldOf } from '../lib/layers'
import { applyTemplateField, markTemplateField } from '../lib/layerEdits'
import { NumberField, PropertyRow, PropertySection, SelectField, TextField } from '../components/ui/property-field'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'

/** Creator editing of one element's template mark, at the top of the Design
 *  tab. Creators only (`manageLocks`); everyone else sees nothing. Drafts
 *  reset whenever the frame's mark changes under them. */
export function TemplateFieldsSection({ frame, selector }: { frame: Frame; selector: string }) {
  const caps = useCanvasCapabilities(frame.canvasId)
  const field = useMemo(() => templateFieldOf(frame.html, selector), [frame.html, selector])
  const key = `${frame.id}:${selector}:${field ? templateFieldSignature(field) : '∅'}`
  const [draft, setDraft] = useState<TemplateField | null>(field)
  const [errors, setErrors] = useState<string[]>([])
  const [seen, setSeen] = useState(key)
  if (seen !== key) {
    setSeen(key)
    setDraft(field)
    setErrors([])
  }
  if (!caps.manageLocks) return null

  if (!field || !draft) {
    return (
      <PropertySection title="Template-Feld">
        <Button
          variant="bare"
          className="h-[26px] w-full rounded-[7px] bg-sub text-[11.5px] text-ink-soft hover:bg-paper-deep hover:text-ink"
          onClick={() => markTemplateField(frame, selector)}
        >
          Als Template-Feld markieren
        </Button>
      </PropertySection>
    )
  }

  function commit(next: TemplateField) {
    setDraft(next)
    const problems = validateTemplateField(next)
    const taken = new Set(extractTemplateFields(frame.html).map((f) => f.id))
    taken.delete(field!.id)
    if (taken.has(next.id)) problems.push(`Template-ID "${next.id}" ist bereits vergeben.`)
    setErrors(problems)
    if (problems.length) return
    applyTemplateField(frame, selector, next)
  }

  const tokens = brandColorTokenNames()
  return (
    <PropertySection
      title="Template-Feld"
      action={
        <Button
          variant="bare"
          size="icon-sm"
          className="h-5 px-1.5 text-[11px] text-ink-faint hover:text-ink"
          aria-label="Template-Markierung entfernen"
          title="Template-Markierung entfernen"
          onClick={() => applyTemplateField(frame, selector, null)}
        >
          Entfernen
        </Button>
      }
    >
      <PropertyRow label="ID">
        <TextField label="ID" value={draft.id} onCommit={(id) => commit({ ...draft, id: id.trim() })} />
      </PropertyRow>
      <PropertyRow label="Rolle">
        <SelectField
          label="Rolle"
          value={draft.role ?? ''}
          options={[{ value: '', label: 'Keine' }, ...TEMPLATE_ROLES.map((role) => ({ value: role, label: role }))]}
          onChange={(v) => commit({ ...draft, role: (v || null) as TemplateField['role'] })}
        />
      </PropertyRow>
      <PropertyRow label="Bezeichnung">
        <TextField
          label="Bezeichnung"
          value={draft.label ?? ''}
          placeholder="optional"
          onCommit={(label) => commit({ ...draft, label: label.trim() || null })}
        />
      </PropertyRow>
      <label className="mt-1.5 flex h-5 cursor-pointer items-center justify-between text-[11.5px] text-ink-soft">
        Gesperrt
        <Switch
          size="sm"
          aria-label="Gesperrt"
          checked={draft.locked}
          onCheckedChange={(locked) => commit({ ...draft, locked })}
        />
      </label>
      <PropertyRow label="Max. Zeichen">
        <NumberField
          label="Max. Zeichen"
          value={draft.maxLength}
          min={1}
          unit="Zeichen"
          placeholder="∞"
          onCommit={(maxLength) => commit({ ...draft, maxLength })}
        />
        {/* NumberField never commits an empty input, so clearing back to
            unset (leer = ungesetzt) needs its own affordance. */}
        {draft.maxLength !== null && (
          <Button
            variant="bare"
            size="icon-sm"
            className="h-[26px] w-[26px] flex-none rounded-[7px] bg-sub text-[13px] text-ink-faint hover:bg-paper-deep hover:text-ink"
            aria-label="Maximallänge entfernen"
            title="Maximallänge entfernen (unbegrenzt)"
            onClick={() => commit({ ...draft, maxLength: null })}
          >
            ×
          </Button>
        )}
      </PropertyRow>
      <div className="mt-1.5">
        <span className="text-[11.5px] text-ink-faint">Erlaubte Farben</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {tokens.map((name) => {
            const on = draft.allowedColors.includes(name)
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                aria-label={name}
                title={name}
                className={
                  on
                    ? 'flex h-[22px] items-center gap-1 rounded-[7px] bg-ink pr-1.5 pl-1 text-[10.5px] text-paper'
                    : 'flex h-[22px] items-center gap-1 rounded-[7px] bg-sub pr-1.5 pl-1 text-[10.5px] text-ink-soft hover:bg-paper-deep'
                }
                onClick={() =>
                  commit({
                    ...draft,
                    allowedColors: on ? draft.allowedColors.filter((c) => c !== name) : [...draft.allowedColors, name],
                  })
                }
              >
                <span
                  aria-hidden
                  className="size-3 rounded-[3px] border border-line"
                  style={{ background: BRAND_TOKENS[`--${name}` as keyof typeof BRAND_TOKENS] }}
                />
                {name.replace(/^prowin-ci-/, '')}
              </button>
            )
          })}
        </div>
      </div>
      {errors.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {errors.map((error) => (
            <li key={error} className="text-[11px] text-red-600">
              {error}
            </li>
          ))}
        </ul>
      )}
    </PropertySection>
  )
}
