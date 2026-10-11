import { describe, expect, it } from 'vitest'
import { critique } from '../../../src/brain/critic'
import { createReadout, freshRuntime, perform } from '../../../src/brain/perform'
import { createTutor, tutorPhrase } from '../../../src/brain/tutor'
import { actionIndex } from '../../../src/brain/vocabulary'
import { createRng } from '../../../src/music/rng'
import { songModel } from './helpers'

describe('song form', () => {
  it('the tutor opens with an intro and drops the drums for half of a breakdown', () => {
    const rng = createRng('form')
    const tutor = createTutor('rainy-windowsill', rng)
    const phrases = Array.from({ length: 6 }, () => tutorPhrase(tutor, rng))
    expect(phrases[0]!.section).toBe(actionIndex('section', 'intro'))
    const breakdown = phrases.find(phrase => phrase.section === actionIndex('section', 'breakdown'))!
    expect(breakdown.steps.kick.slice(0, 64).every(value => value === 0)).toBe(true)
    expect(breakdown.steps.kick.slice(64).some(value => value > 0)).toBe(true)
  })

  it('habituation counts consecutive grooves and resets on a change of section', async () => {
    const model = await songModel()
    const rng = createRng('habituation')
    const tutor = createTutor('overripe-2am', rng)
    let runtime = freshRuntime(model)
    for (let phrase = 0; phrase < 6; phrase++) {
      const teacher = tutorPhrase(tutor, rng)
      const before = runtime.grooveRun
      runtime = perform(model, createReadout(model), runtime, { temperature: 1, rng, teacher, presetId: 'overripe-2am' }).runtime
      expect(runtime.grooveRun).toBe(teacher.section === actionIndex('section', 'groove') ? before + 1 : 0)
    }
  })

  it('the critic rewards intros at the start and breakdowns after a run of grooves', () => {
    const rng = createRng('critic-form')
    const tutor = createTutor('fruit-bowl-finals', rng)
    const phrases = Array.from({ length: 6 }, () => tutorPhrase(tutor, rng))
    const groove = phrases.find(phrase => phrase.section === actionIndex('section', 'groove'))!
    const asSection = (name: 'groove' | 'breakdown' | 'intro') => ({ ...groove, section: actionIndex('section', name) })
    const grooves = [asSection('groove'), asSection('groove'), asSection('groove')]
    expect(critique(asSection('intro'), 'fruit-bowl-finals', []).structure).toBeGreaterThan(critique(asSection('intro'), 'fruit-bowl-finals', grooves).structure)
    expect(critique(asSection('groove'), 'fruit-bowl-finals', grooves).notes).toContain('the song needed a change of section')
  })
})
