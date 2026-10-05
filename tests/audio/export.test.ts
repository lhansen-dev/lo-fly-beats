import { describe, expect, it } from 'vitest'
import * as Tone from 'tone'
import branchingCircuit from '../fixtures/graphs/branching/circuit.json'
import branchingManifest from '../fixtures/graphs/branching/manifest.json'
import { buildGraph } from '../../src/connectome/graph'
import { createExportSnapshot, renderPhrase } from '../../src/audio/export'
import { exportSeconds } from '../../src/audio/timing'
import { PRESETS } from '../../src/presets/presets'
import type { PhraseScore, SessionRecipe } from '../../src/music/types'
import { DEFAULT_MIX, type MixSettings } from '../../src/audio/rig'
import { buildPhrasePlan, composePhrase } from '../../src/music/compose'
import { loadLearningCircuit } from '../../src/music/learning/load'
import { buildReservoirGraph } from '../../src/music/learning/graph'
import { createReservoirModel } from '../../src/music/learning/reservoir'
import { createLearningSnapshot, preparePhrase } from '../../src/music/learning/session'
import { encodeWav16 } from '../../src/audio/wav'
import { detectOnsets } from './onsets'

const preset = PRESETS['rainy-windowsill']
const recipe = (tempoBpm: number): SessionRecipe => ({ recipeVersion: 1, presetId: preset.id, sessionSeed: 1, variation: 0.5, tempoBpm })
function score(events: PhraseScore['events']): PhraseScore {
  return { scoreVersion: 1, mappingVersion: 2, presetId: preset.id, presetVersion: 1, sessionSeed: 1, phraseIndex: 0, compositionPhraseIndex: 0, variation: 0.5, graphChecksum: 'test', bars: 8, stepsPerBar: 16, chords: [], events, trace: [], fill: false }
}
const kicks = [0, 16, 32, 48].map(step => ({ layer: 'drums' as const, step, microOffset: 0, durationSteps: 1, midi: null, drum: 'kick' as const, velocity: 1, traceBeat: null }))
const graph = buildGraph(branchingManifest, branchingCircuit, branchingManifest.output.sha256)
function rms(samples: Float32Array, start: number, end: number) {
  let sum = 0
  for (let i = start; i < end; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / (end - start))
}
async function checkedRender(snapshot: ReturnType<typeof createExportSnapshot>) {
  const identity = Tone.getContext()
  const data = await renderPhrase(snapshot)
  expect(Tone.getContext()).toBe(identity)
  expect(data.sampleRate).toBe(44100)
  expect(data.channels).toHaveLength(2)
  for (const channel of data.channels) {
    let finite = true
    for (const sample of channel) if (!Number.isFinite(sample)) finite = false
    expect(finite).toBe(true)
    expect(rms(channel, channel.length - 441, channel.length)).toBeLessThan(0.001)
  }
  return data
}
const makeSnapshot = (events: PhraseScore['events'], bpm: number, mix: MixSettings = { ...DEFAULT_MIX, ambienceOn: false }, swing = preset.swing) =>
  createExportSnapshot(score(events), recipe(bpm), { ...preset, swing }, mix)

describe('offline phrase rendering', () => {
  it('renders a captured reservoir bass override audibly and exports WAV without advancing the fly', async () => {
    const model = createReservoirModel(buildReservoirGraph(await loadLearningCircuit('/')))
    const session = recipe(100)
    const memory = createLearningSnapshot(graph.checksum, model)
    const prepared = preparePhrase(buildPhrasePlan(graph, session, 0), memory, model)
    const before = structuredClone({ memory, prepared, model })
    // Isolate bass so accompaniment cannot satisfy the audibility assertion.
    const snapshot = createExportSnapshot(prepared.score, session, preset, {
      ...DEFAULT_MIX, ambienceOn: false, layers: {
        ...DEFAULT_MIX.layers, drums: { level: 0, muted: true }, keys: { level: 0, muted: true },
      },
    })
    expect(snapshot.score.learning?.reservoirGraphChecksum).toBe(model.graph.checksum)
    expect(snapshot.score.events.some(event => event.layer === 'bass')).toBe(true)
    const data = await checkedRender(snapshot)
    expect(rms(data.channels[0], 0, data.channels[0].length)).toBeGreaterThan(0.001)
    const wav = encodeWav16(data)
    const header = new DataView(wav)
    expect(header.getUint32(24, true)).toBe(44100)
    expect(header.getUint16(22, true)).toBe(2)
    expect(wav.byteLength).toBe(44 + data.channels[0].length * 4)
    expect({ memory, prepared, model }).toEqual(before)
  }, 60000)

  it.each([60, 72, 100])('renders stereo 44.1 kHz at %i BPM', async bpm => {
    const data = await checkedRender(makeSnapshot([], bpm))
    expect(Math.abs(data.channels[0].length - Math.round(exportSeconds(bpm) * 44100))).toBeLessThanOrEqual(1)
  }, 60000)

  it('places kick and swung hat onsets within 5 ms of the score plus limiter latency', async () => {
    // The shared live/export rig ends in Tone.Limiter's DynamicsCompressorNode.
    // Its fixed 6 ms look-ahead is specified by the Web Audio processing algorithm:
    // https://www.w3.org/TR/webaudio-1.0/#DynamicsCompressorNode-processing
    const limiterLatency = 0.006
    const kicksData = await checkedRender(makeSnapshot(kicks, 72, undefined, 0.5))
    const kickOnsets = detectOnsets(kicksData.channels[0], 44100)
    expect(kickOnsets).toHaveLength(4)
    for (let i = 0; i < kickOnsets.length; i++) {
      expect(Math.abs(kickOnsets[i] - ([0, 10 / 3, 20 / 3, 10][i] + limiterLatency))).toBeLessThan(0.005)
    }
    const hat = { layer: 'drums' as const, step: 1, microOffset: 0, durationSteps: 1, midi: null, drum: 'hat' as const, velocity: 1, traceBeat: null }
    const hatData = await checkedRender(makeSnapshot([hat], 72, undefined, 0.56))
    const hatOnsets = detectOnsets(hatData.channels[0], 44100)
    expect(hatOnsets).toHaveLength(1)
    expect(Math.abs(hatOnsets[0] - (0.233333 + limiterLatency))).toBeLessThan(0.005)
  }, 60000)

  it('renders audible ambience for an empty score', async () => {
    const data = await checkedRender(makeSnapshot([], 72, { ...DEFAULT_MIX, ambienceOn: true }))
    expect(Math.max(rms(data.channels[0], 0, data.channels[0].length - 22050), rms(data.channels[1], 0, data.channels[1].length - 22050))).toBeGreaterThan(0.001)
  }, 60000)

  it('repeats an identical deterministic branching-graph phrase', async () => {
    const session = recipe(preset.tempoBpm)
    const phrase = composePhrase(graph, session, 0)
    const snapshot = createExportSnapshot(phrase, session, preset, { ...DEFAULT_MIX, ambienceOn: true })
    const first = await checkedRender(snapshot)
    const second = await checkedRender(snapshot)
    expect(first.channels[0].length).toBe(second.channels[0].length)
    expect(first.channels[1].length).toBe(second.channels[1].length)
    let maxDifference = 0
    for (let channel = 0; channel < 2; channel++) for (let i = 0; i < first.channels[channel].length; i++) maxDifference = Math.max(maxDifference, Math.abs(first.channels[channel][i] - second.channels[channel][i]))
    expect(maxDifference).toBeLessThanOrEqual(1e-4)
  }, 60000)
})
