import { useAppState } from '../app/store'

const engineLabels = {
  idle: 'Ready to listen', starting: 'Starting', playing: 'Playing', paused: 'Paused',
  interrupted: 'Audio interrupted', exporting: 'Paused for export',
}
const exportLabels = {
  idle: '', preparing: 'Preparing export', rendering: 'Rendering export',
  encoding: 'Encoding WAV', ready: 'WAV ready to download', error: 'Export failed',
}

export default function PlaybackStatus() {
  const status = useAppState(state => state.engineStatus)
  const notice = useAppState(state => state.audioNotice)
  const exportState = useAppState(state => state.exportState)
  const exportText = exportLabels[exportState.status]
  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="playback-status">
    {notice ?? engineLabels[status]}{exportText && `. ${exportText}`}{exportState.message && `. ${exportState.message}`}
  </p>
}
