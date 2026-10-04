import { describe, expect, it } from 'vitest'
import { appReducer, createInitialState } from '../../../src/app/state'
import { createStore } from '../../../src/app/store'
import { composePhrase } from '../../../src/music/compose'
import { subscribeBarSamples } from '../../../src/components/explanation/recentChoices'
import { fixtureGraph } from '../helpers/fixtureGraph'

describe('recent choices sampler', () => {
  it('samples once per bar and keeps the most recent trace steps', () => {
    const store = createStore(appReducer, createInitialState(null))
    const score = composePhrase(fixtureGraph(), { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0.5, tempoBpm: 72 }, 0)
    const samples: Array<Array<{ beat: number }>> = []
    const unsubscribe = subscribeBarSamples(store, steps => samples.push(steps))
    expect(samples).toEqual([])
    store.dispatch({ type: 'phraseStarted', score })
    expect(samples).toHaveLength(1)
    expect(samples[0]).toHaveLength(1)
    expect(samples[0][0].beat).toBe(0)
    for (const beat of [1, 2, 3]) store.dispatch({ type: 'positionChanged', position: { phraseIndex: 0, bar: 0, beat } })
    expect(samples).toHaveLength(1)
    store.dispatch({ type: 'positionChanged', position: { phraseIndex: 0, bar: 1, beat: 0 } })
    expect(samples[1].map(step => step.beat)).toEqual([4, 3, 2, 1, 0])
    store.dispatch({ type: 'positionChanged', position: { phraseIndex: 0, bar: 3, beat: 0 } })
    expect(samples[2]).toHaveLength(8)
    expect(samples[2].map(step => step.beat)).toEqual([12, 11, 10, 9, 8, 7, 6, 5])
    store.dispatch({ type: 'positionChanged', position: { phraseIndex: score.phraseIndex + 1, bar: 4, beat: 0 } })
    expect(samples).toHaveLength(3)
    unsubscribe()
    store.dispatch({ type: 'positionChanged', position: { phraseIndex: 0, bar: 4, beat: 0 } })
    expect(samples).toHaveLength(3)
  })
})
