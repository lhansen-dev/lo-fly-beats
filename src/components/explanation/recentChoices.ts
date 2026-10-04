import type { AppAction, AppState } from '../../app/state'
import type { Store } from '../../app/store'
import type { PhraseScore, TraceStep } from '../../music/types'

export function selectRecentSteps(
  score: PhraseScore | null,
  position: { phraseIndex: number; bar: number; beat: number },
  count = 8,
): TraceStep[] | null {
  if (score === null || score.phraseIndex !== position.phraseIndex) return null
  return score.trace.slice(0, position.bar * 4 + position.beat + 1).slice(-count).reverse()
}

export function subscribeBarSamples(store: Store<AppState, AppAction>, onSample: (steps: TraceStep[]) => void): () => void {
  let lastScore: PhraseScore | null = null
  let lastBar: number | null = null
  const sample = () => {
    const state = store.getState()
    const steps = selectRecentSteps(state.activeScore, state.position)
    if (steps === null) return
    if (state.activeScore !== lastScore || state.position.bar !== lastBar) {
      lastScore = state.activeScore
      lastBar = state.position.bar
      onSample(steps)
    }
  }
  sample()
  return store.subscribe(sample)
}
