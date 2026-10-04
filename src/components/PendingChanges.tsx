import { useAppState } from '../app/store'
import { describePendingChanges } from '../app/format'

export default function PendingChanges() {
  const pending = useAppState(state => state.pending)
  return <p data-testid="pending-changes">{describePendingChanges(pending)}</p>
}
