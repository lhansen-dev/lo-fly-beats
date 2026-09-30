import type { CircuitGraph, Neuron } from '../connectome/types'
import { fnv1a32 } from './rng'
import type { ChordSlot, WalkStep } from './types'
import type { ChordDef, ChordQualityId, PresetDefinition } from '../presets/types'

export const CHORD_QUALITIES: Record<ChordQualityId, { intervals: readonly number[]; third: number; seventh: number }> = {
  m9: { intervals: [3, 7, 10, 14], third: 3, seventh: 10 },
  m7add11: { intervals: [3, 7, 10, 17], third: 3, seventh: 10 },
  maj9: { intervals: [4, 7, 11, 14], third: 4, seventh: 11 },
  maj7sharp11: { intervals: [4, 7, 11, 18], third: 4, seventh: 11 },
  dom9: { intervals: [4, 7, 10, 14], third: 4, seventh: 10 },
  dom7sus4: { intervals: [5, 7, 10, 14], third: 5, seventh: 10 },
}

export interface KeysRange { low: number; center: number; high: number }

export function chordPitchClasses(chord: ChordDef): number[] {
  return CHORD_QUALITIES[chord.quality].intervals.map(interval => (chord.root + interval) % 12)
}

export function voicingCandidates(chord: ChordDef, range: KeysRange): number[][] {
  const pitches = chordPitchClasses(chord)
  const candidates: number[][] = []
  for (let rotation = 0; rotation < pitches.length; rotation++) {
    for (let first = range.low; first <= range.high; first++) {
      if (first % 12 !== pitches[rotation]) continue
      const notes = [first]
      for (let position = 1; position < pitches.length; position++) {
        const pitchClass = pitches[(rotation + position) % pitches.length]!
        const previous = notes[position - 1]!
        let next = previous + 1
        while (next % 12 !== pitchClass) next++
        notes.push(next)
      }
      if (notes[notes.length - 1]! <= range.high) candidates.push(notes)
    }
  }
  return candidates
}

function mean(notes: readonly number[]): number {
  return notes.reduce((sum, note) => sum + note, 0) / notes.length
}

export function chooseVoicing(chord: ChordDef, range: KeysRange, previous: number[] | null): number[] {
  const candidates = voicingCandidates(chord, range)
  if (candidates.length === 0) throw new RangeError(`No voicing candidates for ${chord.symbol} in range`)
  candidates.sort((a, b) => {
    if (previous !== null) {
      const distance = (notes: number[]) => notes.reduce((sum, note, index) => sum + Math.abs(note - previous[index]!), 0)
      const difference = distance(a) - distance(b)
      if (difference !== 0) return difference
    }
    return Math.abs(mean(a) - range.center) - Math.abs(mean(b) - range.center) || a[0]! - b[0]!
  })
  return candidates[0]!
}

export function bassRootMidi(rootPitchClass: number): number {
  const normalized = ((rootPitchClass % 12) + 12) % 12
  return 36 + ((normalized - 0 + 12) % 12)
}

export function ringIndexFor(neuron: Pick<Neuron, 'id' | 'type'>): number {
  return fnv1a32(neuron.type ?? `id:${neuron.id}`) % 6
}

export function applyRingRule(rawIndices: number[]): { index: number; stepped: boolean }[] {
  let previousChosen: number | undefined
  return rawIndices.map(raw => {
    const stepped = previousChosen === raw
    const index = stepped ? (raw + 1) % 6 : raw
    previousChosen = index
    return { index, stepped }
  })
}

export function chooseChordSlots(graph: CircuitGraph, walk: readonly WalkStep[], preset: Pick<PresetDefinition, 'chordRing' | 'keysRange'>): ChordSlot[] {
  const beats = [0, 8, 16, 24]
  const steps = beats.map(beat => {
    const step = walk[beat]
    if (!step || step.kind === 'rest') throw new Error(`Walk has no neuron at chord slot beat ${beat}`)
    const neuron = graph.neurons.get(step.neuronId)
    if (!neuron) throw new Error(`Walk references missing neuron ${step.neuronId}`)
    return { beat, neuron }
  })
  const ringRules = applyRingRule(steps.map(({ neuron }) => ringIndexFor(neuron)))
  let previousVoicing: number[] | null = null
  return steps.map(({ beat }, index) => {
    const { index: ringIndex, stepped } = ringRules[index]!
    const chord = preset.chordRing[ringIndex]!
    const voicing = chooseVoicing(chord, preset.keysRange, previousVoicing)
    previousVoicing = voicing
    return {
      bar: (beat / 4) as 0 | 2 | 4 | 6,
      traceBeat: beat,
      ringIndex,
      ringStepped: stepped,
      symbol: chord.symbol,
      rootMidi: bassRootMidi(chord.root),
      voicing,
    }
  })
}
