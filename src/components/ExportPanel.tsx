import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import { exportSeconds } from '../audio/timing'
import Icon from './Icon'

export default function ExportPanel() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const activeScore = useAppState(state => state.activeScore)
  const exportState = useAppState(state => state.exportState)
  const busy = exportState.status === 'preparing' || exportState.status === 'rendering' || exportState.status === 'encoding'

  return <div className="export-panel" data-testid="export-panel">
    <p>About {Math.round(exportSeconds(active.tempoBpm))} seconds: 8 bars at {active.tempoBpm} BPM plus a 2-second tail. Pending changes are not included.</p>
    <button type="button" data-testid="export-button" disabled={activeScore === null || busy} onClick={() => { void controller.exportPhrase() }}><Icon name="download" />Export WAV</button>
    <div hidden={exportState.status === 'idle'}>
      <span data-testid="export-status">{exportState.status}</span>
      {exportState.message && <p>{exportState.message}</p>}
    </div>
    {exportState.status === 'ready' && exportState.url && exportState.fileName && <a data-testid="export-download" href={exportState.url} download={exportState.fileName}>{exportState.fileName}</a>}
    {(exportState.status === 'ready' || exportState.status === 'error') && <button type="button" onClick={() => controller.dismissExport()}>Done</button>}
  </div>
}
