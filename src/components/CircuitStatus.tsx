import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function CircuitStatus() {
  const circuit = useAppState(state => state.circuit)
  const controller = useController()
  const text = circuit.status === 'loading'
    ? 'Loading the fly-brain wiring…'
    : circuit.status === 'ready'
      ? `Circuit ready: ${circuit.manifest!.counts.neurons} neurons, ${circuit.manifest!.counts.connections} connections`
      : `The fly-brain data couldn't be loaded: ${circuit.error!.code} — ${circuit.error!.message}`

  return <>
    <p data-testid="circuit-status" role="status">{text}</p>
    {circuit.status === 'error' && <button type="button" data-testid="circuit-retry" onClick={() => { void controller.loadCircuit() }}>Retry</button>}
  </>
}
