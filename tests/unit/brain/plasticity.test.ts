import { describe, expect, it } from 'vitest'
import { plasticityStep } from '../../../src/brain/learn'
import { PLASTICITY_CONFIGURATION, plasticWeights } from '../../../src/brain/model'
import { createReadout, freshRuntime, perform } from '../../../src/brain/perform'
import { createRng } from '../../../src/music/rng'
import { songModel } from './helpers'

describe('reward-modulated plasticity inside the circuit', () => {
  it('only premotor and song neurons onto song and wing motor neurons can learn', async () => {
    const model = await songModel()
    expect(model.plasticSlots.length).toBeGreaterThan(10_000)
    for (const slot of model.plasticSlots.slice(0, 500)) {
      const target = model.circuit.neurons[[...model.rowStart].findIndex((start, row) => start <= slot && slot < model.rowStart[row + 1]!)]!
      expect(['song', 'motor']).toContain(target.role)
      expect(['premotor', 'song']).toContain(model.circuit.neurons[model.col[slot]!]!.role)
    }
  })

  it('collects eligibility, moves gains with reward and weight sign, and keeps them bounded', async () => {
    const model = await songModel()
    const gains = new Float32Array(model.plasticSlots.length).fill(1)
    const played = perform(model, createReadout(model), freshRuntime(model, createRng('mood')), { temperature: 1, rng: createRng('play'), presetId: 'rainy-windowsill', gains, eligibility: true })
    const eligibility = played.eligibility!
    expect(eligibility).toHaveLength(gains.length)
    expect(eligibility.some(value => value !== 0)).toBe(true)
    plasticityStep(model, gains, [eligibility], [1], 0.01)
    const index = eligibility.findIndex((value, i) => Math.abs(value) > 1e-6 && model.weight[model.plasticSlots[i]!]! > 0)
    expect(Math.sign(gains[index]! - 1)).toBe(Math.sign(eligibility[index]!))
    for (let step = 0; step < 400; step++) plasticityStep(model, gains, [eligibility], [1], 0.05)
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(PLASTICITY_CONFIGURATION.minGain)
    expect(Math.max(...gains)).toBeLessThanOrEqual(PLASTICITY_CONFIGURATION.maxGain)
    // Anatomy itself is never edited: gains apply to a copy of the weights.
    const weights = plasticWeights(model, gains)
    expect(weights).not.toBe(model.weight)
    expect(() => plasticWeights(model, new Float32Array(3))).toThrow(/match/)
  })
})
