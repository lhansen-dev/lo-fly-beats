import { useEffect, useRef, useState } from 'react'
import { renderSpikeWav, spikeNotes, startSpike, stopSpike, subscribeSpikeState } from '../audio/spike'
import { loadCircuit } from '../connectome/load'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'

let circuitRequest: Promise<CircuitGraph> | undefined

export default function App() {
  const [graph, setGraph] = useState<CircuitGraph | null>(null)
  const [status, setStatus] = useState('Loading the fly-brain wiring…')
  const [audioState, setAudioState] = useState('inactive')
  const [playing, setPlaying] = useState(false)
  const [operation, setOperation] = useState<'idle' | 'starting' | 'rendering'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const url = useRef<string | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    let active = true
    mounted.current = true
    circuitRequest ??= loadCircuit(import.meta.env.BASE_URL)
    void circuitRequest.then(
      loaded => {
        if (!active) return
        setGraph(loaded)
        setStatus(`Circuit ready: ${loaded.neurons.size} neurons, ${loaded.manifest.counts.connections} connections`)
      },
      loadError => {
        if (active) setStatus(`The fly-brain data couldn't be loaded: ${loadError instanceof CircuitError ? loadError.code : 'unknown'} — ${loadError instanceof Error ? loadError.message : String(loadError)}`)
      },
    )
    const unsubscribe = subscribeSpikeState(setAudioState)
    return () => {
      active = false
      mounted.current = false
      unsubscribe()
      stopSpike()
      if (url.current) URL.revokeObjectURL(url.current)
    }
  }, [])

  async function play() {
    if (!graph || busy.current || playing) return
    busy.current = true
    setOperation('starting')
    setError(null)
    try {
      await startSpike(graph)
      if (mounted.current) setPlaying(true)
      else stopSpike()
    } catch (playError) {
      if (mounted.current) setError(playError instanceof Error ? playError.message : String(playError))
    } finally {
      busy.current = false
      if (mounted.current) setOperation('idle')
    }
  }

  function stop() {
    stopSpike()
    setPlaying(false)
  }

  async function render() {
    if (!graph || busy.current) return
    busy.current = true
    stop()
    setOperation('rendering')
    setError(null)
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = null
    setDownloadUrl(null)
    try {
      const blob = await renderSpikeWav(graph)
      if (!mounted.current) return
      url.current = URL.createObjectURL(blob)
      setDownloadUrl(url.current)
    } catch (renderError) {
      if (mounted.current) setError(renderError instanceof Error ? renderError.message : String(renderError))
    } finally {
      busy.current = false
      if (mounted.current) setOperation('idle')
    }
  }

  return (
    <main>
      <h1>Lo-fly beats</h1>
      <p>Beats to relax / repeatedly fly into the same window to</p>
      <p data-testid="circuit-status" role="status">{status}</p>
      <section aria-labelledby="spike-title">
        <h2 id="spike-title">Audio spike</h2>
        <p>A short phrase following the strongest outgoing connections in the MBON circuit.</p>
        {graph && (
          <table aria-label="Spike traversal">
            <thead><tr><th scope="col">Neuron ID</th><th scope="col">Type</th><th scope="col">MIDI note</th></tr></thead>
            <tbody>{spikeNotes(graph).map((note, index) => (
              <tr key={`${index}-${note.neuronId}`}><td>{note.neuronId}</td><td>{note.type ?? 'Unknown'}</td><td>{note.midi}</td></tr>
            ))}</tbody>
          </table>
        )}
        <p>
          <button type="button" onClick={() => { void play() }} disabled={!graph || playing || operation !== 'idle'}>Play spike</button>{' '}
          <button type="button" onClick={stop} disabled={!playing || operation !== 'idle'}>Stop spike</button>{' '}
          <button type="button" onClick={() => { void render() }} disabled={!graph || operation !== 'idle'}>Render spike WAV</button>
        </p>
        <p>Audio context: <span data-testid="audio-state">{audioState}</span></p>
        <p role="status">{operation === 'starting' ? 'Starting audio…' : operation === 'rendering' ? 'Rendering WAV…' : playing ? 'Playing spike' : 'Playback stopped'}</p>
        {error && <p role="alert">{error}</p>}
        {downloadUrl && <a data-testid="spike-download" href={downloadUrl} download="lofly-spike.wav">Download spike WAV</a>}
      </section>
    </main>
  )
}
