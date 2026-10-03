import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function StartListening() {
  const controller = useController()
  const circuitStatus = useAppState(state => state.circuit.status)
  const engineStatus = useAppState(state => state.engineStatus)

  return <button type="button" data-testid="start-listening" disabled={circuitStatus !== 'ready' || engineStatus === 'starting'} onClick={() => { void controller.startListening() }}>Start listening</button>
}
