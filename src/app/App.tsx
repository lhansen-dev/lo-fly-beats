import { useEffect, useState } from 'react'
import { loadCircuit } from '../connectome/load'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'
import { PRESETS, DEFAULT_PRESET_ID } from '../presets/presets'
import type { PresetId } from '../presets/types'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { DEFAULT_SESSION_SEED } from '../music/versions'
import { randomSessionSeed } from './seed'
import { DEFAULT_MIX } from '../audio/rig'
import type { EngineStatus } from '../audio/engine'
import DiagnosticsPanel from '../components/DiagnosticsPanel'

let circuitRequest: Promise<CircuitGraph> | undefined

export default function App() {
  const [graph, setGraph] = useState<CircuitGraph | null>(null)
  const [circuitStatus, setCircuitStatus] = useState('Loading the fly-brain wiring…')
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID)
  const [seed, setSeed] = useState(DEFAULT_SESSION_SEED)
  const [variation, setVariation] = useState(0)
  const [tempo, setTempo] = useState(PRESETS[DEFAULT_PRESET_ID].tempoBpm)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle')
  const [position, setPosition] = useState({ phrase: 1, bar: 1, beat: 1 })
  const [score, setScore] = useState<PhraseScore | null>(null)
  const [trace, setTrace] = useState<string[]>([])
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof import('../audio/engine').getEngine>> | null>(null)
  const debugMode = new URLSearchParams(window.location.search).get('debug') === '1'

  useEffect(() => {
    let active = true
    circuitRequest ??= loadCircuit(import.meta.env.BASE_URL)
    void circuitRequest.then(g => { if (active) { setGraph(g); setCircuitStatus(`Circuit ready: ${g.neurons.size} neurons, ${g.manifest.counts.connections} connections`) } }, e => {
      if (active) setCircuitStatus(`The fly-brain data couldn't be loaded: ${e instanceof CircuitError ? e.code : 'unknown'} — ${e instanceof Error ? e.message : String(e)}`)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!engine) return
    const off = [
      engine.on('status', setEngineStatus),
      engine.on('phraseStarted', ({ score: next }) => { setScore(next); setTrace([]) }),
      engine.on('position', p => {
        setPosition({ phrase: p.phraseIndex + 1, bar: p.bar + 1, beat: p.beat + 1 })
        if (score) {
          const index = p.bar * 4 + p.beat
          if (index < score.trace.length) setTrace(previous => [...previous, JSON.stringify(score.trace[index])].slice(-8))
        }
      }),
    ]
    return () => off.forEach(unsubscribe => unsubscribe())
  }, [engine, score])

  function recipe(): SessionRecipe { return { recipeVersion: 1, presetId, sessionSeed: seed, variation: variation / 100, tempoBpm: tempo } }
  async function startRestart() {
    if (!graph) return
    const { getEngine } = await import('../audio/engine')
    const instance = getEngine()
    setEngine(instance)
    const status = instance.getDiagnostics().status
    if (status === 'idle') {
      await instance.start(graph, recipe(), DEFAULT_MIX)
      return
    }
    if (status === 'playing') instance.pause()
    instance.reset(recipe())
    instance.play()
  }
  async function togglePlayback() {
    if (!engine) return
    if (engineStatus === 'playing') engine.pause()
    else engine.play()
  }

  return <main>
    <h1>Lo-fly beats</h1><p>Beats to relax / repeatedly fly into the same window to</p>
    <p data-testid="circuit-status" role="status">{circuitStatus}</p>
    <label>Preset <select data-testid="preset-select" value={presetId} onChange={e => { const id = e.target.value as PresetId; setPresetId(id); setTempo(PRESETS[id].tempoBpm) }}>{Object.entries(PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select></label>
    <label>Seed <input type="number" data-testid="seed-input" value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>{' '}
    <button data-testid="random-seed" type="button" onClick={() => setSeed(randomSessionSeed())}>Random seed</button>
    <label>Variation <input type="range" data-testid="variation" min="0" max="100" step="1" value={variation} onChange={e => setVariation(Number(e.target.value))} /><output>{variation}</output></label>
    <label>Tempo <input type="range" data-testid="tempo" min="60" max="100" step="1" value={tempo} onChange={e => setTempo(Number(e.target.value))} /><output>{tempo}</output></label>
    <button data-testid="start-restart" type="button" disabled={!graph || engineStatus === 'starting'} onClick={() => { void startRestart() }}>Start / Restart</button>{' '}
    <button data-testid="play-toggle" type="button" disabled={!engine || engineStatus === 'starting'} onClick={() => { void togglePlayback() }}>{engineStatus === 'playing' ? 'Pause' : 'Play'}</button>
    <p>Engine: <span data-testid="engine-status">{engineStatus}</span></p>
    <p data-testid="position">Phrase {position.phrase} · Bar {position.bar} · Beat {position.beat}</p>
    <p data-testid="chords">{score?.chords.map(chord => chord.symbol).join(' · ') ?? ''}</p>
    <pre data-testid="trace">{trace.join('\n')}</pre>
    {debugMode && <DiagnosticsPanel getDiagnostics={() => engine?.getDiagnostics() ?? null} />}
  </main>
}
