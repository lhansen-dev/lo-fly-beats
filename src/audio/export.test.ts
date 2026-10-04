import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { PRESETS } from '../presets/presets'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'
import { createExportSnapshot } from './export'

const mocks = vi.hoisted(() => ({ contexts: [] as any[], rigs: [] as any[], createRig: vi.fn() }))
vi.mock('tone', () => ({ OfflineContext: class {
  args: unknown[]
  buffer: any
  constructor(...args: unknown[]) {
    this.args = args
    this.buffer = { numberOfChannels: 2, getChannelData: (i: number) => new Float32Array([0.2 + i, 0.4 + i]) }
    mocks.contexts.push(this)
  }
  render() { return Promise.resolve({ get: () => this.buffer, dispose: vi.fn() }) }
  dispose = vi.fn()
} }))
vi.mock('./rig', () => ({ createRig: mocks.createRig }))

const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 7, variation: 0.4, tempoBpm: 72 }
const score: PhraseScore = {
  scoreVersion: 1, mappingVersion: 2, presetId: recipe.presetId, presetVersion: 1, sessionSeed: 7,
  phraseIndex: 2, compositionPhraseIndex: 2, variation: 0.4, graphChecksum: 'abc', bars: 8, stepsPerBar: 16,
  chords: [{ bar: 0, traceBeat: 0, ringIndex: 0, ringStepped: false, symbol: 'Dm9', rootMidi: 38, voicing: [57, 60, 64, 65] }],
  events: [{ layer: 'keys', step: 0, microOffset: 0.02, durationSteps: 4, midi: 60, drum: null, velocity: 0.7, traceBeat: 0 }],
  trace: [{ beat: 0, kind: 'start', neuronId: '1', bar: 0, beatInBar: 0, neuronType: 'MBON01', uses: ['chord Dm9'] }], fill: false,
}
const preset: PresetDefinition = structuredClone(PRESETS['rainy-windowsill'])
const mix: MixSettings = { masterVolume: 0.8, layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false } }, ambienceOn: true }

function setupRig() {
  const rig = { trigger: vi.fn(), startAmbience: vi.fn(), dispose: vi.fn() }
  mocks.rigs.push(rig)
  mocks.createRig.mockReturnValueOnce(rig)
  return rig
}

afterEach(() => { mocks.contexts.length = 0; mocks.rigs.length = 0; mocks.createRig.mockReset() })

describe('export snapshot', () => {
  it('preserves values in an isolated, recursively frozen copy', () => {
    const sourcePreset = structuredClone(preset)
    const snapshot = createExportSnapshot(score, recipe, sourcePreset, mix)
    expect(snapshot).toEqual({ score, recipe, preset: sourcePreset, mix })
    expect(snapshot.score).not.toBe(score)
    expect(snapshot.score.events).not.toBe(score.events)
    expect(snapshot.score.events[0]).not.toBe(score.events[0])
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.preset.sound)).toBe(true)
  })
})

describe('offline phrase rendering', () => {
  it.each([60, 72, 100])('creates the exact offline context for %i BPM', async bpm => {
    const rig = setupRig()
    const snapshot = createExportSnapshot({ ...score, events: [] }, { ...recipe, tempoBpm: bpm }, preset, { ...mix, ambienceOn: false })
    const { renderPhrase } = await import('./export')
    const result = await renderPhrase(snapshot)
    expect(mocks.contexts[0].args).toEqual([2, 128 * 60 / bpm / 4 + 2, 44100])
    expect(mocks.createRig).toHaveBeenCalledWith(mocks.contexts[0], preset.sound, snapshot.mix)
    expect(rig.startAmbience).not.toHaveBeenCalled()
    expect(result.channels[0]).not.toBe(mocks.contexts[0].buffer.getChannelData(0))
    expect(rig.dispose).toHaveBeenCalledOnce()
    expect(mocks.contexts[0].dispose).toHaveBeenCalledOnce()
  })

  it('schedules every event at its exact relative swung time and copies channels', async () => {
    const rig = setupRig()
    const events = [
      { ...score.events[0], layer: 'keys' as const, step: 1, microOffset: 0.1, durationSteps: 3 },
      { ...score.events[0], layer: 'bass' as const, step: 1, microOffset: 0.05, durationSteps: 2 },
    ]
    const snapshot = createExportSnapshot({ ...score, phraseIndex: 9, events }, recipe, preset, mix)
    const { renderPhrase } = await import('./export')
    const data = await renderPhrase(snapshot)
    expect(rig.startAmbience).toHaveBeenCalledWith(0)
    expect(rig.trigger.mock.calls).toEqual([[events[0], (1 + 0.12 + 0.1) * 60 / 72 / 4, 3 * 60 / 72 / 4], [events[1], (1 + 0.12 + 0.05) * 60 / 72 / 4, 2 * 60 / 72 / 4]])
    expect(data.channels[0]).toEqual(new Float32Array([0.2, 0.4]))
    expect(data.channels[1]).toEqual(new Float32Array([1.2, 1.4]))
    data.channels[0][0] = 99
    expect(mocks.contexts[0].buffer.getChannelData(0)[0]).toBeCloseTo(0.2)
    expect(rig.dispose).toHaveBeenCalledOnce()
  })

  it('cleans up if rig creation fails', async () => {
    mocks.createRig.mockImplementationOnce(() => { throw new Error('creation failed') })
    const { renderPhrase } = await import('./export')
    await expect(renderPhrase(createExportSnapshot(score, recipe, preset, mix))).rejects.toThrow('creation failed')
    expect(mocks.contexts[0].dispose).toHaveBeenCalledOnce()
  })
})
