import { useController } from './ControllerContext'
import { useAppState } from './store'
import { getPreset, PRESETS } from '../presets/presets'
import type { PresetId } from '../presets/types'
import DiagnosticsPanel from '../components/DiagnosticsPanel'

function getPendingChanges(pending: ReturnType<typeof selectPending>): string {
  const changes: string[] = []
  if (pending.presetId) changes.push(`${getPreset(pending.presetId).name} at the next phrase`)
  else if (pending.tempoBpm !== undefined) changes.push(`${pending.tempoBpm} BPM at the next bar`)
  if (pending.variation !== undefined) changes.push(`Variation ${Math.round(pending.variation * 100)} at the next phrase`)
  if (pending.sessionSeed !== undefined) changes.push('New beat at the next phrase')
  return changes.join(' · ')
}

const selectPending = (state: Parameters<Parameters<typeof useAppState>[0]>[0]) => state.pending

export default function App() {
  const controller = useController()
  const circuit = useAppState(state => state.circuit)
  const engineStatus = useAppState(state => state.engineStatus)
  const active = useAppState(state => state.active)
  const pending = useAppState(selectPending)
  const position = useAppState(state => state.position)
  const activeScore = useAppState(state => state.activeScore)
  const debugMode = new URLSearchParams(window.location.search).get('debug') === '1'
  const circuitStatus = circuit.status === 'loading'
    ? 'Loading the fly-brain wiring…'
    : circuit.status === 'ready'
      ? `Circuit ready: ${circuit.manifest!.counts.neurons} neurons, ${circuit.manifest!.counts.connections} connections`
      : `The fly-brain data couldn't be loaded: ${circuit.error!.code} — ${circuit.error!.message}`

  return <main>
    <h1>Lo-fly beats</h1><p>Beats to relax / repeatedly fly into the same window to</p>
    <p data-testid="circuit-status" role="status">{circuitStatus}</p>
    <label>Preset <select data-testid="preset-select" value={pending.presetId ?? active.presetId} onChange={event => controller.selectPreset(event.target.value as PresetId)}>{Object.entries(PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select></label>
    <label>Seed <input type="text" data-testid="seed-input" value={active.sessionSeed} readOnly /></label>{' '}
    <button data-testid="random-seed" type="button" onClick={() => controller.newBeat()}>Random seed</button>
    <label>Variation <input type="range" data-testid="variation" min="0" max="100" step="1" value={Math.round((pending.variation ?? active.variation) * 100)} onChange={event => controller.setVariation(Number(event.target.value) / 100)} /><output>{Math.round((pending.variation ?? active.variation) * 100)}</output></label>
    <label>Tempo <input type="range" data-testid="tempo" min="60" max="100" step="1" value={pending.tempoBpm ?? active.tempoBpm} onChange={event => controller.setTempo(Number(event.target.value))} /><output>{pending.tempoBpm ?? active.tempoBpm}</output></label>
    <p data-testid="pending-changes" role="status">{getPendingChanges(pending)}</p>
    <button data-testid="start-restart" type="button" disabled={circuit.status !== 'ready' || engineStatus === 'starting'} onClick={() => { void controller.startListening() }}>Start listening</button>{' '}
    <button data-testid="play-toggle" type="button" disabled={engineStatus === 'idle' || engineStatus === 'starting'} onClick={() => controller.togglePlay()}>{engineStatus === 'playing' ? 'Pause' : 'Play'}</button>
    <p>Engine: <span data-testid="engine-status">{engineStatus}</span></p>
    <p data-testid="position">Phrase {position.phraseIndex + 1} · Bar {position.bar + 1} · Beat {position.beat + 1}</p>
    <p data-testid="chords">{activeScore?.chords.map(chord => chord.symbol).join(' · ') ?? ''}</p>
    <pre data-testid="trace">{activeScore?.trace.slice(0, position.bar * 4 + position.beat + 1).slice(-8).map(entry => JSON.stringify(entry)).join('\n') ?? ''}</pre>
    {debugMode && <DiagnosticsPanel getDiagnostics={() => controller.getDiagnostics()} />}
  </main>
}
