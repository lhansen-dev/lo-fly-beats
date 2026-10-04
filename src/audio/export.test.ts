import { describe, expect, it } from 'vitest'
import type { PhraseScore, SessionRecipe } from '../music/types'
import { PRESETS } from '../presets/presets'
import type { PresetDefinition } from '../presets/types'
import type { MixSettings } from './rig'
import { createExportSnapshot } from './export'

const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 7, variation: 0.4, tempoBpm: 72 }
const score: PhraseScore = {
  scoreVersion: 1, mappingVersion: 2, presetId: recipe.presetId, presetVersion: 1, sessionSeed: 7,
  phraseIndex: 2, compositionPhraseIndex: 2, variation: 0.4, graphChecksum: 'abc', bars: 8, stepsPerBar: 16,
  chords: [{ bar: 0, traceBeat: 0, ringIndex: 0, ringStepped: false, symbol: 'Dm9', rootMidi: 38, voicing: [57, 60, 64, 65] }],
  events: [{ layer: 'keys', step: 0, microOffset: 0.02, durationSteps: 4, midi: 60, drum: null, velocity: 0.7, traceBeat: 0 }],
  trace: [{ beat: 0, kind: 'start', neuronId: '1', bar: 0, beatInBar: 0, neuronType: 'MBON01', uses: ['chord Dm9'] }],
  fill: false,
}
const preset: PresetDefinition = structuredClone(PRESETS['rainy-windowsill'])
const mix: MixSettings = {
  masterVolume: 0.8,
  layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false } },
  ambienceOn: true,
}

describe('export snapshot', () => {
  it('preserves values in an isolated, recursively frozen copy', () => {
    const sourcePreset = structuredClone(preset)
    const snapshot = createExportSnapshot(score, recipe, sourcePreset, mix)

    expect(snapshot).toEqual({ score, recipe, preset: sourcePreset, mix })
    expect(snapshot.score).not.toBe(score)
    expect(snapshot.score.events).not.toBe(score.events)
    expect(snapshot.score.events[0]).not.toBe(score.events[0])
    expect(snapshot.score.chords[0].voicing).not.toBe(score.chords[0].voicing)
    expect(snapshot.score.trace[0].uses).not.toBe(score.trace[0].uses)
    expect(snapshot.preset.drums.main.kick).not.toBe(sourcePreset.drums.main.kick)
    expect(snapshot.preset.drums.main.kick[0]).not.toBe(sourcePreset.drums.main.kick[0])
    expect(snapshot.mix.layers).not.toBe(mix.layers)
    expect(snapshot.mix.layers.keys).not.toBe(mix.layers.keys)

    for (const value of [snapshot, snapshot.score, snapshot.score.events, snapshot.score.events[0], snapshot.score.chords[0], snapshot.score.chords[0].voicing, snapshot.score.trace[0], snapshot.score.trace[0].uses, snapshot.preset.sound, snapshot.preset.drums.main, snapshot.preset.drums.main.kick, snapshot.preset.drums.main.kick[0], snapshot.mix.layers, snapshot.mix.layers.keys]) {
      expect(Object.isFrozen(value)).toBe(true)
    }

    score.events[0].midi = 48
    score.chords[0].voicing[0] = 1
    score.trace[0].uses.push('changed')
    ;(sourcePreset.drums.main.kick[0] as unknown as [number, number])[1] = 0.1
    mix.layers.keys.level = 0.1
    expect(snapshot.score.events[0].midi).toBe(60)
    expect(snapshot.score.chords[0].voicing[0]).toBe(57)
    expect(snapshot.score.trace[0].uses).toEqual(['chord Dm9'])
    expect(snapshot.preset.drums.main.kick[0][1]).toBe(0.9)
    expect(snapshot.mix.layers.keys.level).toBe(0.6)
    expect(Object.isFrozen(score)).toBe(false)
    expect(Object.isFrozen(sourcePreset.drums.main.kick[0])).toBe(false)
    expect(Object.isFrozen(mix.layers.keys)).toBe(false)
  })
})
