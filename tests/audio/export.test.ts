import { describe, expect, it } from 'vitest'
import * as Tone from 'tone'
import { createExportSnapshot, renderPhrase } from '../../src/audio/export'
import { exportSeconds } from '../../src/audio/timing'
import { PRESETS } from '../../src/presets/presets'
import type { PhraseScore, SessionRecipe } from '../../src/music/types'
import { DEFAULT_MIX } from '../../src/audio/rig'

const preset = PRESETS['rainy-windowsill']
const recipe = (tempoBpm: number): SessionRecipe => ({ recipeVersion: 1, presetId: preset.id, sessionSeed: 1, variation: 0, tempoBpm })
function score(events: PhraseScore['events']): PhraseScore {
  return { scoreVersion: 1, mappingVersion: 2, presetId: preset.id, presetVersion: 1, sessionSeed: 1, phraseIndex: 0, compositionPhraseIndex: 0, variation: 0, graphChecksum: 'test', bars: 8, stepsPerBar: 16, chords: [], events, trace: [], fill: false }
}
const kickEvents = [0, 16, 32, 48].map(step => ({ layer: 'drums' as const, step, microOffset: 0, durationSteps: 1, midi: null, drum: 'kick' as const, velocity: 1, traceBeat: null }))
const mix = { ...DEFAULT_MIX, ambienceOn: false }
const render = (events: PhraseScore['events'], bpm: number, swing = preset.swing) => renderPhrase(createExportSnapshot(score(events), recipe(bpm), { ...preset, swing }, mix))

function onsets(samples: Float32Array, sampleRate: number): number[] {
  const output: number[] = []
  // The clip boundary represents leading pre-clip silence for a step-zero hit.
  let quietStart = -Math.round(sampleRate * 0.05)
  let wasOnset = false
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) < 0.01) {
      if (!wasOnset && output.length > 0) quietStart = i
    } else if (Math.abs(samples[i]) > 0.05 && i - quietStart >= Math.round(sampleRate * 0.05)) {
      output.push(i / sampleRate)
      wasOnset = true
    }
    if (wasOnset && i - (output[output.length - 1] * sampleRate) > sampleRate * 0.12) wasOnset = false
  }
  return output
}

describe('offline phrase rendering', () => {
  it.each([60, 72, 100])('renders stereo 44.1 kHz at %i BPM', async bpm => {
    const identity = Tone.getContext()
    const data = await render([], bpm)
    expect(Tone.getContext()).toBe(identity)
    expect(data.sampleRate).toBe(44100)
    expect(data.channels).toHaveLength(2)
    expect(Math.abs(data.channels[0].length - Math.round(exportSeconds(bpm) * 44100))).toBeLessThanOrEqual(1)
  }, 60000)

  it('places the four kick onsets on their score times', async () => {
    const identity = Tone.getContext()
    const data = await render(kickEvents, 72, 0.5)
    expect(Tone.getContext()).toBe(identity)
    const detected = onsets(data.channels[0], data.sampleRate)
    expect(detected).toHaveLength(4)
    for (const [actual, expected] of detected.map((time, index) => [time, [0, 3.333333, 6.666667, 10][index]])) expect(Math.abs(actual - expected)).toBeLessThan(0.005)
    expect(detected.filter(time => time < 3.333333)).toHaveLength(1)
    expect(detected.filter(time => time < 6.666667)).toHaveLength(2)
    expect(detected.filter(time => time < 10)).toHaveLength(3)
  }, 60000)

  it('schedules a swung hat at the adapted time', async () => {
    const event = { layer: 'drums' as const, step: 1, microOffset: 0, durationSteps: 1, midi: null, drum: 'hat' as const, velocity: 1, traceBeat: null }
    const identity = Tone.getContext()
    const data = await render([event], 72, 0.56)
    expect(Tone.getContext()).toBe(identity)
    const detected = onsets(data.channels[0], data.sampleRate)
    expect(detected).toHaveLength(1)
    expect(Math.abs(detected[0] - 0.233333)).toBeLessThan(0.005)
  }, 60000)
})
