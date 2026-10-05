import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildGraph } from '../../../../src/connectome/graph'
import { buildReservoirGraph } from '../../../../src/music/learning/graph'
import { createReservoirModel } from '../../../../src/music/learning/reservoir'

const directory = new URL('../../../../public/data/circuits/mbon-v1/', import.meta.url)
const bytes = readFileSync(new URL('circuit.json', directory))
export const mbonGraph = buildGraph(
  JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')),
  JSON.parse(bytes.toString('utf8')), createHash('sha256').update(bytes).digest('hex'),
)
export const reservoirGraph = buildReservoirGraph(mbonGraph)
export const learningModel = (seed = 1) => createReservoirModel(reservoirGraph, seed)
