import { describe, expect, it } from 'vitest'
import { buildPhrasePlan } from '../../../../src/music/compose'
import { BASS_VOCABULARY } from '../../../../src/music/learning/context'
import { MOTIF_HISTORY_LIMIT, RECENT_ACTION_LIMIT, LEARNER_VERSION } from '../../../../src/music/learning/versions'
import { learningRng } from '../../../../src/music/learning/random'
import { learningModel } from './fixture'
import type { LearningSnapshot } from '../../../../src/music/learning/types'
import { commitPhrase, createLearningSnapshot, preparePhrase as prepareWithModel, resetLearningContext } from '../../../../src/music/learning/session'
import { animationRng, jokesRng } from '../../../../src/music/streams'
import type { PhrasePlan, SessionRecipe } from '../../../../src/music/types'
import { fixtureGraph } from '../../helpers/fixtureGraph'

const graph = fixtureGraph()
const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0, tempoBpm: 72 }
const plan = () => buildPhrasePlan(graph, recipe, 0)
const preparePhrase = (plan: PhrasePlan, snapshot: LearningSnapshot) => prepareWithModel(plan, snapshot, learningModel(snapshot.parameters.modelSeed))

describe('pure reservoir learning session', () => {
  it('prepares repeatably without mutating parameters, runtime, history, or plan; the prepared score is immutable', () => {
    const input = plan()
    const snapshot = createLearningSnapshot(graph.checksum, learningModel())
    const before = structuredClone({ input, snapshot })
    const first = preparePhrase(input, snapshot)
    expect(preparePhrase(input, snapshot)).toEqual(first)
    expect({ input, snapshot }).toEqual(before)
    expect(first.startingSnapshot).toEqual(snapshot)
    expect(first.endingRuntime.generationIndex).toBe(1)
    expect(first.startingSnapshot.runtime.generationIndex).toBe(0)
    expect(Object.isFrozen(first.score.events[0])).toBe(true)
    expect(() => { first.score.events[0]!.velocity = 0 }).toThrow(TypeError)
    expect(first.score.learning).toMatchObject({ learnerVersion: LEARNER_VERSION, modelRevision: 0, reservoirGraphChecksum: learningModel().graph.checksum, selector: 'reservoir-decoder' })
    expect(first.score.trace.every(step => step.uses.every(use => !use.startsWith('bass ')))).toBe(true)
    expect(first.score.learning!.bassDecisions).toHaveLength(32)
  })

  it('carries activity and the last executed action across phrases, including forced rests', () => {
    const input = plan()
    input.chords.forEach(chord => { chord.ringIndex = 0 })
    // One voiced beat then 31 forced rests: last executed action is silence, not the first root.
    input.trace = input.trace.map((step, beat) => beat === 0 ? step : {
      kind: 'rest', neuronId: null, beat, bar: Math.floor(beat / 4), beatInBar: beat % 4, neuronType: null, uses: [],
    })
    const initial = createLearningSnapshot(graph.checksum, learningModel())
    const first = preparePhrase(input, initial)
    expect(first.score.learning!.bassDecisions[0]!.cellId).toBe('root-hold')
    expect(first.endingRuntime.previousBassAction).toBe('rest')
    const adopted = commitPhrase(first, initial, first.requestId)!
    const second = preparePhrase({ ...input, phraseIndex: 1 }, adopted.nextSnapshot)
    const fresh = preparePhrase({ ...input, phraseIndex: 1 }, initial)
    expect(second.endingRuntime.activations).not.toEqual(fresh.endingRuntime.activations)
    expect(second.startingSnapshot.runtime.activations).toEqual(first.endingRuntime.activations)
    expect(fresh.score.learning!.bassDecisions[0]!.cellId).toBe('root-hold')
    // Zero readout weights make greedy ties identical despite different activity.
    expect(second.score.learning!.bassDecisions[0]!.cellId).toBe('root-hold')
    expect(second.endingRuntime.contextBeatIndex).toBe(64)
    expect(second.endingRuntime.generationIndex).toBe(2)
    expect(second.endingRuntime.recentActions.map(action => action.contextBeatIndex)).toEqual([56, 57, 58, 59, 60, 61, 62, 63])
  })

  it('adopts the starting boundary state and keeps ending state explicitly speculative', () => {
    const initial = createLearningSnapshot(graph.checksum, learningModel())
    const prepared = preparePhrase(plan(), initial)
    const adopted = commitPhrase(prepared, initial, prepared.requestId)!
    expect(adopted.score).toBe(prepared.score)
    expect(adopted.startingSnapshot).toEqual(initial)
    expect(adopted.startingSnapshot.runtime.generationIndex).toBe(0)
    expect(adopted.nextSnapshot.runtime).toEqual(prepared.endingRuntime)
    expect(adopted.nextSnapshot.requestRevision).toBe(1)
    const replay = preparePhrase(plan(), adopted.startingSnapshot)
    expect(replay.score).toEqual(prepared.score)
    expect(replay.endingRuntime).toEqual(prepared.endingRuntime)
  })

  it('rejects duplicate adoption, unexpected requests, changed model parents, and stale recipe generations', () => {
    const initial = createLearningSnapshot(graph.checksum, learningModel())
    const prepared = preparePhrase(plan(), initial)
    const adopted = commitPhrase(prepared, initial, prepared.requestId)!
    expect(commitPhrase(prepared, adopted.nextSnapshot, prepared.requestId)).toBeNull()
    expect(commitPhrase(prepared, initial, 'unexpected')).toBeNull()
    const replacement = preparePhrase({ ...plan(), phraseIndex: 1 }, initial)
    expect(replacement.requestId).not.toBe(prepared.requestId)
    expect(commitPhrase(prepared, initial, replacement.requestId)).toBeNull()
    expect(commitPhrase(prepared, { ...initial, parameters: { ...initial.parameters, modelRevision: 1 } }, prepared.requestId)).toBeNull()
    expect(commitPhrase(prepared, { ...initial, runtime: { ...initial.runtime, previousBassAction: 'fifth' } }, prepared.requestId)).toBeNull()
    expect(commitPhrase(prepared, resetLearningContext(initial), prepared.requestId)).toBeNull()
  })

  it('bounds recent histories through repeated phrases and preserves parameters on transient resets', () => {
    let snapshot = createLearningSnapshot(graph.checksum, learningModel(27))
    for (let phraseIndex = 0; phraseIndex < 25; phraseIndex++) {
      const prepared = preparePhrase({ ...plan(), phraseIndex }, snapshot)
      snapshot = commitPhrase(prepared, snapshot, prepared.requestId)!.nextSnapshot
      expect(snapshot.runtime.recentActions.length).toBeLessThanOrEqual(RECENT_ACTION_LIMIT)
      expect(snapshot.recentMotifs.length).toBeLessThanOrEqual(MOTIF_HISTORY_LIMIT)
      expect(snapshot.parameters.trainingUpdateCount).toBe(0)
    }
    const reset = resetLearningContext(snapshot)
    expect(reset.parameters).toEqual(snapshot.parameters)
    expect(reset.recentMotifs).toEqual(snapshot.recentMotifs)
    expect(reset.runtime).toEqual({ activations: Array(97).fill(0), previousBassAction: null, generationIndex: 25, contextBeatIndex: 0, recentActions: [] })
    expect(reset.recipeGeneration).toBe(snapshot.recipeGeneration + 1)
    const afterNewBeat = preparePhrase({ ...plan(), phraseIndex: 0, recipe: { ...recipe, sessionSeed: 99 } }, reset)
    expect(afterNewBeat.endingRuntime.generationIndex).toBe(26)
  })

  it('preserves memory for tempo/variation changes and uses greedy decisions at zero variation', () => {
    const initial = createLearningSnapshot(graph.checksum, learningModel())
    const input = plan()
    const first = preparePhrase(input, initial)
    expect(preparePhrase({ ...input, recipe: { ...recipe, tempoBpm: 99 } }, initial)).toEqual(first)
    expect(first.score.learning!.bassDecisions.every(decision => decision.probability === 1)).toBe(true)
    const changed = preparePhrase({ ...input, recipe: { ...recipe, variation: 1 } }, initial)
    expect(changed.startingSnapshot).toEqual(initial)
    for (const decision of changed.score.learning!.bassDecisions) {
      if (!decision.forcedRest) {
        expect(decision.probability).toBeGreaterThan(0)
        expect(decision.probability).toBeLessThan(1)
        expect(decision.legalActionMask[BASS_VOCABULARY.indexOf(decision.cellId)]).toBe(true)
      }
    }
  })

  it('uses learning RNG streams independent of recipe, animation, jokes, and action purpose', () => {
    const initial = createLearningSnapshot(graph.checksum, learningModel())
    const input = { ...plan(), recipe: { ...recipe, variation: 1 } }
    const expected = preparePhrase(input, initial)
    for (let index = 0; index < 1000; index++) { animationRng(index).float(); jokesRng(index).float() }
    expect(preparePhrase(input, initial)).toEqual(expected)
    const draws = (seed: number, generation: number, purpose: string) => {
      const rng = learningRng(seed, generation, purpose)
      return Array.from({ length: 4 }, () => rng.float())
    }
    expect(draws(1, 2, 'bass')).toEqual(draws(1, 2, 'bass'))
    expect(draws(1, 2, 'bass')).not.toEqual(draws(2, 2, 'bass'))
    expect(draws(1, 2, 'bass')).not.toEqual(draws(1, 3, 'bass'))
    expect(draws(1, 2, 'bass')).not.toEqual(draws(1, 2, 'input-weights'))
  })

  it('rejects accompaniment graphs incompatible with the snapshot', () => {
    expect(() => preparePhrase(plan(), createLearningSnapshot('different checksum', learningModel()))).toThrow('Incompatible accompaniment graph')
  })
})
