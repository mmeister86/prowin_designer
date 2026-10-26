import { useState } from 'react'
import { navigate } from '../App'
import { AgentExecutionPanel } from '../components/AgentExecutionPanel'
import { ImageModelCard } from '../components/ImageModelCard'
import { useAllowance } from '../components/TeamAllowance'
import { AccountSettings } from '../components/AccountSettings'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { AgentKeys } from '../components/AgentKeys'
import { Webhooks } from '../components/Webhooks'
import { AccountMenu } from '../components/DashShell'
import { railLayout } from '../components/AppRail'
import { BellIcon, ChevronLeftIcon, KeyIcon, MoonIcon, SparkIcon, UserIcon } from '../components/ui/icons'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { CardDescription, CardHeader, CardTitle, SettingsCard } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import {
  DashContent,
  DashHeader,
  DashLayout,
  DashMain,
  DashNavItem,
  DashSectionLabel,
  DashSidebar,
  DashSidebarBrand,
  DashSubtitle,
  DashTitle,
} from '../components/ui/dash'

type Pane = 'agent' | 'keys' | 'webhooks' | 'account' | 'appearance'

/* the heading over each pane, and the line under it */
const panes: Record<Pane, { title: string; blurb: string }> = {
  agent: { title: 'Doop Agent', blurb: 'Designunterstützung und lokale Ausführung für Deine Arbeitsflächen.' },
  keys: {
    title: 'Agentenschlüssel',
    blurb: 'Bearer-Zugangsdaten, mit denen Agenten ohne Browser in Deinem Namen gestalten.',
  },
  webhooks: {
    title: 'Webhooks',
    blurb: 'HTTP-Aufrufe an Deine Systeme, wenn auf einer für Dich zugänglichen Arbeitsfläche etwas passiert.',
  },
  account: {
    title: 'Dein Konto',
    blurb: 'Deine Identität auf jeder Arbeitsfläche — und wie Du Dich wieder anmeldest.',
  },
  appearance: {
    title: 'Darstellung',
    blurb: 'So sieht Doop in diesem Browser aus: hell, dunkel oder wie Dein System.',
  },
}

function isPane(value: string | null): value is Pane {
  return value !== null && value in panes
}

/** ?pane= deep-links a section — the connect modal sends people to ?pane=keys. */
function initialPane(): Pane {
  const pane = new URLSearchParams(location.search).get('pane')
  return isPane(pane) ? pane : 'agent'
}

/** Account settings, central agent status and eligible local execution. */
export function Settings() {
  /* the sub-nav switches panes rather than scrolling to an anchor — on a page
     this short an anchor jump looks like nothing happened */
  const [pane, setPane] = useState<Pane>(initialPane)
  const { allowance, refresh } = useAllowance()
  const left = allowance ? Math.max(0, allowance.limit - allowance.used) : 0
  /* arriving from a canvas (the free-tier wall) should not cost you your
     place — only same-origin canvas paths are honoured */
  const from = new URLSearchParams(location.search).get('from')
  const back = from && /^\/c\/[A-Za-z0-9_-]+$/.test(from) ? from : '/'

  const meter = allowance
    ? allowance.localAgent
      ? 'Lokaler Agent ausgewählt — läuft auf Deinem verbundenen Desktop.'
      : allowance.limit <= 0
        ? 'Der Server-Agent ist nicht aktiviert. Wende Dich an die Administration.'
        : left === 0
          ? 'Das Aufgabenkontingent ist aufgebraucht. Wende Dich an die Administration.'
          : `${left.toLocaleString('de-DE')} von ${allowance.limit.toLocaleString('de-DE')} Agentenaufgaben übrig.`
    : null

  return (
    <DashLayout className={railLayout}>
      {/* Settings is its own screen: a rail of its panes, and the way back */}
      <DashSidebar variant="rail">
        <DashSidebarBrand />
        <nav className="flex flex-col gap-0.5">
          <DashNavItem density="rail" icon={<ChevronLeftIcon size="rail" />} onClick={() => navigate(back)}>
            {back === '/' ? 'Zurück zu den Arbeitsflächen' : 'Zurück zur Arbeitsfläche'}
          </DashNavItem>
        </nav>
        <DashSectionLabel density="rail">Einstellungen</DashSectionLabel>
        <nav className="flex flex-col gap-0.5">
          <DashNavItem
            density="rail"
            icon={<SparkIcon size="rail" />}
            active={pane === 'agent'}
            onClick={() => setPane('agent')}
          >
            Doop Agent
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<KeyIcon size="rail" />}
            active={pane === 'keys'}
            onClick={() => setPane('keys')}
          >
            Agentenschlüssel
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<BellIcon size="rail" />}
            active={pane === 'webhooks'}
            onClick={() => setPane('webhooks')}
          >
            Webhooks
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<UserIcon size="rail" />}
            active={pane === 'account'}
            onClick={() => setPane('account')}
          >
            Dein Konto
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<MoonIcon size="rail" />}
            active={pane === 'appearance'}
            onClick={() => setPane('appearance')}
          >
            Darstellung
          </DashNavItem>
        </nav>
        <div className="mt-auto flex items-center gap-2.5 px-1 pt-4">
          <AccountMenu face side="top" align="start" />
        </div>
      </DashSidebar>

      <DashMain className="[background:var(--paper)]">
        <DashHeader variant="bare" className="md:hidden">
          <Button variant="ghost" size="bar" onClick={() => navigate(back)}>
            <ChevronLeftIcon size="rail" /> {back === '/' ? 'Arbeitsflächen' : 'Arbeitsfläche'}
          </Button>
          <span className="flex-1" />
          <AccountMenu />
        </DashHeader>

        <DashContent className="pt-2 md:pt-7">
          <div className="flex items-start gap-4 md:items-end">
            <div>
              <DashTitle>{panes[pane].title}</DashTitle>
              <DashSubtitle>{panes[pane].blurb}</DashSubtitle>
            </div>
          </div>

          <Tabs value={pane} onValueChange={(next) => setPane(next as Pane)} className="mt-4 flex md:hidden">
            <TabsList variant="card">
              <TabsTrigger value="agent">
                <SparkIcon size="rail" /> Doop Agent
              </TabsTrigger>
              <TabsTrigger value="keys">
                <KeyIcon size="rail" /> Agentenschlüssel
              </TabsTrigger>
              <TabsTrigger value="webhooks">
                <BellIcon size="rail" /> Webhooks
              </TabsTrigger>
              <TabsTrigger value="account">
                <UserIcon size="rail" /> Konto
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <MoonIcon size="rail" /> Darstellung
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {pane === 'agent' ? (
            <>
              <SettingsCard>
                <CardHeader>
                  <CardTitle>Doop Agent</CardTitle>
                  <CardDescription>
                    Nutze den zentral verwalteten Designagenten. Creator und Administratoren können auch die lokale
                    Desktop-Ausführung auswählen.
                  </CardDescription>
                  {meter && (
                    <div className="mt-[11px] flex flex-col items-start gap-[7px] text-caption text-ink-faint sm:flex-row sm:items-center sm:gap-2.5">
                      {allowance && allowance.limit > 0 && !allowance.localAgent && (
                        <Progress
                          className="w-[min(100%,240px)] sm:w-[180px]"
                          value={left ?? 0}
                          max={allowance.limit}
                          aria-label="Kostenlose Doop-Agentenaufgaben übrig"
                        />
                      )}
                      <span>{meter}</span>
                    </div>
                  )}
                </CardHeader>
                <AgentExecutionPanel onChange={refresh} />
              </SettingsCard>
              <ImageModelCard />
            </>
          ) : pane === 'keys' ? (
            <AgentKeys />
          ) : pane === 'webhooks' ? (
            <Webhooks />
          ) : pane === 'account' ? (
            <AccountSettings />
          ) : (
            <AppearanceSettings />
          )}
        </DashContent>
      </DashMain>
    </DashLayout>
  )
}
