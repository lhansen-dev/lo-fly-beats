import { useEffect, useState } from 'react'
import { loadCircuit } from '../connectome/load'
import { CircuitError } from '../connectome/types'
import type { CircuitGraph } from '../connectome/types'

let circuitRequest: Promise<CircuitGraph> | undefined

export default function App() {
  const [status, setStatus] = useState('Loading the fly-brain wiring…')

  useEffect(() => {
    let active = true
    circuitRequest ??= loadCircuit(import.meta.env.BASE_URL)
    void circuitRequest.then(
      graph => {
        if (active) setStatus(`Circuit ready: ${graph.neurons.size} neurons, ${graph.manifest.counts.connections} connections`)
      },
      error => {
        if (active) setStatus(`The fly-brain data couldn't be loaded: ${error instanceof CircuitError ? error.code : 'unknown'} — ${error instanceof Error ? error.message : String(error)}`)
      },
    )
    return () => { active = false }
  }, [])

  return (
    <main>
      <h1>Lo-fly beats</h1>
      <p>Beats to relax / repeatedly fly into the same window to</p>
      <p data-testid="circuit-status" role="status">{status}</p>
    </main>
  )
}
