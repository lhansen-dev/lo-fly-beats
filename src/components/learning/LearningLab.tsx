import { useEffect, useRef, useState } from 'react'
import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'
import { createExportSnapshot, renderPhrase } from '../../audio/export'
import type { MixSettings } from '../../audio/rig'
import { encodeWav16 } from '../../audio/wav'
import type { CircuitGraph } from '../../connectome/types'
import { buildPhrasePlan } from '../../music/compose'
import { buildReservoirGraph } from '../../music/learning/graph'
import { loadLearningCircuit } from '../../music/learning/load'
import { createReservoirModel, type ReservoirModel } from '../../music/learning/reservoir'
import { commitPhrase, createLearningSnapshot, preparePhrase, resetLearningContext } from '../../music/learning/session'
import type { CommittedLearningPhrase, PreparedLearningPhrase } from '../../music/learning/types'
import type { PhraseScore, SessionRecipe } from '../../music/types'
import { getPreset } from '../../presets/presets'

function PhraseAudition({ score, recipe, mix }: { score: PhraseScore; recipe: SessionRecipe; mix: MixSettings }) {
  const controller = useController()
  const playing = useAppState(state => state.engineStatus === 'playing')
  const [status, setStatus] = useState('Ready to render this captured score.')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const resource = useRef<{ mounted: boolean; url: string | null }>({ mounted: false, url: null })
  useEffect(() => {
    const current = resource.current
    current.mounted = true
    return () => {
      current.mounted = false
      if (current.url) URL.revokeObjectURL(current.url)
    }
  }, [])
  const audition = async () => {
    if (busy) return
    const snapshot = createExportSnapshot(score, recipe, getPreset(score.presetId), mix)
    setBusy(true)
    setStatus('Rendering the captured learning phrase…')
    try {
      const data = await renderPhrase(snapshot)
      if (!resource.current.mounted) return
      const nextUrl = URL.createObjectURL(new Blob([encodeWav16(data)], { type: 'audio/wav' }))
      if (resource.current.url) URL.revokeObjectURL(resource.current.url)
      resource.current.url = nextUrl
      setUrl(nextUrl)
      setStatus('Ready to play or download. Rendering preserved model memory.')
    } catch (error) {
      if (resource.current.mounted) setStatus(`Rendering failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (resource.current.mounted) setBusy(false)
    }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => { void audition() }}>Render audition WAV</button>
    <p role="status">{status}</p>
    {url && <>
      <audio controls src={url} aria-label="Learning phrase audition" onPlay={() => { if (playing) controller.togglePlay() }} />{' '}
      <a href={url} download={`lofly-learning-${score.presetId}-phrase-${score.phraseIndex}.wav`}>Download learning WAV</a>
    </>}
  </div>
}

function PhraseExperiment({ graph, model, recipe, mix }: { graph: CircuitGraph; model: ReservoirModel; recipe: SessionRecipe; mix: MixSettings }) {
  const [state, setState] = useState(() => ({
    parent: createLearningSnapshot(graph.checksum, model),
    prepared: null as PreparedLearningPhrase | null,
    committed: null as CommittedLearningPhrase | null,
    recipe: { ...recipe }, phraseIndex: 0,
  }))
  const recipeChanged = state.recipe.sessionSeed !== recipe.sessionSeed || state.recipe.presetId !== recipe.presetId
  const preparedIsCurrent = !recipeChanged && state.prepared?.score.variation === recipe.variation
  const prepare = () => {
    const parent = recipeChanged ? resetLearningContext(state.parent) : state.parent
    const phraseIndex = state.recipe.sessionSeed !== recipe.sessionSeed ? 0 : state.phraseIndex
    const prepared = preparePhrase(buildPhrasePlan(graph, recipe, phraseIndex), parent, model)
    setState({ ...state, parent, prepared, recipe: { ...recipe }, phraseIndex })
  }
  const adopt = () => {
    if (!state.prepared || !preparedIsCurrent) return
    const committed = commitPhrase(state.prepared, state.parent, state.prepared.requestId)
    if (committed) setState({ ...state, parent: committed.nextSnapshot, committed, prepared: null, phraseIndex: state.phraseIndex + 1 })
  }
  const current = state.prepared ?? state.committed
  const decisions = current?.score.learning?.bassDecisions
  const activity = state.prepared?.endingRuntime.activations ?? state.parent.runtime.activations

  return <section aria-labelledby="learning-lab-title" data-testid="learning-lab">
    <h2 id="learning-lab-title">MBON activity experiment</h2>
    <p>Fixed MBON reservoir with an untrained decoder. Prepare and adopt phrases manually, then audition a captured score with the current tempo and mix.</p>
    <p>{model.graph.neuronIds.length} modeled neurons, {model.graph.incoming.reduce((sum, row) => sum + row.length, 0)} retained connections. Model seed: {model.modelSeed}.</p>
    <button type="button" onClick={prepare}>Prepare next phrase</button>{' '}
    <button type="button" disabled={!state.prepared || !preparedIsCurrent} onClick={adopt}>Adopt prepared phrase</button>
    <p role="status">{state.prepared ? (preparedIsCurrent ? 'Prepared; memory has not advanced.' : 'Recipe changed; prepare a replacement.') : 'Ready to prepare.'}</p>
    <p>Adopted phrases: {state.parent.runtime.generationIndex}. Previous bass action for the next phrase: {state.parent.runtime.previousBassAction ?? 'none'}. Recent actions: {state.parent.runtime.recentActions.length}. Model revision: {state.parent.parameters.modelRevision}.</p>
    <p>Activity range: {Math.min(...activity).toFixed(4)} to {Math.max(...activity).toFixed(4)}. Reservoir checksum: <code>{model.graph.checksum}</code>.</p>
    <p>Accompaniment follows the whole-CNS traversal. Bass comes from a masked nine-action decoder. Its weights are zero: positive variation samples legal actions uniformly; zero variation chooses the first legal action. The variation mixture permits up to 20% uniform exploration once the decoder has nonuniform probabilities.</p>
    {current && <PhraseAudition key={state.prepared?.requestId ?? state.parent.requestRevision} score={current.score}
      recipe={{ ...recipe, presetId: current.score.presetId, sessionSeed: current.score.sessionSeed, variation: current.score.variation }} mix={mix} />}
    {decisions && <ol aria-label="Reservoir decoder bass decisions">{decisions.map(decision => <li key={decision.beat}>
      Bar {Math.floor(decision.beat / 4) + 1}, beat {decision.beat % 4 + 1}: {decision.cellId}
      {decision.forcedRest ? ' (traversal-forced silence; excluded from teaching and accuracy)' : ` (${Math.round(decision.probability * 100)}% selection probability)`}
    </li>)}</ol>}
  </section>
}

export default function LearningLab() {
  const controller = useController()
  const status = useAppState(state => state.circuit.status)
  const recipe = useAppState(state => state.active)
  const mix = useAppState(state => state.mix)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ model: ReservoirModel | null; error: string | null }>({ model: null, error: null })
  useEffect(() => {
    let cancelled = false
    void loadLearningCircuit(import.meta.env.BASE_URL).then(graph => {
      if (!cancelled) setLoaded({ model: createReservoirModel(buildReservoirGraph(graph)), error: null })
    }).catch(error => {
      if (!cancelled) setLoaded({ model: null, error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [attempt])
  if (loaded.error) return <div role="alert">Could not load the learning circuit: {loaded.error}{' '}
    <button type="button" onClick={() => { setLoaded({ model: null, error: null }); setAttempt(attempt + 1) }}>Retry learning circuit</button>
  </div>
  const graph = status === 'ready' ? controller.getGraph() : null
  return graph && loaded.model
    ? <PhraseExperiment graph={graph} model={loaded.model} recipe={recipe} mix={mix} />
    : <p role="status">Loading the accompaniment and experimental MBON circuits…</p>
}
