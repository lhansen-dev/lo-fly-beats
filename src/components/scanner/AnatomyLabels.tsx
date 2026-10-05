import { useMemo } from 'react'
import type { ScanNode } from './layout'

export default function AnatomyLabels({ nodes, current }: { nodes: readonly ScanNode[]; current: ScanNode | undefined }) {
  const labels = useMemo(() => {
    const groups = [
      { name: 'LEFT OPTIC LOBE', hint: 'visual system', x: 52, y: 218, include: (node: ScanNode) => node.neuron.superclass?.startsWith('ol_') && node.neuron.somaSide === 'L' },
      { name: 'RIGHT OPTIC LOBE', hint: 'visual system', x: 575, y: 190, include: (node: ScanNode) => node.neuron.superclass?.startsWith('ol_') && node.neuron.somaSide === 'R' },
      { name: 'CENTRAL BRAIN', hint: 'integration & memory', x: 575, y: 82, include: (node: ScanNode) => node.neuron.superclass === 'cb_intrinsic' },
      { name: 'T1', hint: 'front thoracic neuromere', x: 500, y: 334, include: (node: ScanNode) => node.neuron.anatomy?.somaNeuromere === 'T1' },
      { name: 'T2', hint: 'middle thoracic neuromere', x: 500, y: 414, include: (node: ScanNode) => node.neuron.anatomy?.somaNeuromere === 'T2' },
      { name: 'T3', hint: 'hind thoracic neuromere', x: 500, y: 518, include: (node: ScanNode) => node.neuron.anatomy?.somaNeuromere === 'T3' },
      { name: 'ABDOMINAL', hint: 'neuromeres A1–A10', x: 55, y: 568, include: (node: ScanNode) => node.neuron.anatomy?.somaNeuromere?.startsWith('A') },
    ]
    return groups.flatMap(group => {
      const located = nodes.filter(node => node.positionKind !== 'unavailable' && group.include(node))
      if (!located.length) return []
      const center = located.reduce((sum, node) => ({ x: sum.x + node.x / located.length, y: sum.y + node.y / located.length }), { x: 0, y: 0 })
      return [{ ...group, center }]
    })
  }, [nodes])
  const unavailable = useMemo(() => nodes.filter(node => node.positionKind === 'unavailable').length, [nodes])
  return <g className="anatomy-labels">
    {labels.map(label => <g key={label.name} className={current && label.include(current) ? 'anatomy-label--active' : undefined}>
      <path d={`M${label.center.x} ${label.center.y}L${label.x < 340 ? label.x + 145 : label.x - 25} ${label.y - 4}H${label.x < 340 ? label.x + 145 : label.x - 5}`} /><circle cx={label.center.x} cy={label.center.y} r="2" />
      <text x={label.x} y={label.y}>{label.name}</text><text className="anatomy-label-hint" x={label.x} y={label.y + 16}>{label.hint}</text>
    </g>)}
    <text className="anatomy-cord-title" x="55" y="296">VENTRAL</text><text className="anatomy-cord-title" x="55" y="312">NERVE CORD</text>
    {unavailable > 0 && <g className="unlocated-label"><path d="M120 625H560" /><text x="340" y="617" textAnchor="middle">{unavailable.toLocaleString('en-US')} NEURONS WITHOUT A POSITION · SHOWN SEPARATELY</text></g>}
    <g className="anatomy-scale"><path d="M55 65V55H108.75V65" /><text x="55" y="79">100 µm</text></g>
  </g>
}
