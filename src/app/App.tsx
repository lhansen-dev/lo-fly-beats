import { useController } from './ControllerContext'
import { useAppState } from './store'
import DiagnosticsPanel from '../components/DiagnosticsPanel'
import NowPlaying from '../components/NowPlaying'
import TransportControls from '../components/TransportControls'
import PresetPicker from '../components/PresetPicker'
import TempoControl from '../components/TempoControl'
import VariationControl from '../components/VariationControl'
import NewBeatButton from '../components/NewBeatButton'
import PendingChanges from '../components/PendingChanges'
import Mixer from '../components/Mixer'
import ExportPanel from '../components/ExportPanel'

export default function App() {
  const controller = useController()
  const circuit = useAppState(state => state.circuit)
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
  const circuitStatus = circuit.status === 'loading'
    ? 'Loading the fly-brain wiring…'
    : circuit.status === 'ready'
      ? `Circuit ready: ${circuit.manifest!.counts.neurons} neurons, ${circuit.manifest!.counts.connections} connections`
      : `The fly-brain data couldn't be loaded: ${circuit.error!.code} — ${circuit.error!.message}`

  return <main>
    <header>
      <h1>Lo-fly beats</h1>
      <p>Beats to relax / repeatedly fly into the same window to</p>
    </header>
    <div data-testid="scene-placeholder" className="scene-placeholder" aria-hidden="true" />
    <p data-testid="circuit-status" role="status">{circuitStatus}</p>
    <NowPlaying />
    <TransportControls />
    <section>
      <PresetPicker />
      <Mixer />
      <TempoControl />
      <VariationControl />
      <NewBeatButton />
      <PendingChanges />
      <ExportPanel />
    </section>
    {debugMode && <DiagnosticsPanel getDiagnostics={() => controller.getDiagnostics()} onSimulateInterruption={() => controller.simulateInterruption()} />}
  </main>
}
