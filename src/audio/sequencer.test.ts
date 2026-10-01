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
  const recipes: SessionRecipe[] = []
  const sequencer = new PlaybackSequencer((recipe, phrase) => {
    recipes.push({ ...recipe })
    calls.push(phrase)
    return makeScore(phrase)
  }, recipe)
  return { calls, recipes, sequencer }
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

  it('applies a requested tempo at the next bar', () => {
    const { sequencer } = create()
    for (let i = 0; i < 6; i++) sequencer.advance()
    sequencer.request({ kind: 'tempo', tempoBpm: 90 })
    const plans = Array.from({ length: 10 }, () => sequencer.advance())
    for (const plan of plans.slice(0, 9)) {
      expect(plan.tempoBpm).toBe(72)
      expect(plan.tempoChanged).toBe(false)
      expect(plan.applied).toEqual([])
    }
    const step16 = sequencer.advance()
    expect(step16).toMatchObject({ globalStep: 16, tempoBpm: 90, tempoChanged: true, applied: ['tempo'] })
  })

  it('applies requests made before the first phrase immediately', () => {
    const { recipes, sequencer } = create()
    sequencer.request({ kind: 'variation', variation: 0.5 })
    expect(sequencer.active.variation).toBe(0.5)
    expect(sequencer.pending).toEqual({})
    sequencer.advance()
    expect(recipes[0].variation).toBe(0.5)
  })

  it('applyTempoNow changes the tempo without moving the position', () => {
    const { sequencer } = create()
    for (let i = 0; i < 10; i++) sequencer.advance()
    sequencer.applyTempoNow(90)
    expect(sequencer.active.tempoBpm).toBe(90)
    expect(sequencer.advance()).toMatchObject({ globalStep: 10, stepInPhrase: 10, tempoBpm: 90, tempoChanged: true })
  })

  it('applies a requested variation at the next phrase', () => {
    const { recipes, sequencer } = create()
    for (let i = 0; i < 6; i++) sequencer.advance()
    sequencer.request({ kind: 'variation', variation: 0.5 })
    for (let step = 6; step <= 127; step++) {
      const plan = sequencer.advance()
      expect(plan.applied).toEqual([])
      expect(sequencer.active.variation).toBe(0)
    }
    const plan = sequencer.advance()
    expect(plan.globalStep).toBe(128)
    expect(plan.applied).toEqual(['variation'])
    expect(sequencer.active.variation).toBe(0.5)
    expect(recipes.at(-1)?.variation).toBe(0.5)
  })

  it('applies a requested preset and its tempo at the next phrase and keeps phrase numbering', () => {
    const { calls, recipes, sequencer } = create()
    for (let i = 0; i < 50; i++) sequencer.advance()
    sequencer.request({ kind: 'preset', presetId: 'fruit-bowl-finals', tempoBpm: 86 })
    for (let step = 50; step <= 127; step++) sequencer.advance()
    const plan = sequencer.advance()
    expect(plan).toMatchObject({ globalStep: 128, applied: ['preset'], tempoBpm: 86, tempoChanged: true, phraseIndex: 1 })
    expect(calls.at(-1)).toBe(1)
    expect(recipes.at(-1)?.presetId).toBe('fruit-bowl-finals')
  })

  it('applies a requested New beat at the next phrase and restarts phrase numbering', () => {
    const { calls, recipes, sequencer } = create()
    for (let i = 0; i < 50; i++) sequencer.advance()
    sequencer.request({ kind: 'newBeat', sessionSeed: 99 })
    for (let step = 50; step <= 127; step++) sequencer.advance()
    const plan = sequencer.advance()
    expect(plan).toMatchObject({ globalStep: 128, applied: ['newBeat'], phraseIndex: 0 })
    expect(calls.at(-1)).toBe(0)
    expect(recipes.at(-1)?.sessionSeed).toBe(99)
  })

  it('replaces an earlier request for the same field', () => {
    const { sequencer } = create()
    for (let i = 0; i < 6; i++) sequencer.advance()
    sequencer.request({ kind: 'tempo', tempoBpm: 80 })
    sequencer.request({ kind: 'tempo', tempoBpm: 95 })
    expect(sequencer.pending.tempoBpm).toBe(95)
    for (let step = 6; step <= 15; step++) sequencer.advance()
    expect(sequencer.advance()).toMatchObject({ globalStep: 16, tempoBpm: 95 })
  })

  it('never retains more than two scores', () => {
    const { sequencer } = create()
    for (let i = 0; i < 300; i++) {
      sequencer.advance()
      expect(sequencer.scoresHeld).toBeLessThanOrEqual(2)
    }
  })
})
