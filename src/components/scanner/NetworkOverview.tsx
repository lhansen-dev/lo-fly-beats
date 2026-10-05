import { useEffect, useRef } from 'react'
import type { ScanEdge, ScanNode } from './layout'

export default function NetworkOverview({ nodes, edges }: { nodes: readonly ScanNode[]; edges: readonly ScanEdge[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, 1520, 800)
    context.save()
    context.scale(2, 2)
    context.strokeStyle = '#83c4b21a'
    context.lineWidth = 0.4
    for (const edge of edges) context.stroke(new Path2D(edge.path))
    context.fillStyle = '#83c4b230'
    for (const node of nodes) context.fillRect(node.x - node.radius, node.y - node.radius, node.radius * 2, node.radius * 2)
    context.restore()
  }, [nodes, edges])
  return <canvas ref={canvas} className="network-overview" width={1520} height={800} aria-hidden="true" data-testid="network-overview" data-neurons={nodes.length} data-overview-connections={edges.length} />
}
