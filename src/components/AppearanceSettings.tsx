import { useTheme } from '../lib/theme'
import { ThemePicker } from './ThemePicker'
import { Note } from './ui/note'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'

/** The "Appearance" pane of /settings. The theme is a property of this
 *  browser rather than the account — it is how the device looks, like zoom —
 *  so nothing here touches the server. */
export function AppearanceSettings() {
  const { theme, resolved } = useTheme()
  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Farbschema</CardTitle>
        <CardDescription>
          Hell oder dunkel, auf jeder Arbeitsfläche und Seite in diesem Browser. „System“ folgt Deinem Betriebssystem
          und wechselt mit dessen Einstellung.
        </CardDescription>
      </CardHeader>
      <CardRow label="Darstellung">
        <ThemePicker />
        <Note>
          {theme === 'system'
            ? `Folgt Deinem System — derzeit ${resolved === 'dark' ? 'dunkel' : 'hell'}.`
            : 'Manuell festgelegt — Deine Systemeinstellung wird ignoriert.'}
        </Note>
      </CardRow>
    </SettingsCard>
  )
}
