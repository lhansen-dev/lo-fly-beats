import { describe, expect, it } from 'vitest'
import { describeAnatomy, positionLabel, projectLocation } from '../../../src/components/scanner/anatomy'
import { neuronSchema } from '../../../src/connectome/schema'
import type { Neuron } from '../../../src/connectome/types'

const neuron: Neuron = {
  id: '1', type: null, instance: null, class: null, superclass: null, somaSide: 'L',
  anatomy: { somaLocation: null, tosomaLocation: null, somaNeuromere: null, subclass: null, rootSide: null, entryNerve: null, exitNerve: null },
}

describe('source-based fly anatomy', () => {
  it('preserves scale and anatomical left/right in the X–Z projection', () => {
    const center = projectLocation([48500, 20000, 30000])
    const left = projectLocation([61000, 40000, 30000])
    const posterior = projectLocation([48500, 10000, 42500])
    expect(center.x - left.x).toBeCloseTo(posterior.y - center.y)
    expect(center.x - left.x).toBeCloseTo(53.75) // 100 microns at 8 nm per voxel
    expect(projectLocation([61000, 0, 30000])).toEqual(left)
  })

  it.each([
    ['ProLN', 'front'], ['MesoLN', 'middle'], ['MetaLN', 'hind'],
  ] as const)('maps %s using its explicit root side, never the LN suffix or soma side', (nerve, part) => {
    const result = describeAnatomy({ ...neuron, superclass: 'vnc_sensory', anatomy: { ...neuron.anatomy!, entryNerve: nerve, rootSide: 'R' } })
    expect(result.parts).toContain(part)
    expect(result.side).toBe('R')
    expect(describeAnatomy({ ...neuron, anatomy: { ...neuron.anatomy!, exitNerve: nerve } }).side).toBeNull()
  })

  it('keeps generic thoracic neurons in the nerve cord without inventing a limb target', () => {
    const result = describeAnatomy({ ...neuron, superclass: 'vnc_intrinsic', anatomy: { ...neuron.anatomy!, somaNeuromere: 'T1' } })
    expect(result.label).toContain('T1')
    expect(result.parts).toEqual(['thorax'])
    expect(describeAnatomy(neuron).parts).toEqual([])
  })

  it('maps visual, descending, wing, and abdominal annotations to their body areas', () => {
    expect(describeAnatomy({ ...neuron, superclass: 'ol_intrinsic' })).toMatchObject({ parts: ['eyes', 'brain'], side: 'L' })
    expect(describeAnatomy({ ...neuron, superclass: 'descending_neuron' }).parts).toEqual(['brain', 'thorax'])
    expect(describeAnatomy({ ...neuron, anatomy: { ...neuron.anatomy!, subclass: 'wm' } }).parts).toEqual(['wings', 'thorax'])
    expect(describeAnatomy({ ...neuron, anatomy: { ...neuron.anatomy!, exitNerve: 'AbN4' } }).parts).toEqual(['abdomen'])
  })

  it('distinguishes measured somas, attachment points, and unavailable coordinates', () => {
    expect(positionLabel(neuron)).toContain('unavailable')
    const attachment = { ...neuron, anatomy: { ...neuron.anatomy!, tosomaLocation: [1, 2, 3] as [number, number, number] } }
    expect(positionLabel(attachment)).toContain('attachment')
    expect(positionLabel({ ...attachment, anatomy: { ...attachment.anatomy, somaLocation: [1, 2, 3] } })).toContain('Measured')
    expect(neuronSchema.safeParse({ ...neuron, anatomy: { ...neuron.anatomy, somaLocation: [-1, 2, 3] } }).success).toBe(false)
    expect(neuronSchema.safeParse({ ...neuron, anatomy: { ...neuron.anatomy, somaLocation: [1, 2] } }).success).toBe(false)
  })
})
