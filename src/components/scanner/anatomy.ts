import type { Neuron } from '../../connectome/types'

export const SCAN_WIDTH = 760
export const SCAN_HEIGHT = 680
export const ANATOMY_SCALE = 0.0043

// MaleCNS voxel space, projected onto X–Z with one scale for both axes.
// Mirror X so the fly's annotated left side is on the left of the view.
export function projectLocation([x, , z]: readonly [number, number, number]): { x: number; y: number } {
  return { x: 340 + (48500 - x) * ANATOMY_SCALE, y: 45 + (z - 10000) * ANATOMY_SCALE }
}

export type BodyPart = 'brain' | 'eyes' | 'antennae' | 'thorax' | 'front' | 'middle' | 'hind' | 'wings' | 'abdomen'
export interface FlyLocation {
  label: string
  detail: string
  parts: readonly BodyPart[]
  side: 'L' | 'R' | null
}

const legLocations: Record<string, { part: BodyPart; label: string }> = {
  fl: { part: 'front', label: 'Front-leg circuit' },
  ml: { part: 'middle', label: 'Middle-leg circuit' },
  hl: { part: 'hind', label: 'Hind-leg circuit' },
}

export function describeAnatomy(neuron: Neuron): FlyLocation {
  const anatomy = neuron.anatomy
  const family = neuron.superclass ?? ''
  const somaSide = neuron.somaSide === 'L' || neuron.somaSide === 'R' ? neuron.somaSide : null
  const rootSide = anatomy?.rootSide === 'L' || anatomy?.rootSide === 'R' ? anatomy.rootSide : null
  const sideLabel = somaSide ? ` · ${somaSide === 'L' ? 'left' : 'right'}` : ''
  const nerves = [anatomy?.entryNerve, anatomy?.exitNerve].filter(Boolean).join(',').split(',')
  // Effector assignments use explicit nerve/subclass annotations, never cell IDs or soma coordinates.
  const leg = nerves.includes('ProLN') ? legLocations.fl : nerves.includes('MesoLN') ? legLocations.ml : nerves.includes('MetaLN') ? legLocations.hl : legLocations[anatomy?.subclass ?? '']
  if (leg) return { label: leg.label, detail: 'Annotated leg pathway', parts: [leg.part, 'thorax'], side: rootSide }
  if (['wm', 'wt'].includes(anatomy?.subclass ?? '')) return { label: 'Wing circuit', detail: 'Annotated wing pathway', parts: ['wings', 'thorax'], side: rootSide }
  if (anatomy?.subclass === 'ad' || nerves.some(nerve => /^AbN/.test(nerve))) return { label: 'Abdominal circuit', detail: 'Annotated abdominal pathway', parts: ['abdomen'], side: rootSide }
  if (nerves.includes('AN')) return { label: 'Antennal circuit', detail: 'Antennal nerve annotation', parts: ['antennae', 'brain'], side: rootSide }
  if (family.startsWith('ol_')) return { label: `Optic lobe${sideLabel}`, detail: 'Visual-system neuron', parts: ['eyes', 'brain'], side: somaSide }
  if (family.startsWith('visual_')) return { label: `Visual pathway${sideLabel}`, detail: 'Links the optic lobes and central brain', parts: ['eyes', 'brain'], side: somaSide }
  if (family.startsWith('descending') || family === 'sensory_descending' || family === 'efferent_descending') return { label: `Brain → nerve cord${sideLabel}`, detail: 'Descending pathway', parts: ['brain', 'thorax'], side: null }
  if (family.includes('ascending')) return { label: `Nerve cord → brain${sideLabel}`, detail: 'Ascending pathway', parts: ['thorax', 'brain'], side: null }
  if (family.startsWith('vnc_')) {
    const segment = anatomy?.somaNeuromere
    const label = segment === 'T1' ? 'Front thoracic neuromere · T1' : segment === 'T2' ? 'Middle thoracic neuromere · T2' : segment === 'T3' ? 'Hind thoracic neuromere · T3' : segment?.startsWith('A') ? `Abdominal neuromere · ${segment}` : 'Ventral nerve cord'
    return { label, detail: 'Cell-body region; limb target unspecified', parts: segment?.startsWith('A') ? ['abdomen'] : ['thorax'], side: somaSide }
  }
  if (family.startsWith('cb_')) return { label: `Central brain${sideLabel}`, detail: neuron.class === 'Kenyon_Cell' || neuron.class === 'MBON' ? 'Mushroom-body circuit' : 'Central-brain neuron', parts: ['brain'], side: somaSide }
  return { label: 'Region unannotated', detail: 'No body region assigned in the source', parts: [], side: null }
}

export function positionLabel(neuron: Neuron): string {
  return neuron.anatomy?.somaLocation ? 'Measured cell-body position' : neuron.anatomy?.tosomaLocation ? 'Annotated soma attachment point' : 'Position unavailable in source'
}
