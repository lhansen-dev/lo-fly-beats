import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildGraph } from '../../src/connectome/graph'
import { manifestSchema } from '../../src/connectome/schema'
import { composePhrase } from '../../src/music/compose'
import type { SessionRecipe } from '../../src/music/types'

const directory = new URL('../../public/data/circuits/mbon-v1/', import.meta.url)
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')))
const bytes = readFileSync(new URL('circuit.json', directory))
const checksum = createHash('sha256').update(bytes).digest('hex')
const graph = buildGraph(manifest, JSON.parse(bytes.toString('utf8')), checksum)

it('snapshots the real-circuit Rainy Windowsill composition', async () => {
  const recipe: SessionRecipe = {
    recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0.5, tempoBpm: 72,
  }
  const score = composePhrase(graph, recipe, 0)
  await expect(JSON.stringify(score, null, 2) + '\n')
    .toMatchFileSnapshot('__snapshots__/rainy-windowsill-seed-1-variation-50.json')
})
