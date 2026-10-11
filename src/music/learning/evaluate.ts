import { renderPhrasePlan } from '../compose'
import { CHORD_QUALITIES } from '../harmony'
import { STRONG_BASS_CELLS, WEAK_BASS_CELLS, type BassCellId } from '../patterns'
import { createRng } from '../rng'
import type { PhrasePlan, PhraseScore } from '../types'
import { getPreset } from '../../presets/presets'
import { advanceContext, musicalContext } from './context'
import { decodeBassAction, readoutFeatures, type ReadoutFeatures } from './decoder'
import type { ReservoirModel } from './reservoir'
import { freshRuntime } from './session'
import type { LearningRuntime } from './types'

/** Diagnostic graphs have explicit synthetic identities and never replace source circuit data. */
export function connectivityControl(model: ReservoirModel, kind: 'zero' | 'source-permuted'): { model: ReservoirModel; sourcePermutation: readonly number[] } {
  const permutation = model.graph.neuronIds.map((_, index) => index)
  if (kind === 'source-permuted') {
    const rng = createRng('connectivity-control|source-permutation-v1')
    for (let index = permutation.length - 1; index > 0; index--) {
      const other = rng.int(index + 1)
      ;[permutation[index], permutation[other]] = [permutation[other]!, permutation[index]!]
    }
  }
  const incoming = model.graph.incoming.map(row => Object.freeze(row.map(edge => Object.freeze({
    ...edge, sourceIndex: permutation[edge.sourceIndex]!, weight: kind === 'zero' ? 0 : edge.weight,
  }))))
  return { model: Object.freeze({ ...model, graph: Object.freeze({ ...model.graph,
    checksum: `${model.graph.checksum}|control-${kind}-v1`, incoming: Object.freeze(incoming) }) }),
    sourcePermutation: Object.freeze(permutation) }
}

/** Control inference has only musical context and weights, with no curriculum access. */
export function inferReadout(plan: PhrasePlan, model: ReservoirModel, weights: readonly number[], kind: ReadoutFeatures,
  runtime: LearningRuntime = freshRuntime(model.graph.neuronIds.length), variation = plan.recipe.variation) {
  let next = structuredClone(runtime)
  const cells: BassCellId[] = []
  for (let beat = 0; beat < plan.trace.length; beat++) {
    const context = musicalContext(plan, beat, next)
    const { activations, features } = readoutFeatures(model, next, context, kind)
    const decision = decodeBassAction(context, features, weights, variation, model.modelSeed, next.generationIndex)
    cells.push(decision.cellId)
    next = advanceContext({ ...next, activations }, decision)
  }
  return { cells, score: renderPhrasePlan(plan, { cells }), runtime: { ...next, generationIndex: next.generationIndex + 1 } }
}

export interface MusicalMetrics {
  eligibleBeats: number
  actionAccuracy: number
  onsetSimilarity: number
  intervalSimilarity: number
  restFraction: number
  forcedRestFraction: number
  distinctCellCount: number
  repetitionRate: number
  distinctTwoBarSequences: number
  constraintViolations: number
}

function similarity(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a)
  const right = new Set(b)
  const union = new Set([...left, ...right])
  return union.size ? [...left].filter(value => right.has(value)).length / union.size : 1
}

function bassSignatures(score: PhraseScore) {
  const notes = score.events.filter(event => event.layer === 'bass').sort((a, b) => a.step - b.step)
  return { onsets: notes.map(note => String(note.step)), intervals: notes.slice(1).map((note, index) =>
    `${notes[index]!.step}|${note.step}|${note.midi! - notes[index]!.midi!}`) }
}

/** Counts violations of existing hard constraints on the rendered score and action stream. */
export function countConstraintViolations(score: PhraseScore, cells: readonly BassCellId[]): number {
  let violations = 0
  const check = (valid: boolean) => { if (!valid) violations++ }
  const preset = getPreset(score.presetId)
  check(cells.length === score.trace.length)
  for (const step of score.trace) {
    const id = cells[step.beat]
    check(step.kind === 'rest' ? id === 'rest' : (step.beatInBar % 2 === 0 ? STRONG_BASS_CELLS : WEAK_BASS_CELLS).some(cell => cell.id === id))
  }
  const bass = score.events.filter(event => event.layer === 'bass').sort((a, b) => a.step - b.step)
  for (const [index, note] of bass.entries()) {
    const step = score.trace[note.traceBeat!]!
    const chord = score.chords[Math.floor(step.bar / 2)]!
    const quality = CHORD_QUALITIES[preset.chordRing[chord.ringIndex]!.quality]
    const allowed = [chord.rootMidi, chord.rootMidi + quality.third, chord.rootMidi + 7, chord.rootMidi + quality.seventh, chord.rootMidi + 12]
    if (step.beatInBar === 3 && [1, 3, 5].includes(step.bar)) allowed.push(score.chords[Math.floor((step.bar + 1) / 2)]!.rootMidi - 1)
    check(note.midi !== null && note.midi >= 35 && note.midi <= 59 && allowed.includes(note.midi))
    check(step.kind !== 'rest')
    if (step.beatInBar % 2 === 0 && note.step === step.beat * 4) check(note.midi === chord.rootMidi)
    if (index < bass.length - 1) check(note.step + note.durationSteps <= bass[index + 1]!.step)
  }
  for (const note of score.events) {
    check(Number.isFinite(note.step) && note.step >= 0 && note.step < 128 && Number.isFinite(note.durationSteps)
      && note.durationSteps > 0 && note.step + note.durationSteps <= 128)
    const maximum = note.layer === 'drums' ? { kick: 0, snare: 0.04, hat: 0.06 }[note.drum!] : note.layer === 'bass' ? 0.03 : 0.08
    check(Number.isFinite(note.microOffset) && note.microOffset >= 0 && note.microOffset <= maximum)
    check(Number.isFinite(note.velocity) && note.velocity >= 0.05 && note.velocity <= 1)
    if (note.layer === 'keys') {
      const embellishment = note.step % 16 === 14 && note.durationSteps === 2 && note.velocity <= 0.5
      const chord = score.chords[Math.floor(score.trace[note.traceBeat!]!.bar / 2)]!
      check(note.midi !== null && note.midi >= preset.keysRange.low && note.midi <= preset.keysRange.high + (embellishment ? 12 : 0)
        && chord.voicing.some(midi => midi % 12 === note.midi! % 12))
    }
  }
  for (let bar = 0; bar < 8; bar++) {
    const notes = score.events.filter(note => Math.floor(note.step / 16) === bar)
    check(notes.filter(note => note.layer === 'bass').length <= 8)
    check(notes.filter(note => note.layer === 'keys').length <= 17)
    check(notes.filter(note => note.layer === 'drums').length <= 24)
  }
  for (let step = 0; step < 128; step++) check(score.events.filter(note => note.layer === 'keys'
    && note.step <= step && step < note.step + note.durationSteps).length <= 8)
  const layerOrder = { drums: 0, bass: 1, keys: 2, lead: 3 }
  const drumOrder = { kick: 0, snare: 1, hat: 2 }
  for (let index = 1; index < score.events.length; index++) {
    const a = score.events[index - 1]!
    const b = score.events[index]!
    check((a.step - b.step || layerOrder[a.layer] - layerOrder[b.layer]
      || (a.layer === 'drums' && b.layer === 'drums' ? drumOrder[a.drum!] - drumOrder[b.drum!] : 0)
      || (a.midi ?? -1) - (b.midi ?? -1)) <= 0)
  }
  return violations
}

export function measureMusic(plan: PhrasePlan, score: PhraseScore, cells: readonly BassCellId[], target: readonly BassCellId[]): MusicalMetrics {
  let eligibleBeats = 0
  let correct = 0
  let rests = 0
  const distinct = new Set<BassCellId>()
  const expected = plan.trace.map(step => step.kind === 'rest' ? 'rest' as const : target[step.beat % 8]!)
  for (const step of plan.trace) {
    if (step.kind === 'rest') continue
    eligibleBeats++
    correct += Number(cells[step.beat] === expected[step.beat])
    rests += Number(cells[step.beat] === 'rest')
    distinct.add(cells[step.beat]!)
  }
  const reference = bassSignatures(renderPhrasePlan(plan, { cells: expected }))
  const actual = bassSignatures(score)
  // Neutralize forced silence when counting diversity so changing traversal masks cannot supply it.
  const sequences = twoBarSequences(plan, cells, target)
  return { eligibleBeats, actionAccuracy: eligibleBeats ? correct / eligibleBeats : 0,
    onsetSimilarity: similarity(actual.onsets, reference.onsets), intervalSimilarity: similarity(actual.intervals, reference.intervals),
    restFraction: eligibleBeats ? rests / eligibleBeats : 0, forcedRestFraction: 1 - eligibleBeats / plan.trace.length,
    distinctCellCount: distinct.size, repetitionRate: sequences.slice(1).filter((value, index) => value === sequences[index]).length / 3,
    distinctTwoBarSequences: new Set(sequences).size, constraintViolations: countConstraintViolations(score, cells) }
}

export function twoBarSequences(plan: PhrasePlan, cells: readonly BassCellId[], target: readonly BassCellId[]): string[] {
  return Array.from({ length: plan.trace.length / 8 }, (_, index) => plan.trace.slice(index * 8, index * 8 + 8)
    .map(step => step.kind === 'rest' ? target[step.beat % 8] : cells[step.beat]).join('|'))
}

export function meanMetrics(metrics: readonly MusicalMetrics[]): MusicalMetrics {
  if (!metrics.length) throw new Error('No evaluation observations')
  return Object.fromEntries(Object.keys(metrics[0]!).map(key => [key, metrics.reduce((sum, value) => sum + value[key as keyof MusicalMetrics], 0)
    / (key === 'eligibleBeats' || key === 'constraintViolations' ? 1 : metrics.length)])) as unknown as MusicalMetrics
}
