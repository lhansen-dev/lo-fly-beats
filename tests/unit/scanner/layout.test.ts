import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildGraph } from '../../../src/connectome/graph'
import { composePhrase } from '../../../src/music/compose'
import { layoutCircuit } from '../../../src/components/scanner/layout'

const directory = new URL('../../../public/data/circuits/mbon-v1/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
const circuit = JSON.parse(readFileSync(new URL('circuit.json', directory), 'utf8'))
const graph = buildGraph(manifest, circuit, manifest.output.sha256)

describe('MaleCNS scanner layout', () => {
  it('renders every real neuron and directed connection with its original synapse count', () => {
    const layout = layoutCircuit(graph)
    expect(layout.nodes.map(node => node.neuron.id).sort()).toEqual(circuit.neurons.map((neuron: { id: string }) => neuron.id).sort())
    expect(layout.edges.map(({ source, target, synapseCount }) => ({ source, target, synapseCount }))).toEqual(circuit.connections)
    expect(new Set(layout.edges.map(edge => edge.key)).size).toBe(936)
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true)
      expect(node.x).toBeGreaterThanOrEqual(65)
      expect(node.x).toBeLessThanOrEqual(695)
      expect(node.y).toBeGreaterThanOrEqual(65)
      expect(node.y).toBeLessThanOrEqual(345)
    }
  })

  it('keeps the layout stable and leaves the seeded music and graph unchanged', () => {
    const recipe = { recipeVersion: 1, presetId: 'rainy-windowsill', sessionSeed: 1, variation: 0.5, tempoBpm: 72 } as const
    const score = composePhrase(graph, recipe, 0)
    const annotations = [...graph.neurons.values()].map(neuron => ({ ...neuron }))
    const first = layoutCircuit(graph)
    expect(layoutCircuit(graph)).toEqual(first)
    expect([...graph.neurons.values()]).toEqual(annotations)
    expect(composePhrase(graph, recipe, 0)).toEqual(score)
  })
})
