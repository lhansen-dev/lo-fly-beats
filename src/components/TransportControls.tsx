import { useController } from '../app/ControllerContext'
import { formatPosition } from '../app/format'
import { useAppState } from '../app/store'
import StartListening from './StartListening'
import MasterVolume from './MasterVolume'

export default function TransportControls() {
  const controller = useController()
  const engineStatus = useAppState(state => state.engineStatus)
  const position = useAppState(state => state.position)
  const audioNotice = useAppState(state => state.audioNotice)

  return <div className="transport">
    <div className="transport-bar">
      {engineStatus === 'idle' ? <StartListening /> : <button type="button" data-testid="play-toggle" disabled={engineStatus === 'starting' || engineStatus === 'exporting'} onClick={() => controller.togglePlay()}>{engineStatus === 'playing' ? 'Pause' : 'Play'}</button>}
      <MasterVolume />
    </div>
    {audioNotice !== null && <p data-testid="audio-notice">{audioNotice}</p>}
    <p>Engine: <span data-testid="engine-status">{engineStatus}</span></p>
    <p data-testid="position">{formatPosition(position)}</p>
  </div>
}
