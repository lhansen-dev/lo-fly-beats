import { useController } from '../app/ControllerContext'
import { START_LABEL } from '../app/copy'
import { useAppState } from '../app/store'
import Icon from './Icon'

export default function StartListening() {
  const controller = useController()
  const circuitStatus = useAppState(state => state.circuit.status)
  const engineStatus = useAppState(state => state.engineStatus)
  // The fly needs only his own small brain, so he can start before the whole connectome arrives.
  const flyReady = useAppState(state => state.brain?.status === 'ready')

  return <button className="play-button" type="button" data-testid="start-listening" disabled={(circuitStatus !== 'ready' && !flyReady) || engineStatus === 'starting'} onClick={() => { void controller.startListening() }}><Icon name="play" />{START_LABEL}</button>
}
