import { expect, it } from 'vitest'
import { spikeNotes } from '../../../src/audio/spike'
import { buildGraph } from '../../../src/connectome/graph'
import { fixture } from '../connectome/fixture'

it('takes the strongest edge, breaks ties by sorted order, and stops at eight notes', () => {
  const { circuit, manifest } = fixture()
  const notes = spikeNotes(buildGraph(manifest, circuit, manifest.output.sha256))
  expect(notes.map(note => note.neuronId)).toEqual(['1', '2', '1', '2', '1', '2', '1', '2'])
  expect(notes[0]).toEqual({ neuronId: '1', type: 'Alpha', midi: 65 })
})

it('includes the dead-end neuron and ends the traversal there', () => {
  const { circuit, manifest } = fixture()
  manifest.startNeuronIds = ['4']
  expect(spikeNotes(buildGraph(manifest, circuit, manifest.output.sha256))).toEqual([
    { neuronId: '4', type: 'Delta', midi: 72 },
    { neuronId: '5', type: null, midi: 62 },
  ])
})
