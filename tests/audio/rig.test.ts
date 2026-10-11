import { describe, expect, it } from 'vitest'
import * as Tone from 'tone'
import branchingCircuit from '../fixtures/graphs/branching/circuit.json'
import branchingManifest from '../fixtures/graphs/branching/manifest.json'
import { buildGraph } from '../../src/connectome/graph'
import { createRig, DEFAULT_MIX, type MixSettings } from '../../src/audio/rig'
import { composePhrase } from '../../src/music/compose'
import { eventTimeSeconds, secondsPerStep } from '../../src/audio/timing'
import { PRESETS } from '../../src/presets/presets'
import type { PresetId } from '../../src/presets/types'
import type { SessionRecipe } from '../../src/music/types'

const graph = buildGraph(branchingManifest, branchingCircuit, branchingManifest.output.sha256)

async function renderFirstBar(presetId: PresetId, mix: MixSettings = DEFAULT_MIX) {
  const preset = PRESETS[presetId]
  const recipe: SessionRecipe = { recipeVersion: 1, presetId, sessionSeed: 1, variation: 0.5, tempoBpm: preset.tempoBpm }
  const score = composePhrase(graph, recipe, 0)
  const events = score.events.filter(event => event.step < 16)
  const stepSeconds = secondsPerStep(recipe.tempoBpm)
  const context = new Tone.OfflineContext(2, 16 * stepSeconds + 1, 44100)
  const rig = createRig(context, preset.sound, mix)
  try {
    rig.startAmbience(0)
    for (const event of events) {
      rig.trigger(event, eventTimeSeconds(event, recipe.tempoBpm, preset.swing), event.durationSteps * stepSeconds)
    }
    const rendered = await context.render()
    try {
      const buffer = rendered.get()!
      const samples = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).slice())
      let peak = 0
      let sumSquares = 0
      let count = 0
      for (const channel of samples) {
        for (const sample of channel) {
          expect(Number.isNaN(sample)).toBe(false)
          peak = Math.max(peak, Math.abs(sample))
          sumSquares += sample * sample
          count++
        }
      }
      return { peak, rms: Math.sqrt(sumSquares / count), samples }
    } finally {
      rendered.dispose()
    }
  } finally {
    rig.dispose()
    context.dispose()
  }
}

describe('instrument rig browser audio rendering', () => {
  it.each(Object.keys(PRESETS) as PresetId[])('renders %s with finite, bounded, audible output', async presetId => {
    const result = await renderFirstBar(presetId)
    expect(result.peak).toBeLessThanOrEqual(1)
    expect(result.rms).toBeGreaterThan(0.01)
  })

  it('is silent when every layer is muted and ambience is off', async () => {
    const mix: MixSettings = {
      masterVolume: 0.8,
      layers: {
        drums: { level: 0.8, muted: true },
        bass: { level: 0.7, muted: true },
        keys: { level: 0.6, muted: true },
        lead: { level: 0.55, muted: true },
      },
      ambienceOn: false,
    }
    const result = await renderFirstBar('rainy-windowsill', mix)
    expect(result.peak).toBeLessThan(0.001)
  })

  it('changes the rendered output when only drums are muted', async () => {
    const full = await renderFirstBar('rainy-windowsill')
    const drumsMuted: MixSettings = {
      ...DEFAULT_MIX,
      layers: { ...DEFAULT_MIX.layers, drums: { ...DEFAULT_MIX.layers.drums, muted: true } },
    }
    const withoutDrums = await renderFirstBar('rainy-windowsill', drumsMuted)
    expect(withoutDrums.samples).not.toEqual(full.samples)
  })
})
