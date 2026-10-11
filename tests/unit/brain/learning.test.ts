import { describe, expect, it } from 'vitest'
import { checkpointMatches, decodeReadout, encodeReadout } from '../../../src/brain/checkpoint'
import { critique } from '../../../src/brain/critic'
import { accumulate, createBaseline, createOptimizer, lesson, practiceBatch } from '../../../src/brain/learn'
import { FlyMind, type BrainStore, type SavedBrain } from '../../../src/brain/mind'
import { createReadout, freshRuntime, perform, readoutWidth } from '../../../src/brain/perform'
import { createTutor, tutorPhrase } from '../../../src/brain/tutor'
import { OUTPUT_SIZE } from '../../../src/brain/vocabulary'
import { createRng } from '../../../src/music/rng'
import type { SessionRecipe } from '../../../src/music/types'
import { songModel } from './helpers'

describe('the banana critic', () => {
  it('prefers the tutor to random noise and stays within bounds', async () => {
    const model = await songModel()
    const rng = createRng('critic')
    const tutor = createTutor('rainy-windowsill', rng)
    const noise = Float32Array.from({ length: createReadout(model).length }, () => (rng.float() - 0.5) * 2)
    let tutorTotal = 0
    let noiseTotal = 0
    let runtime = freshRuntime(model)
    for (let phrase = 0; phrase < 6; phrase++) {
      const good = critique(tutorPhrase(tutor, rng), 'rainy-windowsill')
      const played = perform(model, noise, runtime, { temperature: 1, rng, presetId: 'rainy-windowsill' })
      runtime = played.runtime
      const bad = critique(played.actions, 'rainy-windowsill')
      for (const value of [good.total, bad.total, good.drums, bad.lead]) expect(value).toBeGreaterThanOrEqual(0)
      for (const value of [good.total, bad.total]) expect(value).toBeLessThanOrEqual(1)
      expect(good.bars.drums).toHaveLength(8)
      tutorTotal += good.total
      noiseTotal += bad.total
    }
    expect(tutorTotal / 6).toBeGreaterThan(0.8)
    expect(noiseTotal / 6).toBeLessThan(0.6)
  })
})

describe('school and practice', () => {
  it('school lowers the loss of a repeated lesson and only changes the readout', async () => {
    const model = await songModel()
    const weightsBefore = model.weight.slice()
    const readout = createReadout(model)
    const optimizer = createOptimizer(readout.length)
    const rng = createRng('school')
    const teacher = tutorPhrase(createTutor('overripe-2am', rng), rng)
    const loss = () => {
      const result = perform(model, readout, freshRuntime(model), { temperature: 1, rng: createRng('measure'), teacher, presetId: 'overripe-2am', record: true })
      const stats = accumulate(readout, readoutWidth(model), result, new Float32Array(readout.length))
      return Object.values(stats).reduce((sum, head) => sum + head!.loss, 0)
    }
    const before = loss()
    for (let index = 0; index < 5; index++) lesson(model, readout, optimizer, freshRuntime(model), teacher, 'overripe-2am', createRng(`lesson|${index}`), 0.003)
    expect(loss()).toBeLessThan(before * 0.8)
    expect([...model.weight]).toEqual([...weightsBefore])
    expect(readout.every(Number.isFinite)).toBe(true)
  })

  it('practice keeps weights finite and returns critiques for each player', async () => {
    const model = await songModel()
    const readout = createReadout(model)
    const players = [0, 1].map(() => ({ runtime: freshRuntime(model), presetId: 'fruit-bowl-finals' as const, previous: [] }))
    const { results } = practiceBatch(model, readout, createOptimizer(readout.length), createBaseline(), players, createRng('practice'))
    expect(results).toHaveLength(2)
    expect(results.every(result => result.critic.total >= 0 && result.critic.total <= 1)).toBe(true)
    expect(readout.every(Number.isFinite)).toBe(true)
    expect(readout.some(value => value !== 0)).toBe(true)
  })
})

describe('checkpoints and the persistent fly', () => {
  it('round-trips the readout through int8 with bounded error', async () => {
    const model = await songModel()
    const rng = createRng('quantize')
    const readout = Float32Array.from({ length: OUTPUT_SIZE * readoutWidth(model) }, () => (rng.float() - 0.5) * 3)
    const decoded = decodeReadout(encodeReadout(readout, readoutWidth(model)), model)
    let worst = 0
    for (let index = 0; index < readout.length; index++) worst = Math.max(worst, Math.abs(decoded[index]! - readout[index]!))
    expect(worst).toBeLessThanOrEqual(1.5 / 127 / 2 + 1e-6)
    expect(() => decodeReadout(new Uint8Array(10), model)).toThrow(/size/)
  })

  it('adopts only played phrases, learns from bananas, saves, restores, and forgets', async () => {
    const model = await songModel()
    const shipped = createReadout(model)
    const metadata = {
      schemaVersion: 1 as const, brainId: 'test', brainVersion: 3 as const, circuitChecksum: model.circuit.checksum, modelSeed: 1, modelVersion: 1,
      connectivity: 'anatomical' as const, readoutNeurons: model.readoutNeurons.length, outputs: OUTPUT_SIZE, tutorVersion: 1, criticVersion: 2, learningVersion: 1,
      experience: { schoolLessons: 10, practicePhrases: 20, listeningPhrases: 0, bananasFromListeners: 0 }, history: [], trainedAt: '2026-10-11T00:00:00.000Z',
      readout: { encoding: 'int8-row-scaled-v1' as const, file: 'readout.bin.gzip', bytes: 1, sha256: '0'.repeat(64) },
    }
    expect(checkpointMatches(metadata, model)).toBe(true)
    let saved: SavedBrain | null = null
    const store: BrainStore = { load: async () => saved, save: async brain => { saved = brain }, clear: async () => { saved = null } }
    const mind = new FlyMind(model, shipped, metadata, store)
    const recipe: SessionRecipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 3, variation: 0.5, tempoBpm: 72 }
    const first = mind.compose(recipe, 0, true)
    // Composing again from the same state gives the same phrase: preparation never advances the fly.
    const again = mind.compose(recipe, 0, true)
    expect(again.score.events).toEqual(first.score.events)
    expect(mind.adopt(first.id)).toBe(false)
    expect(mind.adopt(again.id)).toBe(false)
    expect(mind.state().experience.listeningPhrases).toBe(1)
    const second = mind.compose(recipe, 1, false)
    expect(second.score.events).not.toEqual(first.score.events)
    mind.adopt(second.id)
    expect(mind.banana(second.id)).toBe(true)
    expect(mind.banana('never-played')).toBe(false)
    await mind.persist()
    expect(saved).not.toBeNull()
    expect(saved!.experience.bananasFromListeners).toBe(1)
    const restored = new FlyMind(model, shipped, metadata, store)
    await restored.restore()
    expect(restored.state().source).toBe('saved')
    expect(restored.state().experience.listeningPhrases).toBe(2)
    await restored.forget()
    expect(restored.state().experience).toEqual(metadata.experience)
    expect(saved).toBeNull()
    // An incompatible saved fly is ignored.
    saved = { ...(await (async () => { await mind.persist(); return saved! })()), circuitChecksum: 'f'.repeat(64) }
    const ignoring = new FlyMind(model, shipped, metadata, store)
    await ignoring.restore()
    expect(ignoring.state().source).toBe('shipped')
  })
})
