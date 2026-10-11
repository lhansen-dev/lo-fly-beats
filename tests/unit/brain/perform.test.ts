import { describe, expect, it } from 'vitest'
import { arrangePhrase } from '../../../src/brain/arrange'
import { encodeLeadMove, leadDegrees, leadMidi, LEAD_START_DEGREE, resolveLeadDegree } from '../../../src/brain/melody'
import { cloneRuntime, createReadout, freshRuntime, perform } from '../../../src/brain/perform'
import { createTutor, tutorPhrase } from '../../../src/brain/tutor'
import { HEADS, LEAD_DEGREES, LOOP_BACK, LOOP_HEADS, LOOP_LAYER, OUTPUT_SIZE, PHRASE_STEPS, STEP_HEADS } from '../../../src/brain/vocabulary'
import { createRng } from '../../../src/music/rng'
import type { SessionRecipe } from '../../../src/music/types'
import { PRESETS } from '../../../src/presets/presets'
import { songModel } from './helpers'

const recipe = (presetId: SessionRecipe['presetId']): SessionRecipe => ({ recipeVersion: 1, presetId, sessionSeed: 7, variation: 0.5, tempoBpm: 72 })

function randomReadout(length: number, seed: string): Float32Array {
  const rng = createRng(seed)
  return Float32Array.from({ length }, () => (rng.float() - 0.5) * 0.4)
}

describe('the fly performing', () => {
  it('is reproducible, never mutates its starting state, and plays only legal actions', async () => {
    const model = await songModel()
    const readout = randomReadout(createReadout(model).length, 'perform')
    const start = freshRuntime(model, createRng('mood'))
    const before = cloneRuntime(start)
    const play = () => perform(model, readout, start, { temperature: 1, rng: createRng('same'), presetId: 'rainy-windowsill' })
    const first = play()
    expect(play().actions).toEqual(first.actions)
    expect([...start.state]).toEqual([...before.state])
    expect(start.history).toEqual(before.history)
    for (const head of STEP_HEADS) {
      expect(first.actions.steps[head]).toHaveLength(PHRASE_STEPS)
      expect(first.actions.steps[head].every(action => action >= 0 && action < HEADS[head].length)).toBe(true)
    }
    expect(first.actions.chords).toHaveLength(4)
    // Without any earlier bars, the fly cannot loop: the first bar is always fresh.
    for (const head of LOOP_HEADS) expect(first.actions.loops[head][0]).toBe(0)
  })

  it('copies looped bars exactly from what it played', async () => {
    const model = await songModel()
    const readout = randomReadout(createReadout(model).length, 'loops')
    let runtime = freshRuntime(model)
    for (let phrase = 0; phrase < 3; phrase++) {
      const result = perform(model, readout, runtime, { temperature: 1, rng: createRng(`loops|${phrase}`), presetId: 'overripe-2am' })
      const played = [...runtime.history.map(bar => bar), ...Array.from({ length: 8 }, (_, bar) => Object.fromEntries(STEP_HEADS.map(head => [head, result.actions.steps[head].slice(bar * 16, bar * 16 + 16)])))]
      for (const head of LOOP_HEADS) {
        result.actions.loops[head].forEach((loop, bar) => {
          const back = LOOP_BACK[loop]!
          if (!back) return
          const source = played[runtime.history.length + bar - back]!
          for (const layer of LOOP_LAYER[head]) expect(result.actions.steps[layer].slice(bar * 16, bar * 16 + 16)).toEqual(source[layer])
        })
      }
      runtime = result.runtime
    }
  })

  it('reproduces the tutor exactly under teacher forcing, for every preset', async () => {
    const model = await songModel()
    const readout = createReadout(model)
    for (const presetId of Object.keys(PRESETS) as SessionRecipe['presetId'][]) {
      const rng = createRng(`teacher|${presetId}`)
      const tutor = createTutor(presetId, rng)
      let runtime = freshRuntime(model)
      for (let phrase = 0; phrase < 7; phrase++) {
        const teacher = tutorPhrase(tutor, rng)
        const result = perform(model, readout, runtime, { temperature: 1, rng, teacher, presetId, record: true })
        expect(result.actions).toEqual(teacher)
        expect(result.features).toHaveLength(PHRASE_STEPS)
        runtime = result.runtime
      }
    }
  })

  it('arranges a playable score: in range, sorted, monophonic bass and lead, chords from the preset', async () => {
    const model = await songModel()
    const readout = randomReadout(OUTPUT_SIZE * (model.readoutNeurons.length + 1), 'arrange')
    for (const presetId of Object.keys(PRESETS) as SessionRecipe['presetId'][]) {
      const result = perform(model, readout, freshRuntime(model), { temperature: 1, rng: createRng(presetId), presetId })
      const score = arrangePhrase(model, 3, recipe(presetId), 4, result.actions, result.activity)
      expect(score.phraseIndex).toBe(4)
      expect(score.chords.map(chord => chord.symbol)).toEqual(result.actions.chords.map(ring => PRESETS[presetId].chordRing[ring]!.symbol))
      expect(score.trace).toHaveLength(32)
      expect(score.brain?.readoutRevision).toBe(3)
      for (let index = 0; index < score.events.length; index++) {
        const event = score.events[index]!
        expect(event.step).toBeGreaterThanOrEqual(0)
        expect(event.step + event.durationSteps).toBeLessThanOrEqual(128)
        expect(event.durationSteps).toBeGreaterThanOrEqual(1)
        expect(event.velocity).toBeGreaterThan(0)
        expect(event.velocity).toBeLessThanOrEqual(1)
        if (index > 0) expect(score.events[index - 1]!.step).toBeLessThanOrEqual(event.step)
      }
      for (const layer of ['bass', 'lead'] as const) {
        const notes = score.events.filter(event => event.layer === layer)
        for (let index = 1; index < notes.length; index++) expect(notes[index - 1]!.step + notes[index - 1]!.durationSteps).toBeLessThanOrEqual(notes[index]!.step)
      }
      for (const note of score.events.filter(event => event.layer === 'bass')) expect(note.midi).toBeGreaterThanOrEqual(35)
      for (const note of score.events.filter(event => event.layer === 'lead')) {
        expect(note.midi).toBeGreaterThanOrEqual(leadMidi(presetId, 0))
        expect(note.midi).toBeLessThanOrEqual(leadMidi(presetId, LEAD_DEGREES - 1))
      }
    }
  })
})

describe('relative melodies', () => {
  it('encodes any target the tutor sings and resolves it back', () => {
    for (const presetId of Object.keys(PRESETS) as SessionRecipe['presetId'][]) {
      for (let ring = 0; ring < 6; ring++) {
        for (let from = 0; from < LEAD_DEGREES; from++) {
          for (let to = Math.max(0, from - 4); to <= Math.min(LEAD_DEGREES - 1, from + 4); to++) {
            const { action, degree } = encodeLeadMove(from, to, presetId, ring)
            expect(degree).toBe(to)
            expect(resolveLeadDegree(from, action, presetId, ring)).toBe(to)
          }
        }
      }
    }
  })

  it('folds moves past the range back by an octave', () => {
    const up4 = (HEADS.lead as readonly string[]).indexOf('up4')
    expect(resolveLeadDegree(LEAD_DEGREES - 1, up4, 'rainy-windowsill', 0)).toBe(LEAD_DEGREES - 1 + 4 - 7)
    const { degrees, end } = leadDegrees([up4, 0, up4], [0, 0, 0, 0], 'rainy-windowsill', LEAD_START_DEGREE)
    expect(degrees).toEqual([LEAD_START_DEGREE + 4, null, LEAD_START_DEGREE + 8 - 7])
    expect(end).toBe(LEAD_START_DEGREE + 1)
  })
})
