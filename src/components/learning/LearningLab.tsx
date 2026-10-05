import { useState } from 'react'
import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'
import type { CircuitGraph } from '../../connectome/types'
import { buildPhrasePlan } from '../../music/compose'
import { commitPhrase, createLearningSnapshot, preparePhrase, resetLearningContext } from '../../music/learning/session'
import type { CommittedLearningPhrase, PreparedLearningPhrase } from '../../music/learning/types'
import type { SessionRecipe } from '../../music/types'

function PhraseExperiment({ graph, recipe }: { graph: CircuitGraph; recipe: SessionRecipe }) {
  const [state, setState] = useState(() => ({
    parent: createLearningSnapshot(graph.checksum),
    prepared: null as PreparedLearningPhrase | null,
    committed: null as CommittedLearningPhrase | null,
    recipe: { ...recipe }, phraseIndex: 0,
  }))
  const recipeChanged = state.recipe.sessionSeed !== recipe.sessionSeed || state.recipe.presetId !== recipe.presetId
  const preparedIsCurrent = !recipeChanged && state.prepared?.score.variation === recipe.variation
  const prepare = () => {
    const parent = recipeChanged ? resetLearningContext(state.parent) : state.parent
    const phraseIndex = state.recipe.sessionSeed !== recipe.sessionSeed ? 0 : state.phraseIndex
    const prepared = preparePhrase(buildPhrasePlan(graph, recipe, phraseIndex), parent)
    setState({ ...state, parent, prepared, recipe: { ...recipe }, phraseIndex })
  }
  const adopt = () => {
    if (!state.prepared || !preparedIsCurrent) return
    const committed = commitPhrase(state.prepared, state.parent, state.prepared.requestId)
    if (committed) setState({ ...state, parent: committed.nextSnapshot, committed, prepared: null, phraseIndex: state.phraseIndex + 1 })
  }
  const decisions = state.prepared?.score.learning?.bassDecisions ?? state.committed?.score.learning?.bassDecisions

  return <section aria-labelledby="learning-lab-title" data-testid="learning-lab">
    <h2 id="learning-lab-title">Phrase memory experiment</h2>
    <p>Deterministic test selector; no training or reservoir activity yet. This manual experiment uses the current listening recipe. The player continues to use the legacy generator.</p>
    <button type="button" onClick={prepare}>Prepare next phrase</button>{' '}
    <button type="button" disabled={!state.prepared || !preparedIsCurrent} onClick={adopt}>Adopt prepared phrase</button>
    <p role="status">{state.prepared ? (preparedIsCurrent ? 'Prepared; memory has not advanced.' : 'Recipe changed; prepare a replacement.') : 'Ready to prepare.'}</p>
    <p>Adopted phrases: {state.parent.runtime.generationIndex}. Previous bass action for the next phrase: {state.parent.runtime.previousBassAction ?? 'none'}. Recent actions: {state.parent.runtime.recentActions.length}. Model revision: {state.parent.parameters.modelRevision}.</p>
    <p>Accompaniment follows the whole-CNS traversal. Bass decisions below come from the stateful test selector; reservoir checksum is absent until session 2.</p>
    {decisions && <ol aria-label="Test selector bass decisions">{decisions.map(decision => <li key={decision.beat}>
      Bar {Math.floor(decision.beat / 4) + 1}, beat {decision.beat % 4 + 1}: {decision.cellId}
      {decision.forcedRest ? ' (traversal-forced silence; excluded from teaching and accuracy)' : ` (${Math.round(decision.probability * 100)}% selection probability)`}
    </li>)}</ol>}
  </section>
}

export default function LearningLab() {
  const controller = useController()
  const status = useAppState(state => state.circuit.status)
  const recipe = useAppState(state => state.active)
  const graph = status === 'ready' ? controller.getGraph() : null
  return graph ? <PhraseExperiment graph={graph} recipe={recipe} /> : <p>Load the accompaniment circuit to use the phrase memory experiment.</p>
}
