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
    {score?.brain && <section data-testid="brain-explanation"><h2>Who composed this phrase</h2>
      <p>The fly did. A rate model of {score.brain.circuitId === 'song-v1' ? 'his ear-to-song circuit' : 'a circuit'} (1,771 MaleCNS neurons and 78,710 connections signed by predicted transmitters) updates every sixteenth note. A ticking clock and everything he just played reach it only through his Johnston's organ and wing-sense neurons. Every kick, snare, hat, bass note, chord, keys strike, melody move, and loop choice is then read from the activity of 887 premotor, song, and wing motor neurons, through readout pools tuned to each sixteenth of the bar.</p>
      <p>What learned is that readout: first by listening to an original lofi tutor and anticipating it (school), then by playing alone and being rewarded by an authored critic, bar by bar, with bananas (practice). The wiring itself never changes. He keeps practicing on the phrases he plays for you, and a banana from you reinforces everything in the phrase you liked.</p>
      <p>Honest caveats: the critic and tutor encode our idea of lofi, the dynamics are an engineering model rather than a recording of real neurons, and a control trained with shuffled wiring plays about as well. What his specific wiring adds is described in the experiment report.</p>
    </section>}
    <section><h2>The circuit</h2>{manifest ? <>
      <h3>{manifest.title}</h3><p>Release: {manifest.source.release}</p>
      <p>{manifest.counts.neurons} neurons, {manifest.counts.connections} connections, {manifest.counts.synapses} synapses</p>
      <p>At least {manifest.extraction.minSynapseCount} synapses</p>
      <p>{manifest.extraction.neuronSelection}</p><p>{manifest.extraction.startNeuronRule}</p>
      <a href="#credits">Credits</a>
    </> : <p>{LOADING_TEXT}</p>}</section>
    <section><h2>Recent choices</h2>{score?.brain
      ? (steps.length === 0 ? <p>Press Start listening to hear the fly's choices.</p> : <ul data-testid="brain-recent">{steps.map(step => <li key={step.beat}>Bar {step.bar + 1}, beat {step.beatInBar + 1}: {step.uses.length ? step.uses.join(', ') : 'holding'}; most active song-side neuron {step.neuronType ?? 'untyped'}</li>)}</ul>)
      : steps.length === 0 || !graph ? <p>Press Start listening to see the walk's choices.</p> : <RecentChoicesList steps={steps} graph={graph} />}</section>
    <section><h2>This phrase's chords</h2>{score ? <ol>{score.chords.map((chord, index) => {
      const slot = score.trace[chord.traceBeat]
      return <li key={`${chord.bar}-${index}`}>{chord.symbol} — Bars {chord.bar + 1}–{chord.bar + 2}; {score.brain ? 'chosen by the fly' : <>{slot?.neuronType ?? 'an untyped neuron'}; {chord.ringStepped ? 'ring rule stepped' : 'no ring step'}</>}</li>
    })}</ol> : <p>No phrase has been composed yet.</p>}</section>
    <section><h2>Rules we wrote</h2><ul>{describeMappingRules(preset).map(rule => <li key={rule}>{rule}</li>)}</ul></section>
    <section><h2>Versions</h2><p>Mapping version: {MAPPING_VERSION}</p><p>Engine version: {ENGINE_VERSION}</p><p>Preset version: {preset.version}</p><p>Circuit SHA-256: {graph?.checksum.slice(0, 12) ?? '—'}</p></section>
  </details>
}
