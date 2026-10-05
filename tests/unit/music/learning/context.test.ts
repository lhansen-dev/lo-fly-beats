import { describe, expect, it } from 'vitest'
import { buildPhrasePlan } from '../../../../src/music/compose'
import { BASS_VOCABULARY, INPUT_SIZE, legalBassActions, musicalContext } from '../../../../src/music/learning/context'
import { createLearningSnapshot, preparePhrase } from '../../../../src/music/learning/session'
import { learningModel } from './fixture'
import { fixtureGraph } from '../../helpers/fixtureGraph'
import type { SessionRecipe } from '../../../../src/music/types'

const graph = fixtureGraph()
const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0, tempoBpm: 72 }

describe('musical context', () => {
  it('pins the nine-action vocabulary and masks strong, weak, and forced-rest actions', () => {
    expect(BASS_VOCABULARY).toEqual(['root-hold', 'root-push', 'root-octave', 'root-short', 'rest', 'fifth', 'and-root', 'seventh-fifth', 'approach'])
    expect(legalBassActions(0, false)).toEqual([true, true, true, true, false, false, false, false, false])
    expect(legalBassActions(2, false)).toEqual(legalBassActions(0, false))
    expect(legalBassActions(1, false)).toEqual([false, false, false, false, true, true, true, true, true])
    expect(legalBassActions(3, false)).toEqual(legalBassActions(1, false))
    for (let beat = 0; beat < 4; beat++) expect(legalBassActions(beat, true)).toEqual(Array(9).fill(false))
  })

  it('encodes beat, two-bar parity, chord, previous executed action, and traversal rest separately', () => {
    const plan = buildPhrasePlan(graph, recipe, 0)
    plan.chords[0]!.ringIndex = 3
    plan.trace[5] = { kind: 'rest', neuronId: null, beat: 5, bar: 1, beatInBar: 1, neuronType: null, uses: [] }
    const runtime = { ...createLearningSnapshot(graph.checksum, learningModel()).runtime, previousBassAction: 'and-root' as const }
    const context = musicalContext(plan, 5, runtime)
    expect(context).toMatchObject({ beat: 5, beatInBar: 1, barParity: 1, chordRingIndex: 3, previousBassAction: 'and-root', traversalRest: true })
    expect(context.inputs).toHaveLength(INPUT_SIZE)
    expect(context.inputs.map((value, index) => value === 1 ? index : -1).filter(index => index !== -1)).toEqual([1, 5, 9, 18, 21])
    expect(musicalContext(plan, 0, createLearningSnapshot(graph.checksum, learningModel()).runtime).inputs.slice(12, 21)).toEqual(Array(9).fill(0))
    expect(() => musicalContext(plan, 32, runtime)).toThrow('No musical context')
  })

  it('advances forced silence in runtime but excludes it from motif teaching/accuracy eligibility', () => {
    const plan = buildPhrasePlan(graph, recipe, 0)
    plan.trace[1] = { kind: 'rest', neuronId: null, beat: 1, bar: 0, beatInBar: 1, neuronType: null, uses: [] }
    const result = preparePhrase(plan, createLearningSnapshot(graph.checksum, learningModel()), learningModel())
    expect(result.score.learning!.bassDecisions[1]).toMatchObject({ cellId: 'rest', forcedRest: true, probability: 1, legalActionMask: Array(9).fill(false) })
    expect(result.endingMotifs[0]!.eligibleMask[1]).toBe(false)
    expect(result.endingRuntime.contextBeatIndex).toBe(32)
    expect(result.score.events.some(event => event.layer === 'bass' && event.traceBeat === 1)).toBe(false)
  })
})
