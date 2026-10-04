import { useEffect, useState } from 'react'
import { LOADING_TEXT } from '../../app/copy'
import { useController } from '../../app/ControllerContext'
import { getAppStore, useAppState } from '../../app/store'
import { getPreset } from '../../presets/presets'
import { ENGINE_VERSION, MAPPING_VERSION } from '../../music/versions'
import { selectRecentSteps, subscribeBarSamples } from './recentChoices'
import { describeMappingRules } from './describe'
import RecentChoicesList from './RecentChoicesList'

export default function ExplanationPanel() {
  const manifest = useAppState(state => state.circuit.manifest)
  const score = useAppState(state => state.activeScore)
  const presetId = useAppState(state => state.active.presetId)
  const status = useAppState(state => state.circuit.status)
  const controller = useController()
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState(() => {
    const state = getAppStore().getState()
    return selectRecentSteps(state.activeScore, state.position) ?? []
  })
  useEffect(() => {
    if (!open) return
    return subscribeBarSamples(getAppStore(), setSteps)
  }, [open])
  const graph = status === 'ready' ? controller.getGraph() : null
  const preset = getPreset(presetId)

  return <details data-testid="explanation" className="explanation" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>How the beat is made</summary>
    <section><h2>The circuit</h2>{manifest ? <>
      <h3>{manifest.title}</h3><p>Release: {manifest.source.release}</p>
      <p>{manifest.counts.neurons} neurons, {manifest.counts.connections} connections, {manifest.counts.synapses} synapses</p>
      <p>At least {manifest.extraction.minSynapseCount} synapses</p>
      <p>{manifest.extraction.neuronSelection}</p><p>{manifest.extraction.startNeuronRule}</p>
      <a href="#credits">Credits</a>
    </> : <p>{LOADING_TEXT}</p>}</section>
    <section><h2>Recent choices</h2>{steps.length === 0 || !graph ? <p>Press Start listening to see the walk's choices.</p> : <RecentChoicesList steps={steps} graph={graph} />}</section>
    <section><h2>This phrase's chords</h2>{score ? <ol>{score.chords.map((chord, index) => {
      const slot = score.trace[chord.traceBeat]
      return <li key={`${chord.bar}-${index}`}>{chord.symbol} — Bars {chord.bar + 1}–{chord.bar + 2}; {slot?.neuronType ?? 'an untyped neuron'}; {chord.ringStepped ? 'ring rule stepped' : 'no ring step'}</li>
    })}</ol> : <p>No phrase has been composed yet.</p>}</section>
    <section><h2>Rules we wrote</h2><ul>{describeMappingRules(preset).map(rule => <li key={rule}>{rule}</li>)}</ul></section>
    <section><h2>Versions</h2><p>Mapping version: {MAPPING_VERSION}</p><p>Engine version: {ENGINE_VERSION}</p><p>Preset version: {preset.version}</p><p>Circuit SHA-256: {manifest?.output.sha256.slice(0, 12) ?? '—'}</p></section>
  </details>
}
