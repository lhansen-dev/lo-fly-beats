import { expect, it } from 'vitest'
import { buildPhrasePlan, renderPhrasePlan } from '../../../../src/music/compose'
import { TEACHING_EXAMPLES } from '../../../../src/music/learning/curriculum'
import { countConstraintViolations, measureMusic, twoBarSequences } from '../../../../src/music/learning/evaluate'
import { fixtureGraph } from '../../helpers/fixtureGraph'

function fixture() {
  const plan = buildPhrasePlan(fixtureGraph(), { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 2001,
    variation: 1, tempoBpm: 72 }, 0)
  // A hand-authored mask gives exactly 31 eligible beats and preserves every strong root.
  plan.trace[1] = { kind: 'rest', neuronId: null, beat: 1, bar: 0, beatInBar: 1, neuronType: null, uses: [] }
  plan.trace = plan.trace.map(step => step.kind === 'rest' && step.beat !== 1 ? {
    ...step, kind: 'start', neuronId: '1',
  } : step)
  const target = TEACHING_EXAMPLES[0]!.cells
  const cells = plan.trace.map(step => step.kind === 'rest' ? 'rest' as const : target[step.beat % 8]!)
  return { plan, target, cells, score: renderPhrasePlan(plan, { cells }) }
}

it('measures a perfect motif with forced silence excluded and no false diversity', () => {
  const { plan, target, cells, score } = fixture()
  expect(measureMusic(plan, score, cells, target)).toEqual({ eligibleBeats: 31, actionAccuracy: 1,
    onsetSimilarity: 1, intervalSimilarity: 1, restFraction: 4 / 31, forcedRestFraction: 1 / 32,
    distinctCellCount: 8, repetitionRate: 1, distinctTwoBarSequences: 1, constraintViolations: 0 })
  expect(new Set(twoBarSequences(plan, cells, target)).size).toBe(1)
})

it('scores a legal onset/pitch substitution without treating it as a hard constraint violation', () => {
  const { plan, target, cells } = fixture()
  cells[3] = 'and-root'
  const score = renderPhrasePlan(plan, { cells })
  const metrics = measureMusic(plan, score, cells, target)
  expect(metrics.actionAccuracy).toBeCloseTo(30 / 31, 12)
  expect(metrics.onsetSimilarity).toBeLessThan(1)
  expect(metrics.intervalSimilarity).toBeLessThan(1)
  expect(metrics.constraintViolations).toBe(0)
  expect(metrics.distinctTwoBarSequences).toBe(2)
})

it('detects bad register, duration, overlap, illegal cells and sounding traversal rests', () => {
  const { score, cells } = fixture()
  const invalid = structuredClone(score)
  const bass = invalid.events.filter(note => note.layer === 'bass')
  bass[0]!.midi = 12
  bass[0]!.durationSteps = 129
  cells[0] = 'fifth'
  bass[1]!.traceBeat = 1
  expect(countConstraintViolations(invalid, cells)).toBeGreaterThanOrEqual(5)
})
