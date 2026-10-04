import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildGraph } from '../../src/connectome/graph'
import { manifestSchema } from '../../src/connectome/schema'
import { composePhrase } from '../../src/music/compose'
import type { SessionRecipe } from '../../src/music/types'
import { getPreset } from '../../src/presets/presets'
import { createCueState, nextBlinkDelayMs, phraseCue, rainTimings } from '../../src/scene/cues'

const directory = new URL('../../public/data/circuits/mbon-v1/', import.meta.url)
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
const bytes = readFileSync(new URL('circuit.json', directory))
const checksum = createHash('sha256').update(bytes).digest('hex')
const graph = buildGraph(manifest, JSON.parse(bytes.toString('utf8')), checksum)
const preset = getPreset('rainy-windowsill')
const recipe: SessionRecipe = {
  recipeVersion: 1,
  presetId: preset.id,
  sessionSeed: 1,
  variation: 0.5,
  tempoBpm: preset.tempoBpm,
}

it('keeps composition output independent from animation-stream draws', () => {
  const baseline = [0, 1, 2, 3].map(index => composePhrase(graph, recipe, index))
  const state = createCueState(1)

  const exercised = [0, 1, 2, 3].map(index => {
    for (let draw = 0; draw < 1000; draw++) {
      if (draw % 2 === 0) nextBlinkDelayMs(state)
      else phraseCue(state, index * 1000 + draw)
    }
    rainTimings(1, 18)
    return composePhrase(graph, recipe, index)
  })

  expect(exercised).toEqual(baseline)
  expect(nextBlinkDelayMs(createCueState(1))).not.toBe(nextBlinkDelayMs(state))
})
