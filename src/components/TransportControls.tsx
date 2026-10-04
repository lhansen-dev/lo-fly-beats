import { useController } from '../app/ControllerContext'
import { formatPosition } from '../app/format'
import { useAppState } from '../app/store'
import StartListening from './StartListening'
import MasterVolume from './MasterVolume'
import Icon from './Icon'

export default function TransportControls() {
  const controller = useController()
  const engineStatus = useAppState(state => state.engineStatus)
  const position = useAppState(state => state.position)
  const audioNotice = useAppState(state => state.audioNotice)

  return <div className="transport" data-playing={engineStatus === 'playing'}>
    <div className="transport-bar">
      {engineStatus === 'idle' ? <StartListening /> : <button className="play-button" type="button" data-testid="play-toggle" disabled={engineStatus === 'starting' || engineStatus === 'exporting'} onClick={() => controller.togglePlay()}><Icon name={engineStatus === 'playing' ? 'pause' : 'play'} />{engineStatus === 'playing' ? 'Pause' : 'Play'}</button>}
      <MasterVolume />
    </div>
    {audioNotice !== null && <p data-testid="audio-notice">{audioNotice}</p>}
    <div className="transport-info"><p className="engine-label"><span className="status-dot" /><span data-testid="engine-status">{engineStatus}</span></p><p data-testid="position">{formatPosition(position)}</p><div className="bar-indicator" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={i === position.bar ? 'current' : ''} />)}</div></div>
  </div>
}
