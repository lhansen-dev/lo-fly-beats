import { describe, expect, it } from 'vitest'
import { estimateSpectralRadius, stepBrain, transmitterSign } from '../../../src/brain/model'
import { INPUT_SIZE, senseInputs, SILENCE } from '../../../src/brain/senses'
import { songCircuit, songModel } from './helpers'

describe('brain model', () => {
  it('signs each connection by the presynaptic transmitter and keeps anatomy in the circuit', async () => {
    const [circuit, model] = await Promise.all([songCircuit(), songModel()])
    let checked = 0
    for (let target = 0; target < model.size && checked < 2000; target++) {
      for (let slot = model.rowStart[target]!; slot < model.rowStart[target + 1]!; slot++, checked++) {
        const sign = transmitterSign(circuit.neurons[model.col[slot]!]!.nt)
        expect(Math.sign(model.weight[slot]!)).toBe(Math.sign(sign))
      }
    }
    expect(model.rowStart[model.size]).toBe(circuit.source.length)
    expect(transmitterSign('gaba')).toBe(-1)
    expect(transmitterSign('glutamate')).toBe(-1)
    expect(transmitterSign('acetylcholine')).toBe(1)
  })

  it('scales recurrence to a spectral radius of one, including the permuted control', async () => {
    for (const connectivity of ['anatomical', 'source-permuted'] as const) {
      const model = await songModel(connectivity)
      expect(estimateSpectralRadius(model.size, model.rowStart, model.col, model.weight)).toBeCloseTo(1, 1)
    }
  })

  it('permutes sources only, keeping every row count; zero connectivity has no recurrence', async () => {
    const [anatomical, permuted, zero] = await Promise.all([songModel(), songModel('source-permuted'), songModel('zero')])
    expect([...permuted.rowStart]).toEqual([...anatomical.rowStart])
    expect([...permuted.col]).not.toEqual([...anatomical.col])
    expect(zero.weight.every(value => value === 0)).toBe(true)
  })

  it('hears only through ear and wing-sense neurons and reads out only from the song side', async () => {
    const model = await songModel()
    model.circuit.neurons.forEach((neuron, index) => {
      expect(model.hearing[index] === 1).toBe(neuron.role === 'ear' || neuron.role === 'wing')
    })
    for (const index of model.readoutNeurons) expect(['premotor', 'song', 'motor']).toContain(model.circuit.neurons[index]!.role)
  })

  it('stays bounded and deterministic over many beats', async () => {
    const model = await songModel()
    const run = () => {
      let state = new Float32Array(model.size)
      let next = new Float32Array(model.size)
      const inputs = new Float32Array(INPUT_SIZE)
      for (let step = 0; step < 512; step++) {
        stepBrain(model, state, senseInputs(step, { ...SILENCE, kick: step % 16 === 0 ? 1 : 0 }, inputs), next)
        ;[state, next] = [next, state]
      }
      return state
    }
    const first = run()
    expect(first.every(value => Number.isFinite(value) && Math.abs(value) <= 1)).toBe(true)
    expect([...run()]).toEqual([...first])
    expect(() => stepBrain(model, first, new Float32Array(INPUT_SIZE), first)).toThrow(/separate/)
  })
})
