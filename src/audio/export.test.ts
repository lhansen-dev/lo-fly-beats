import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { PRESETS } from '../presets/presets'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'
import { createExportSnapshot } from './export'

const mocks = vi.hoisted(() => ({ contexts: [] as any[], rigs: [] as any[], createRig: vi.fn(), samples: null as Float32Array[] | null }))
vi.mock('tone', () => ({ OfflineContext: class {
  args: unknown[]
  buffer: any
  constructor(...args: unknown[]) {
    this.args = args
    this.buffer = { numberOfChannels: 2, getChannelData: (i: number) => mocks.samples?.[i] ?? new Float32Array([0.2 + i, 0.4 + i]) }
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
const mix: MixSettings = { masterVolume: 0.8, layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false }, lead: { level: 0.55, muted: false } }, ambienceOn: true }

function setupRig() {
  const rig = { trigger: vi.fn(), startAmbience: vi.fn(), dispose: vi.fn() }
  mocks.rigs.push(rig)
  mocks.createRig.mockReturnValueOnce(rig)
  return rig
}

afterEach(() => { mocks.contexts.length = 0; mocks.rigs.length = 0; mocks.createRig.mockReset(); mocks.samples = null })

function expectDetachedFrozen(copy: unknown, original: unknown, path = 'root'): void {
  if (copy !== null && typeof copy === 'object') {
    expect(Object.isFrozen(copy), `${path} should be frozen`).toBe(true)
    expect(copy, `${path} should be detached`).not.toBe(original)
    expect(Object.isFrozen(original), `${path} original should remain unfrozen`).toBe(false)
    for (const key of Object.keys(copy)) {
      expectDetachedFrozen((copy as Record<string, unknown>)[key], (original as Record<string, unknown>)[key], `${path}.${key}`)
    }
  }
}

describe('export snapshot', () => {
  it('preserves values in an isolated, recursively frozen copy', () => {
    const s = structuredClone(score)
    const r = structuredClone(recipe)
    const p = structuredClone(preset)
    const m = structuredClone(mix)
    const snapshot = createExportSnapshot(s, r, p, m)
    expect(snapshot).toEqual({ score: s, recipe: r, preset: p, mix: m })
    expectDetachedFrozen(snapshot.score, s, 'score')
    expectDetachedFrozen(snapshot.recipe, r, 'recipe')
    expectDetachedFrozen(snapshot.preset, p, 'preset')
    expectDetachedFrozen(snapshot.mix, m, 'mix')
  })

  it('keeps original inputs unfrozen and independently mutable', () => {
    const s = structuredClone(score)
    const r = structuredClone(recipe)
    const p = structuredClone(preset)
    const m = structuredClone(mix)
    const snapshot = createExportSnapshot(s, r, p, m)
    const expected = structuredClone({ score: s, recipe: r, preset: p, mix: m })

    s.events[0].velocity = 0.01
    s.events.push({ ...s.events[0], step: 5 })
    s.chords[0].voicing.push(70)
    s.trace[0].uses.push('mutated')
    r.tempoBpm = 99
    p.sound.reverbSend = 0.99
    p.chordRing[0].symbol = 'X'
    m.layers.drums.level = 0.01
    m.ambienceOn = false

    expect(s.events).toHaveLength(2)
    expect(s.events[0].velocity).toBe(0.01)
    expect(s.chords[0].voicing).toContain(70)
    expect(s.trace[0].uses).toContain('mutated')
    expect(r.tempoBpm).toBe(99)
    expect(p.sound.reverbSend).toBe(0.99)
    expect(p.chordRing[0].symbol).toBe('X')
    expect(m.layers.drums.level).toBe(0.01)
    expect(m.ambienceOn).toBe(false)
    expect(snapshot).toEqual(expected)
    expect(() => { (snapshot.recipe as { tempoBpm: number }).tempoBpm = 1 }).toThrow()
  })
})

describe('export fade and repeatability', () => {
  it('fades copied stereo PCM linearly without changing inputs or prefix', async () => {
    const leftInput = new Float32Array(44100).fill(0.05)
    const rightInput = new Float32Array(44100).fill(-0.05)
    mocks.samples = [leftInput, rightInput]
    setupRig()
    setupRig()
    const { renderPhrase } = await import('./export')
    const snapshot = createExportSnapshot({ ...score, events: [] }, recipe, preset, mix)
    const first = await renderPhrase(snapshot)
    const second = await renderPhrase(snapshot)
    const fadeLength = Math.round(0.5 * 44100)
    const boundary = leftInput.length - fadeLength
    expect(first.channels[0][boundary - 1]).toBeCloseTo(0.05, 7)
    expect(first.channels[1][boundary - 1]).toBeCloseTo(-0.05, 7)
    expect(first.channels[0][boundary]).toBeCloseTo(0.05, 7)
    expect(first.channels[0][boundary + Math.floor((fadeLength - 1) / 2)]).toBeCloseTo(0.05 * (1 - Math.floor((fadeLength - 1) / 2) / (fadeLength - 1)), 7)
    expect(first.channels[0].at(-1)).toBe(0)
    expect(first.channels[1].at(-1)).toBe(0)
    expect(leftInput[boundary]).toBeCloseTo(0.05, 7)
    expect(rightInput[boundary]).toBeCloseTo(-0.05, 7)
    let maxDifference = 0
    let tailSquares = 0
    for (let i = 0; i < first.channels[0].length; i++) {
      maxDifference = Math.max(maxDifference, Math.abs(first.channels[0][i] - second.channels[0][i]), Math.abs(first.channels[1][i] - second.channels[1][i]))
      if (i >= first.channels[0].length - 441) tailSquares += first.channels[0][i] ** 2 + first.channels[1][i] ** 2
    }
    expect(maxDifference).toBe(0)
    expect(Math.sqrt(tailSquares / (441 * 2))).toBeLessThan(0.001)
    expect(first.channels[0]).not.toBe(second.channels[0])
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
    const frames = Math.round((128 * 60 / 72 / 4 + 2) * 44100)
    mocks.samples = [new Float32Array(frames).fill(0.2), new Float32Array(frames).fill(0.7)]
    const { renderPhrase } = await import('./export')
    const data = await renderPhrase(snapshot)
    expect(rig.startAmbience).toHaveBeenCalledWith(0)
    expect(rig.trigger.mock.calls).toEqual([[events[0], (1 + 0.12 + 0.1) * 60 / 72 / 4, 3 * 60 / 72 / 4], [events[1], (1 + 0.12 + 0.05) * 60 / 72 / 4, 2 * 60 / 72 / 4]])
    expect(data.channels[0]).toHaveLength(frames)
    expect(data.channels[1]).toHaveLength(frames)
    const boundary = frames - Math.round(0.5 * 44100)
    expect(data.channels[0][0]).toBeCloseTo(0.2, 6)
    expect(data.channels[0][boundary - 1]).toBeCloseTo(0.2, 6)
    expect(data.channels[1][0]).toBeCloseTo(0.7, 6)
    expect(data.channels[1][boundary - 1]).toBeCloseTo(0.7, 6)
    expect(data.channels[0].at(-1)).toBe(0)
    expect(data.channels[1].at(-1)).toBe(0)
    expect(data.channels[0]).not.toBe(mocks.samples[0])
    data.channels[0][0] = 99
    expect(mocks.contexts[0].buffer.getChannelData(0)[0]).toBeCloseTo(0.2)
    expect(rig.dispose).toHaveBeenCalledOnce()
  })

  it('scales a render that would clip so its peak sits at the export ceiling', async () => {
    const { guardPeaks, EXPORT_PEAK_CEILING } = await import('./export')
    const loud = [Float32Array.from([0.5, -1.2, 0.3]), Float32Array.from([0.1, 0.2, 0.9])]
    guardPeaks(loud)
    expect(Math.max(...loud.flatMap(channel => [...channel].map(Math.abs)))).toBeCloseTo(EXPORT_PEAK_CEILING, 6)
    expect(loud[0]![0]! / loud[1]![2]!).toBeCloseTo(0.5 / 0.9, 6)
    const quiet = [Float32Array.from([0.5])]
    guardPeaks(quiet)
    expect(quiet[0]![0]).toBe(0.5)
  })

  it('cleans up if rig creation fails', async () => {
    mocks.createRig.mockImplementationOnce(() => { throw new Error('creation failed') })
    const { renderPhrase } = await import('./export')
    await expect(renderPhrase(createExportSnapshot(score, recipe, preset, mix))).rejects.toThrow('creation failed')
    expect(mocks.contexts[0].dispose).toHaveBeenCalledOnce()
  })
})
