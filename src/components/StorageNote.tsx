import { useAppState } from '../app/store'

export default function StorageNote() {
  const storageAvailable = useAppState(state => state.ui.storageAvailable)
  return storageAvailable === false
    ? <p data-testid="storage-note">{"Settings won't be remembered in this browser."}</p>
    : null
}
