import { useEffect, useRef } from 'react'
import type { ScanEdge, ScanNode } from './layout'
import { SCAN_HEIGHT, SCAN_WIDTH } from './anatomy'

export default function NetworkOverview({ nodes, edges }: { nodes: readonly ScanNode[]; edges: readonly ScanEdge[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, SCAN_WIDTH * 2, SCAN_HEIGHT * 2)
    context.save()
    context.scale(2, 2)
    context.strokeStyle = '#83c4b20a'
    context.lineWidth = 0.35
    for (const edge of edges) context.stroke(new Path2D(edge.path))
    // Subtle class coloring lets the measured point cloud reveal the anatomy.
    for (const [color, include] of [
      ['#8ca8b640', (node: ScanNode) => node.positionKind !== 'unavailable' && node.neuron.superclass?.startsWith('ol_')],
      ['#c5d8d560', (node: ScanNode) => node.positionKind !== 'unavailable' && !node.neuron.superclass?.startsWith('ol_')],
      ['#668a8040', (node: ScanNode) => node.positionKind === 'unavailable'],
    ] as const) {
      context.fillStyle = color
      for (const node of nodes) if (include(node)) context.fillRect(node.x - node.radius, node.y - node.radius, node.radius * 2, node.radius * 2)
    }
    context.restore()
  }, [nodes, edges])
  return <canvas ref={canvas} className="network-overview" width={SCAN_WIDTH * 2} height={SCAN_HEIGHT * 2} aria-hidden="true" data-testid="network-overview" data-neurons={nodes.length} data-positioned-neurons={nodes.filter(node => node.positionKind !== 'unavailable').length} data-overview-connections={edges.length} />
}
