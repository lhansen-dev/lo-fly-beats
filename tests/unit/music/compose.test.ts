import { describe, expect, it } from 'vitest'
import { getPreset, PRESETS } from '../../../src/presets/presets'
import { CHORD_QUALITIES } from '../../../src/music/harmony'
import { buildPhrasePlan, composePhrase, renderBassCell, renderPhrasePlan } from '../../../src/music/compose'
import { STRONG_BASS_CELLS, WEAK_BASS_CELLS } from '../../../src/music/patterns'
import { fixtureGraph } from '../helpers/fixtureGraph'
import type { PhraseScore, SessionRecipe } from '../../../src/music/types'

const variations = [0, 0.5, 1]
const graph = fixtureGraph()
const recipe = (presetId: SessionRecipe['presetId'], seed: number, variation: number): SessionRecipe => ({
  recipeVersion: 1, presetId, sessionSeed: seed, variation, tempoBpm: 72,
})

function assertComposition(score: PhraseScore): void {
  const preset = getPreset(score.presetId)
  expect(score.chords.map(chord => chord.bar)).toEqual([0, 2, 4, 6])
  expect(score.trace).toHaveLength(32)
  score.trace.forEach((step, beat) => {
    expect(step.bar).toBe(Math.floor(beat / 4))
    expect(step.beatInBar).toBe(beat % 4)
    if (step.kind === 'edge') expect(graph.outgoing.get(step.from)).toContainEqual({ target: step.neuronId, synapseCount: step.synapseCount })
    else if (step.kind === 'start' || step.kind === 'restart') expect(graph.startNeuronIds).toContain(step.neuronId)
  })
  for (const event of score.events) {
    expect(event.step).toBeGreaterThanOrEqual(0)
    expect(event.step).toBeLessThan(128)
    expect(event.step + event.durationSteps).toBeLessThanOrEqual(128)
    const maxOffset = event.layer === 'drums'
      ? ({ kick: 0, snare: 0.04, hat: 0.06 } as const)[event.drum!]
      : event.layer === 'bass' ? 0.03 : 0.08
    expect(event.microOffset).toBeGreaterThanOrEqual(0)
    expect(event.microOffset).toBeLessThanOrEqual(maxOffset)
    expect(event.durationSteps).toBeGreaterThan(0)
    expect(event.velocity).toBeGreaterThanOrEqual(0.05)
    expect(event.velocity).toBeLessThanOrEqual(1)
    if (event.layer === 'keys') {
      expect(event.midi).toBeGreaterThanOrEqual(preset.keysRange.low)
      const embellishment = event.step % 16 === 14 && event.durationSteps === 2 && event.velocity <= 0.5
      expect(event.midi).toBeLessThanOrEqual(preset.keysRange.high + (embellishment ? 12 : 0))
      const slot = score.chords[Math.floor((event.traceBeat! / 4) / 2)]!
      expect(slot.voicing.map(note => note % 12)).toContain(event.midi! % 12)
    } else if (event.layer === 'bass') {
      const midi = event.midi!
      expect(midi).toBeGreaterThanOrEqual(35)
      expect(midi).toBeLessThanOrEqual(59)
      const trace = score.trace[event.traceBeat!]!
      const bar = trace.bar
      const chord = score.chords[Math.floor(bar / 2)]!
      const quality = CHORD_QUALITIES[preset.chordRing[chord.ringIndex]!.quality]
      const allowed = [chord.rootMidi, chord.rootMidi + quality.third,
        chord.rootMidi + 7, chord.rootMidi + quality.seventh, chord.rootMidi + 12]
      if (trace.beatInBar === 3 && [1, 3, 5].includes(bar)) allowed.push(score.chords[Math.floor((bar + 1) / 2)]!.rootMidi - 1)
      expect(allowed).toContain(midi)
      if (trace.beatInBar === 0 || trace.beatInBar === 2) {
        if (event.step === bar * 16 + trace.beatInBar * 4) expect(midi).toBe(chord.rootMidi)
      }
    }
  }
  const bass = score.events.filter(event => event.layer === 'bass').sort((a, b) => a.step - b.step)
  for (let i = 0; i < bass.length - 1; i++) expect(bass[i]!.step + bass[i]!.durationSteps).toBeLessThanOrEqual(bass[i + 1]!.step)
  const layerOrder = { drums: 0, bass: 1, keys: 2, lead: 3 } as const
  const drumOrder = { kick: 0, snare: 1, hat: 2 } as const
  for (let i = 1; i < score.events.length; i++) {
    const a = score.events[i - 1]!
    const b = score.events[i]!
    const order = a.step - b.step || layerOrder[a.layer] - layerOrder[b.layer]
      || (a.layer === 'drums' && b.layer === 'drums' ? drumOrder[a.drum!] - drumOrder[b.drum!] : 0)
      || (a.midi ?? -1) - (b.midi ?? -1)
    expect(order).toBeLessThanOrEqual(0)
  }
  for (let step = 0; step < 128; step++) {
    const soundingKeys = score.events.filter(event => event.layer === 'keys' && event.step <= step && step < event.step + event.durationSteps)
    expect(soundingKeys.length).toBeLessThanOrEqual(8)
  }
  for (const step of score.trace) {
    if (step.kind === 'rest') expect(bass.some(event => event.traceBeat === step.beat)).toBe(false)
  }
  for (let bar = 0; bar < 8; bar++) {
    const events = score.events.filter(event => event.step >= bar * 16 && event.step < (bar + 1) * 16)
    expect(events.filter(event => event.layer === 'drums').length).toBeLessThanOrEqual(24)
    expect(events.filter(event => event.layer === 'bass').length).toBeLessThanOrEqual(8)
    expect(events.filter(event => event.layer === 'keys').length).toBeLessThanOrEqual(17)
  }
}

describe('composePhrase', () => {
  it('renders reusable plans without changing them or the baseline score', () => {
    const input = recipe('rainy-windowsill', 17, 0.5)
    const plan = buildPhrasePlan(graph, input, 2)
    const before = structuredClone(plan)
    expect(renderPhrasePlan(plan)).toEqual(composePhrase(graph, input, 2))
    const first = renderPhrasePlan(plan)
    first.chords[0]!.voicing[0] = 0
    first.trace[0]!.uses.push('changed by caller')
    first.events[0]!.velocity = 0
    expect(plan).toEqual(before)
    expect(renderPhrasePlan(plan)).toEqual(composePhrase(graph, input, 2))
  })

  it('keeps every musical constraint with bass overrides across all presets and variations', () => {
    const exercised = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      for (const variation of variations) {
        for (const preset of Object.values(PRESETS)) {
          const plan = buildPhrasePlan(graph, recipe(preset.id, seed, variation), 0)
          const cells = plan.trace.map(step => {
            if (step.kind === 'rest') return null
            const legal = step.beatInBar % 2 === 0 ? STRONG_BASS_CELLS : WEAK_BASS_CELLS
            const id = legal[(seed + step.beat) % legal.length]!.id
            exercised.add(id)
            return id
          })
          const score = renderPhrasePlan(plan, { cells })
          assertComposition(score)
          expect(score.trace.every(step => step.uses.every(use => !use.startsWith('bass ')))).toBe(true)
          expect(score.chords).toEqual(plan.chords)
          expect(score.fill).toBe(plan.fill)
          expect(score.events.filter(event => event.layer !== 'bass').map(event => [event.layer, event.step, event.midi, event.drum, event.durationSteps]))
            .toEqual(composePhrase(graph, plan.recipe, 0).events.filter(event => event.layer !== 'bass').map(event => [event.layer, event.step, event.midi, event.drum, event.durationSteps]))
        }
      }
    }
    expect([...exercised].sort()).toEqual([...STRONG_BASS_CELLS, ...WEAK_BASS_CELLS].map(cell => cell.id).sort())
  })

  it('rejects incomplete, wrong-beat, and sounding forced-rest overrides', () => {
    const plan = buildPhrasePlan(graph, recipe('rainy-windowsill', 1, 0), 0)
    expect(() => renderPhrasePlan(plan, { cells: [] })).toThrow('one action per trace beat')
    expect(() => renderPhrasePlan(plan, { cells: plan.bassCells.map((cell, beat) => beat === 0 ? 'fifth' : cell) })).toThrow('Illegal bass cell')
    const restPlan = structuredClone(plan)
    restPlan.trace[1] = { kind: 'rest', neuronId: null, beat: 1, beatInBar: 1, bar: 0, neuronType: null, uses: [] }
    expect(() => renderPhrasePlan(restPlan, { cells: restPlan.bassCells.map((cell, beat) => beat === 1 ? 'fifth' : cell) })).toThrow('silent at traversal rest')
  })

  it('exposes the same bass pitch and duration rules for chord approaches', () => {
    const plan = buildPhrasePlan(graph, recipe('rainy-windowsill', 1, 0), 0)
    const approach = WEAK_BASS_CELLS.find(cell => cell.id === 'approach')!
    const event = renderBassCell(approach, 7, plan.chords, getPreset(plan.recipe.presetId))[0]!
    expect(event).toMatchObject({ layer: 'bass', step: 30, durationSteps: 2, midi: plan.chords[1]!.rootMidi - 1, traceBeat: 7 })
    expect(renderBassCell(WEAK_BASS_CELLS[0]!, 1, plan.chords, getPreset(plan.recipe.presetId))).toEqual([])
  })

  it('is deterministic, keeps the authored score shape, and ignores tempo', () => {
    const input = recipe('rainy-windowsill', 17, 0.5)
    const first = composePhrase(graph, input, 2)
    expect(composePhrase(graph, input, 2)).toEqual(first)
    expect(composePhrase(graph, { ...input, tempoBpm: 99 }, 2)).toEqual(first)
    expect(Object.keys(first).sort()).toEqual(['bars', 'chords', 'compositionPhraseIndex', 'events', 'fill', 'graphChecksum', 'mappingVersion', 'phraseIndex', 'presetId', 'presetVersion', 'scoreVersion', 'sessionSeed', 'stepsPerBar', 'trace', 'variation'].sort())
  })

  it('holds all bass and keys invariants for 100 seeds, three variations, and all presets', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const variation of variations) {
        for (const preset of Object.values(PRESETS)) assertComposition(composePhrase(graph, recipe(preset.id, seed, variation), 0))
      }
    }
  }, 15000)

  it('reuses the earlier keys patterns and reports reused bass cells at variation zero', () => {
    const score = composePhrase(graph, recipe('rainy-windowsill', 2, 0), 5)
    for (let bar = 4; bar < 8; bar++) {
      const earlier = score.trace[bar * 4]!
      const prior = score.trace[(bar - 4) * 4]!
      const reusedUse = earlier.uses.find(use => use.startsWith('keys '))!
      const priorUse = prior.uses.find(use => use.startsWith('keys '))!
      expect(reusedUse).toBe(`${priorUse} (reused from bar ${bar - 3})`)
      for (let beat = 0; beat < 4; beat++) {
        const currentBass = score.trace[bar * 4 + beat]!.uses.find(use => use.startsWith('bass '))
        const priorBass = score.trace[(bar - 4) * 4 + beat]!.uses.find(use => use.startsWith('bass '))
        if (score.trace[bar * 4 + beat]!.kind === 'rest') expect(currentBass).toBeUndefined()
        else if (priorBass) expect(currentBass).toBe(`${priorBass} (reused from bar ${bar - 3})`)
      }
    }
  })

  it('repeats variation-zero phrases except for phraseIndex', () => {
    const a = composePhrase(graph, recipe('fruit-bowl-finals', 10, 0), 0)
    const b = composePhrase(graph, recipe('fruit-bowl-finals', 10, 0), 5)
    expect({ ...a, phraseIndex: 0 }).toEqual({ ...b, phraseIndex: 0 })
  })

  it('uses the preset main and turn drum patterns, replacing only the final beat with a fill', () => {
    for (const preset of Object.values(PRESETS)) {
      for (let seed = 1; seed <= 30; seed++) {
        const score = composePhrase(graph, recipe(preset.id, seed, 0.5), 0)
        for (let bar = 0; bar < 8; bar++) {
          const pattern = bar % 4 === 3 ? preset.drums.turn : preset.drums.main
          const actual = score.events.filter(event => event.layer === 'drums' && Math.floor(event.step / 16) === bar)
            .map(event => [event.drum!, event.step % 16] as const).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
          const expected = (['kick', 'snare', 'hat'] as const).flatMap(drum => pattern[drum].map(([step]) => [drum, step] as const))
            .filter(([, step]) => !(bar === 7 && score.fill && step >= 12 && step <= 15))
          if (bar === 7 && score.fill) {
            expected.push(...(['kick', 'snare', 'hat'] as const).flatMap(drum => preset.drums.fill[drum].map(([step]) => [drum, step] as const)))
          }
          expected.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
          expect(actual).toEqual(expected)
        }
      }
    }
  })

  it('keeps embellishments off at variation zero and can produce Fruit Bowl embellishments at full variation', () => {
    for (const preset of Object.values(PRESETS)) {
      for (let seed = 1; seed <= 50; seed++) {
        const score = composePhrase(graph, recipe(preset.id, seed, 0), 0)
        expect(score.events.some(event => event.layer === 'keys' && event.durationSteps === 2 && event.step % 16 === 14
          && event.traceBeat !== null && score.trace[event.traceBeat]!.beatInBar === 3)).toBe(false)
      }
    }
    expect(Array.from({ length: 50 }, (_, index) => composePhrase(graph, recipe('fruit-bowl-finals', index + 1, 1), 0))
      .some(score => score.events.some(event => event.layer === 'keys' && event.durationSteps === 2 && event.step % 16 === 14
        && event.traceBeat !== null && score.trace[event.traceBeat]!.beatInBar === 3))).toBe(true)
  })

  it('lets a changed graph transition alter a composed chord or bass line', () => {
    const changed = fixtureGraph(connections => { connections.find(edge => edge.source === '1' && edge.target === '3')!.synapseCount = 9 })
    let changedOutput = false
    for (let seed = 1; seed <= 20; seed++) {
      const baseline = composePhrase(graph, recipe('rainy-windowsill', seed, 0.5), 0)
      const edited = composePhrase(changed, recipe('rainy-windowsill', seed, 0.5), 0)
      if (JSON.stringify(baseline.chords) !== JSON.stringify(edited.chords)
        || JSON.stringify(baseline.events.filter(event => event.layer === 'bass')) !== JSON.stringify(edited.events.filter(event => event.layer === 'bass'))) changedOutput = true
    }
    expect(changedOutput).toBe(true)
  })
})
