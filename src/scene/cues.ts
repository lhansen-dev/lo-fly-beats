import type { Rng } from '../music/rng'
import { animationRng } from '../music/streams'

export interface CueStepEvent {
  phraseIndex: number
  stepInPhrase: number
  bar: number
  beat: number
}

export interface CueState {
  sessionSeed: number
  rng: Rng
  lastRubPhrase: number | null
  lastPhraseIndex: number | null
}

export function createCueState(sessionSeed: number, rng: Rng = animationRng(sessionSeed)): CueState {
  return { sessionSeed, rng, lastRubPhrase: null, lastPhraseIndex: null }
}

export function stepCue(state: CueState, event: CueStepEvent): { bob: 'strong' | 'soft' | null } {
  void state
  if (event.stepInPhrase % 4 !== 0) return { bob: null }
  return { bob: event.beat === 0 || event.beat === 2 ? 'strong' : 'soft' }
}

export function phraseCue(state: CueState, phraseIndex: number): { rub: boolean } {
  if (state.lastPhraseIndex !== null && phraseIndex <= state.lastPhraseIndex && state.lastRubPhrase !== null) {
    state.lastRubPhrase = phraseIndex - 1 - (state.lastPhraseIndex - state.lastRubPhrase)
  }
  state.lastPhraseIndex = phraseIndex
  if (phraseIndex === 0 || (state.lastRubPhrase !== null && phraseIndex - state.lastRubPhrase <= 2)) {
    return { rub: false }
  }
  if (state.rng.float() < 0.2) {
    state.lastRubPhrase = phraseIndex
    return { rub: true }
  }
  return { rub: false }
}

export function nextBlinkDelayMs(state: CueState): number {
  return 3000 + Math.round(state.rng.float() * 4000)
}

export function rainTimings(sessionSeed: number, count: number): Array<{ delayMs: number; durationMs: number }> {
  const rng = animationRng(sessionSeed)
  return Array.from({ length: count }, () => {
    const durationMs = 3200 + Math.round(rng.float() * 2600)
    const delayMs = Math.round(rng.float() * 2000)
    return { delayMs, durationMs }
  })
}
