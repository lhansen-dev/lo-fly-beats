import { describe, expect, it } from 'vitest'
import { PlaybackSequencer } from './sequencer'
import type { NoteEvent, PhraseScore, SessionRecipe } from '../music/types'

const recipe: SessionRecipe = {
  recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0, tempoBpm: 72,
}
const notes: NoteEvent[] = [
  { layer: 'keys', step: 0, microOffset: 0, durationSteps: 1, midi: 60, drum: null, velocity: 0.5, traceBeat: null },
  { layer: 'bass', step: 5, microOffset: 0, durationSteps: 1, midi: 36, drum: null, velocity: 0.5, traceBeat: null },
]
const makeScore = (phraseIndex: number): PhraseScore => ({
  scoreVersion: 1, mappingVersion: 1, presetId: recipe.presetId, presetVersion: 1,
  sessionSeed: recipe.sessionSeed, phraseIndex, compositionPhraseIndex: phraseIndex,
  variation: recipe.variation, graphChecksum: '', bars: 8, stepsPerBar: 16,
  chords: [], events: notes, trace: [], fill: false,
})

const create = () => {
  const calls: number[] = []
  const sequencer = new PlaybackSequencer((_recipe, phrase) => {
    calls.push(phrase)
    return makeScore(phrase)
  }, recipe)
  return { calls, sequencer }
}

describe('PlaybackSequencer', () => {
  it('composes once per phrase at the phrase boundary', () => {
    const { calls, sequencer } = create()
    const firstPlan = sequencer.advance()
    expect(firstPlan.tempoChanged).toBe(true)
    for (let i = 1; i < 128; i++) {
      expect(sequencer.advance().tempoChanged).toBe(false)
    }
    expect(calls).toEqual([0])
    expect(sequencer.advance().phraseStarted?.phraseIndex).toBe(1)
    expect(calls).toEqual([0, 1])
  })

  it('returns step events and correct bar and beat', () => {
    const { sequencer } = create()
    const plans = Array.from({ length: 128 }, () => sequencer.advance())
    for (const plan of plans) {
      expect(plan.events.every(event => event.step === plan.stepInPhrase)).toBe(true)
      expect(plan.bar).toBe(Math.floor(plan.stepInPhrase / 16))
      expect(plan.beat).toBe(Math.floor((plan.stepInPhrase % 16) / 4))
    }
    expect(plans[0].events).toEqual([notes[0]])
    expect(plans[5].events).toEqual([notes[1]])
  })

  it('reset starts at step and phrase zero and recomposes', () => {
    const { calls, sequencer } = create()
    sequencer.advance()
    sequencer.advance()
    sequencer.reset(recipe)
    expect(sequencer.currentScore).toBeNull()
    expect(sequencer.scoresHeld).toBe(0)
    const plan = sequencer.advance()
    expect(plan.globalStep).toBe(0)
    expect(plan.phraseIndex).toBe(0)
    expect(plan.stepInPhrase).toBe(0)
    expect(plan.tempoChanged).toBe(true)
    expect(calls).toEqual([0, 0])
  })

  it('never retains more than two scores', () => {
    const { sequencer } = create()
    for (let i = 0; i < 300; i++) {
      sequencer.advance()
      expect(sequencer.scoresHeld).toBeLessThanOrEqual(2)
    }
  })
})
