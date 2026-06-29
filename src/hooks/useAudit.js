import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

// Returns a logger for RHQ actions. Pulls the actor from the signed-in user so
// call sites only pass what happened: audit('Updated operational map').
export function useAudit() {
  const { logAudit } = useData()
  const { user } = useAuth()
  return (action, detail = '') =>
    logAudit({ action, detail, by: user?.name || 'RHQ', byId: user?.idNumber || '' })
}
