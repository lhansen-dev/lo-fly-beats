import { bassRootMidi, chooseVoicing, CHORD_QUALITIES } from '../music/harmony'
import { clamp } from '../music/math'
import { HUMANIZE_MAX_OFFSETS, HUMANIZE_VELOCITY_SPREAD } from '../music/patterns'
import { createRng } from '../music/rng'
import type { ChordSlot, NoteEvent, PhraseScore, SessionRecipe, TraceStep } from '../music/types'
import { MAPPING_VERSION, SCORE_VERSION } from '../music/versions'
import { getPreset } from '../presets/presets'
import type { PresetId } from '../presets/types'
import type { BrainModel } from './model'
import type { PhraseActions, PhraseActivity } from './perform'
import { leadDegrees, leadMidi } from './melody'
import { BARS, CHORD_STEPS, HEADS, PHRASE_STEPS, STEPS_PER_BAR } from './vocabulary'

export const DRUM_VELOCITY = Object.freeze({ kick: [0, 0.62, 0.92], snare: [0, 0.26, 0.8], hat: [0, 0.26, 0.48] })
const MAX_BASS_STEPS = 16
const MAX_KEYS_STEPS = 32
const MAX_LEAD_STEPS = 12

export interface BrainProvenance {
  circuitId: string
  circuitChecksum: string
  brainVersion: number
  readoutRevision: number
  connectivity: string
  actions: PhraseActions
  activity: PhraseActivity
}

export function chordSlots(presetId: PresetId, rings: readonly number[]): ChordSlot[] {
  const preset = getPreset(presetId)
  let previous: number[] | null = null
  return rings.map((ringIndex, index) => {
    const chord = preset.chordRing[ringIndex]
    if (!chord) throw new RangeError('Invalid chord ring index')
    const voicing = chooseVoicing(chord, preset.keysRange, previous)
    previous = voicing
    return {
      bar: (index * 2) as 0 | 2 | 4 | 6, traceBeat: index * 8, ringIndex, ringStepped: false,
      symbol: chord.symbol, rootMidi: bassRootMidi(chord.root), voicing,
    }
  })
}

function bassMidi(action: string, step: number, chords: readonly ChordSlot[], presetId: PresetId): number {
  const slot = Math.floor(step / CHORD_STEPS)
  const chord = chords[slot]!
  const quality = CHORD_QUALITIES[getPreset(presetId).chordRing[chord.ringIndex]!.quality]
  switch (action) {
    case 'root': return chord.rootMidi
    case 'fifth': return chord.rootMidi + 7
    case 'octave': return chord.rootMidi + 12
    case 'third': return chord.rootMidi + quality.third
    case 'seventh': return chord.rootMidi + quality.seventh
    case 'approach': {
      // Lead into the next chord's root from a semitone below, or the current root otherwise.
      const target = (chords[slot + 1] ?? chords[0]!).rootMidi
      return target - 1 + (target - 1 < 36 ? 12 : 0)
    }
    default: throw new RangeError(`Bass action ${action} has no pitch`)
  }
}

/** Ends at the next onset/stop, the chord change, or the length cap. */
function noteLength(step: number, isEnd: (later: number) => boolean, cap: number, breakAtChord: boolean): number {
  let length = 1
  while (length < cap && step + length < PHRASE_STEPS) {
    const later = step + length
    if (isEnd(later) || (breakAtChord && later % CHORD_STEPS === 0)) break
    length++
  }
  return length
}

export function arrangePhrase(
  model: BrainModel, readoutRevision: number, recipe: SessionRecipe, phraseIndex: number,
  actions: PhraseActions, activity: PhraseActivity,
): PhraseScore {
  const preset = getPreset(recipe.presetId)
  const chords = chordSlots(recipe.presetId, actions.chords)
  const events: NoteEvent[] = []
  const steps = actions.steps
  const lead = leadDegrees(steps.lead, actions.chords, recipe.presetId, actions.leadStart).degrees
  for (let step = 0; step < PHRASE_STEPS; step++) {
    const traceBeat = Math.floor(step / 4)
    for (const drum of ['kick', 'snare', 'hat'] as const) {
      const action = steps[drum][step]!
      if (action > 0) events.push({ layer: 'drums', step, microOffset: 0, durationSteps: 1, midi: null, drum, velocity: DRUM_VELOCITY[drum][action]!, traceBeat })
    }
    const bass = HEADS.bass[steps.bass[step]!]!
    if (bass !== 'hold' && bass !== 'stop') {
      const durationSteps = noteLength(step, later => steps.bass[later]! !== 0, MAX_BASS_STEPS, true)
      events.push({
        layer: 'bass', step, microOffset: 0, durationSteps, midi: bassMidi(bass, step, chords, recipe.presetId),
        drum: null, velocity: step % 16 === 0 ? 0.95 : step % 4 === 0 ? 0.85 : 0.72, traceBeat,
      })
    }
    const keys = HEADS.keys[steps.keys[step]!]!
    if (keys === 'strike' || keys === 'strike-top') {
      const chord = chords[Math.floor(step / CHORD_STEPS)]!
      const durationSteps = noteLength(step, later => steps.keys[later]! !== 0, MAX_KEYS_STEPS, true)
      const notes = keys === 'strike' ? chord.voicing : chord.voicing.slice(-2)
      const velocity = keys === 'strike' ? (step % 16 === 0 ? 0.7 : 0.62) : 0.52
      for (const midi of notes) events.push({ layer: 'keys', step, microOffset: 0, durationSteps, midi, drum: null, velocity, traceBeat })
    }
    const degree = lead[step]
    if (degree !== null && degree !== undefined) {
      const durationSteps = noteLength(step, later => steps.lead[later]! !== 0, MAX_LEAD_STEPS, false)
      events.push({
        layer: 'lead', step, microOffset: 0, durationSteps, midi: leadMidi(recipe.presetId, degree), drum: null,
        velocity: step % 4 === 0 ? 0.62 : 0.52, traceBeat,
      })
    }
  }
  const layerOrder = { drums: 0, bass: 1, keys: 2, lead: 3 } as const
  const drumOrder = { kick: 0, snare: 1, hat: 2 } as const
  events.sort((a, b) => a.step - b.step || layerOrder[a.layer] - layerOrder[b.layer]
    || (a.drum && b.drum ? drumOrder[a.drum] - drumOrder[b.drum] : 0) || (a.midi ?? -1) - (b.midi ?? -1))
  const humanize = createRng(`brain|${recipe.sessionSeed}|${phraseIndex}|humanize`)
  for (const event of events) {
    const a = humanize.float()
    const b = humanize.float()
    const voice = event.layer === 'drums' ? event.drum! : event.layer
    event.velocity = clamp(Math.round(event.velocity * (1 + (a * 2 - 1) * HUMANIZE_VELOCITY_SPREAD) * 10000) / 10000, 0.05, 1)
    event.microOffset = Math.round(b * HUMANIZE_MAX_OFFSETS[voice] * 10000) / 10000
  }

  const trace: TraceStep[] = Array.from({ length: BARS * 4 }, (_, beat) => {
    const peak = activity.beatPeaks[beat] ?? -1
    const neuron = peak >= 0 ? model.circuit.neurons[peak]! : null
    const counts = new Map<string, number>()
    for (let step = beat * 4; step < beat * 4 + 4; step++) {
      for (const head of ['kick', 'snare', 'hat', 'bass', 'keys', 'lead'] as const) {
        const action = steps[head][step]!
        const name = (HEADS[head] as readonly string[])[action]!
        if (action > 0 && name !== 'hold' && name !== 'off') counts.set(`${head} ${name}`, (counts.get(`${head} ${name}`) ?? 0) + 1)
      }
    }
    const uses = [...counts].map(([use, count]) => count > 1 ? `${use} ×${count}` : use)
    const slot = chords.find(chord => chord.traceBeat === beat)
    if (slot) uses.unshift(`chord ${slot.symbol}`)
    return neuron
      ? { beat, kind: 'start' as const, neuronId: neuron.id, bar: Math.floor(beat / 4), beatInBar: beat % 4, neuronType: neuron.type, uses }
      : { beat, kind: 'rest' as const, neuronId: null, bar: Math.floor(beat / 4), beatInBar: beat % 4, neuronType: null, uses }
  })

  return {
    scoreVersion: SCORE_VERSION, mappingVersion: MAPPING_VERSION, presetId: recipe.presetId, presetVersion: preset.version,
    sessionSeed: recipe.sessionSeed, phraseIndex, compositionPhraseIndex: phraseIndex, variation: recipe.variation,
    graphChecksum: model.circuit.checksum, bars: 8, stepsPerBar: STEPS_PER_BAR as 16, chords, events, trace, fill: false,
    brain: {
      circuitId: model.circuit.circuitId, circuitChecksum: model.circuit.checksum, brainVersion: 1, readoutRevision,
      connectivity: model.connectivity, actions, activity,
    },
  }
}
