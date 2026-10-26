import { navigate } from '../App'
import { ConnectModal } from '../components/ConnectModal'
import { Button } from '../components/ui/button'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import { parseCodexSetup } from '../lib/codexConnection'

export function DesktopCodexSetup() {
  const request = parseCodexSetup(location.search, location.origin)
  if (!request) {
    return (
      <AuthScreen>
        <AuthCard title="Öffne den passenden Doop-Server">
          <AuthCardText>
            Dieser Einrichtungslink gehört zu einem anderen Doop-Server oder ist unvollständig. Öffne „KI verbinden“ in
            der Desktop-App für diesen Server oder nutze die manuelle Codex-Einrichtung im Browser.
          </AuthCardText>
          <Button className="self-start" onClick={() => navigate('/')}>
            Zurück zu Doop
          </Button>
        </AuthCard>
      </AuthScreen>
    )
  }
  return (
    <ConnectModal
      initialAgent="codex"
      showAgentStatus={false}
      canvasId={request.canvasId}
      onClose={() => navigate(request.canvasId ? `/c/${request.canvasId}` : '/')}
    />
  )
}
