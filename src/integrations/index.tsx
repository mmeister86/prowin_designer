import type { ComponentType } from 'react'
import type { IntegrationsStatus } from '../lib/api'

/**
 * Client extensions, the mirror of `server/extensions.ts`: each integration
 * ships its own card for the Integrations page. The pages iterate `clientIntegrations` and
 * never name an integration — removing one from a build is deleting its
 * folder and its line in the list below.
 */

export interface SettingsCardProps {
  status: IntegrationsStatus
  busy: boolean
  setBusy(busy: boolean): void
  setStatus(status: IntegrationsStatus): void
  showToast(message: string): void
  /** open the shared "Disconnect …?" confirm; the page calls `disconnect` */
  requestDisconnect(): void
}

interface ClientIntegrationBase {
  id: string
  name: string
  /** the integration's mark on a paper tile (step chains, list rows) */
  Tile?: ComponentType<{ size?: number; className?: string }>
  /** body copy of the shared disconnect confirm dialog */
  disconnectCopy: string
  isConnected(status: IntegrationsStatus): boolean
  disconnect(): Promise<IntegrationsStatus>
  SettingsCard: ComponentType<SettingsCardProps>
}

/** An automation-capable integration must bring its own tile — step chains
 *  and list rows would otherwise have nothing honest to show for it. */
export type ClientIntegration =
  | (ClientIntegrationBase & { automationPull?: undefined })
  | (ClientIntegrationBase & {
      Tile: ComponentType<{ size?: number; className?: string }>
      automationPull: {
        /** the add-step tile's line, e.g. "Import what's new in a Figma file." */
        blurb: string
        /** what a pull lands, e.g. "Frames" */
        subtitle: string
        placeholder: string
        /** the source field on the step ('url' for Figma) */
        field: 'url'
      }
    })

export const clientIntegrations: ClientIntegration[] = []
