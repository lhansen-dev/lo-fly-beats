import { wholeConnectome } from '../helpers/wholeConnectome'
import { expect, it } from 'vitest'
import { composePhrase } from '../../src/music/compose'
import { CHORD_QUALITIES } from '../../src/music/harmony'
import { PRESETS, getPreset } from '../../src/presets/presets'
import type { PhraseScore, SessionRecipe } from '../../src/music/types'

const graph = wholeConnectome()
const variations = [0, 0.5, 1]

function assertRealComposition(score: PhraseScore): void {
  const preset = getPreset(score.presetId)
  expect(score.chords.map(chord => chord.bar)).toEqual([0, 2, 4, 6])
  expect(score.trace).toHaveLength(32)
  for (let beat = 0; beat < score.trace.length; beat++) {
    const step = score.trace[beat]!
    expect(step.bar).toBe(Math.floor(beat / 4))
    expect(step.beatInBar).toBe(beat % 4)
    if (step.kind === 'edge') {
      expect(graph.outgoing.get(step.from)).toContainEqual({ target: step.neuronId, synapseCount: step.synapseCount })
    } else if (step.kind === 'start' || step.kind === 'restart') expect(graph.startNeuronIds).toContain(step.neuronId)
  }
  for (const event of score.events) {
    expect(event.step).toBeGreaterThanOrEqual(0)
    expect(event.step + event.durationSteps).toBeLessThanOrEqual(128)
    expect(event.durationSteps).toBeGreaterThan(0)
    const maxOffset = event.layer === 'drums'
      ? ({ kick: 0, snare: 0.04, hat: 0.06 } as const)[event.drum!]
      : event.layer === 'bass' ? 0.03 : 0.08
    expect(event.microOffset).toBeGreaterThanOrEqual(0)
    expect(event.microOffset).toBeLessThanOrEqual(maxOffset)
    expect(event.velocity).toBeGreaterThanOrEqual(0.05)
    expect(event.velocity).toBeLessThanOrEqual(1)
    if (event.layer === 'keys') {
      expect(event.midi).toBeGreaterThanOrEqual(preset.keysRange.low)
      const embellishment = event.step % 16 === 14 && event.durationSteps === 2 && event.velocity <= 0.5
      expect(event.midi).toBeLessThanOrEqual(preset.keysRange.high + (embellishment ? 12 : 0))
      const beat = score.trace[event.traceBeat!]!
      const chord = score.chords[Math.floor(beat.bar / 2)]!
      expect(chord.voicing.map(note => note % 12)).toContain(event.midi! % 12)
    } else if (event.layer === 'bass') {
      const beat = score.trace[event.traceBeat!]!
      const chord = score.chords[Math.floor(beat.bar / 2)]!
      const quality = CHORD_QUALITIES[preset.chordRing[chord.ringIndex]!.quality]
      const allowed = [chord.rootMidi, chord.rootMidi + quality.third, chord.rootMidi + 7,
        chord.rootMidi + quality.seventh, chord.rootMidi + 12]
      if (beat.beatInBar === 3 && [1, 3, 5].includes(beat.bar)) allowed.push(score.chords[Math.floor((beat.bar + 1) / 2)]!.rootMidi - 1)
      expect(event.midi).toBeGreaterThanOrEqual(35)
      expect(event.midi).toBeLessThanOrEqual(59)
      expect(allowed).toContain(event.midi)
      if ((beat.beatInBar === 0 || beat.beatInBar === 2) && event.step === beat.bar * 16 + beat.beatInBar * 4) expect(event.midi).toBe(chord.rootMidi)
    }
  }
  const bass = score.events.filter(event => event.layer === 'bass').sort((a, b) => a.step - b.step)
  for (let i = 0; i < bass.length - 1; i++) expect(bass[i]!.step + bass[i]!.durationSteps).toBeLessThanOrEqual(bass[i + 1]!.step)
  for (const step of score.trace) if (step.kind === 'rest') expect(bass.some(event => event.traceBeat === step.beat)).toBe(false)
  for (let bar = 0; bar < 8; bar++) {
    const events = score.events.filter(event => event.step >= bar * 16 && event.step < (bar + 1) * 16)
    expect(events.filter(event => event.layer === 'drums').length).toBeLessThanOrEqual(24)
    expect(events.filter(event => event.layer === 'bass').length).toBeLessThanOrEqual(8)
    expect(events.filter(event => event.layer === 'keys').length).toBeLessThanOrEqual(17)
  }
  for (let step = 0; step < 128; step++) {
    expect(score.events.filter(event => event.layer === 'keys' && event.step <= step && step < event.step + event.durationSteps).length).toBeLessThanOrEqual(8)
  }
}

it('keeps every graph-driven layer and trace valid for 270 real-graph phrases', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const variation of variations) {
      for (const preset of Object.values(PRESETS)) {
        const recipe: SessionRecipe = { recipeVersion: 1, presetId: preset.id, sessionSeed: seed, variation, tempoBpm: 72 }
        assertRealComposition(composePhrase(graph, recipe, 0))
      }
    }
  }
})
