import { useMemo, useState } from 'react'
import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'
import { useAnimationEnabled } from '../../scene/useAnimationEnabled'
import { useDocumentHidden } from '../../scene/useDocumentHidden'
import { formatChance } from '../explanation/describe'
import Icon from '../Icon'
import { edgeKey, layoutCircuit, MAX_DETAILED_NEURONS, scanEdge } from './layout'
import NetworkOverview from './NetworkOverview'
import './scanner.css'

export default function CircuitScanner() {
  const controller = useController()
  const circuitStatus = useAppState(state => state.circuit.status)
  const score = useAppState(state => state.activeScore)
  const position = useAppState(state => state.position)
  const engineStatus = useAppState(state => state.engineStatus)
  const enabled = useAnimationEnabled()
  const hidden = useDocumentHidden()
  const graph = circuitStatus === 'ready' ? controller.getGraph() : null
  const layout = useMemo(() => graph ? layoutCircuit(graph) : null, [graph])
  const nodesById = useMemo(() => new Map(layout?.nodes.map(node => [node.neuron.id, node])), [layout])
  const wholeOverview = (layout?.nodes.length ?? 0) > MAX_DETAILED_NEURONS
  const phraseKey = score ? `${score.sessionSeed}:${score.phraseIndex}:${score.presetId}:${score.variation}` : null
  const [inspection, setInspection] = useState<{ phraseKey: string; beat: number } | null>(null)
  const liveBeat = score && position.phraseIndex === score.phraseIndex ? position.bar * 4 + position.beat : 0
  const inspecting = inspection !== null && inspection.phraseKey === phraseKey
  const beat = inspecting ? inspection.beat : liveBeat
  const step = score?.trace[beat]
  const neuron = step?.neuronId ? graph?.neurons.get(step.neuronId) : null
  const source = step?.kind === 'edge' ? graph?.neurons.get(step.from) : null
  const activeEdge = step?.kind === 'edge' ? edgeKey(step.from, step.neuronId) : null
  const recentSteps = score?.trace.slice(Math.max(0, beat - 7), beat + 1) ?? []
  const recentNodes = new Set(recentSteps.flatMap(item => item.neuronId ? [item.neuronId] : []))
  const recentEdges = new Set(recentSteps.flatMap(item => item.kind === 'edge' ? [edgeKey(item.from, item.neuronId)] : []))
  const currentNode = step?.neuronId ? nodesById.get(step.neuronId) : undefined
  const liveEdges = recentSteps.flatMap(item => {
    if (item.kind !== 'edge') return []
    const from = nodesById.get(item.from), to = nodesById.get(item.neuronId)
    return from && to ? [scanEdge(from, to, item.synapseCount)] : []
  })
  const visibleNodes = wholeOverview ? [...new Set([...recentNodes, ...(step?.kind === 'edge' ? [step.from] : [])])].flatMap(id => {
    const node = nodesById.get(id)
    return node ? [{ ...node, radius: 3.3 }] : []
  }) : layout?.nodes ?? []
  const visibleEdges = wholeOverview ? liveEdges : layout?.edges ?? []
  const playing = engineStatus === 'playing'
  const animated = enabled && !hidden && playing && !inspecting
  const scanLabel = circuitStatus === 'error' ? 'DATA UNAVAILABLE' : circuitStatus === 'loading' ? 'LOADING CIRCUIT' : !score ? 'AWAITING PLAYBACK' : inspecting ? 'INSPECTING BEAT' : playing ? 'LIVE WALK' : 'WALK PAUSED'

  return <section className={`circuit-scanner${animated ? ' scanner--animated' : ''}`} id="circuit-scan" data-testid="circuit-scanner" aria-labelledby="scanner-title">
    <div className="scanner-heading"><div><p className="eyebrow"><Icon name="scan" /> BEHIND THE BEAT</p><h2 id="scanner-title">A window into the wiring<span>.</span></h2><p>Follow the real MaleCNS connections shaping your music, one beat at a time.</p></div><span className="scanner-badge"><span className="status-dot" />{scanLabel}</span></div>
    <div className="scanner-layout">
      <div className="scan-stage">
        <div className="scan-stage-meta"><span>MALE CNS / WHOLE CONNECTOME</span><span>CONNECTIVITY SCHEMATIC</span></div>
        {layout ? <div className="network-layers">{wholeOverview && <NetworkOverview nodes={layout.nodes} edges={layout.edges} />}<svg className="network-scan" viewBox="0 0 760 400" aria-hidden="true" data-testid="network-scan">
          <defs>
            <radialGradient id="scan-aura"><stop stopColor="var(--scan-accent)" stopOpacity="0.14" /><stop offset="1" stopColor="var(--scan-accent)" stopOpacity="0" /></radialGradient>
            <linearGradient id="scan-sweep-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--scan-accent)" stopOpacity="0" /><stop offset="1" stopColor="var(--scan-accent)" stopOpacity="0.09" /></linearGradient>
            <marker id="scan-arrow" markerWidth="5" markerHeight="5" refX="7" refY="2.5" orient="auto"><path d="M0 0 5 2.5 0 5" fill="var(--scan-accent)" /></marker>
          </defs>
          <ellipse cx="255" cy="205" rx="235" ry="200" fill="url(#scan-aura)" /><ellipse cx="505" cy="205" rx="235" ry="200" fill="url(#scan-aura)" />
          <g className="scan-guides" fill="none"><path d="M380 45v315M50 205h660" /><ellipse cx="255" cy="205" rx="185" ry="160" /><ellipse cx="505" cy="205" rx="185" ry="160" /></g>
          {!wholeOverview && <g className="scan-connections">{layout.edges.map(edge => <path key={edge.key} d={edge.path} strokeWidth={Math.min(1.2, 0.3 + Math.log2(edge.synapseCount) / 10)} />)}</g>}
          <g className="scan-trail">{visibleEdges.filter((edge, index) => recentEdges.has(edge.key) && visibleEdges.findIndex(other => other.key === edge.key) === index).map(edge => <path key={edge.key} d={edge.path} />)}</g>
          {visibleEdges.filter((edge, index) => edge.key === activeEdge && visibleEdges.findIndex(other => other.key === edge.key) === index).map(edge => <path className="scan-active-edge" key={edge.key} d={edge.path} markerEnd="url(#scan-arrow)" data-source={edge.source} data-target={edge.target} data-synapses={edge.synapseCount} />)}
          <g>{visibleNodes.map(node => <circle key={node.neuron.id} cx={node.x} cy={node.y} r={node.neuron.id === step?.neuronId ? 5.5 : node.radius} className={`scan-node${recentNodes.has(node.neuron.id) ? ' scan-node--visited' : ''}${node.neuron.id === step?.neuronId ? ' scan-node--current' : ''}`} data-neuron-id={node.neuron.id} />)}</g>
          {currentNode && <g className="scan-target" key={`${score?.phraseIndex}-${beat}`} transform={`translate(${currentNode.x} ${currentNode.y})`}><circle className="scan-pulse" r="17" /><path d="M-24-8v-9h9M15-17h9v9M-24 8v9h9M15 17h9V8" /><text x="0" y="-30" textAnchor="middle">{neuron?.type ?? 'Untyped'}</text></g>}
          <g className="scan-sweep"><rect x="50" y="0" width="660" height="45" fill="url(#scan-sweep-gradient)" /><path d="M50 45h660" /></g>
          <text className="scan-side-label" x="210" y="387">LEFT SOMA</text><text className="scan-side-label" x="460" y="387">RIGHT SOMA</text>
        </svg></div> : <div className="scan-placeholder"><Icon name="scan" /><p>{circuitStatus === 'error' ? 'The circuit could not be loaded. Use Retry below to reconnect.' : 'Preparing the connectome…'}</p></div>}
        <div className="scan-legend"><span><i className="legend-current" />Selected neuron</span><span><i className="legend-trail" />Recent path</span><span><i className="legend-network" />{wholeOverview ? 'Whole connectome overview' : 'Real connection'}</span></div>
      </div>
      <div className="scan-inspector" data-testid="scan-inspector" data-beat={step?.beat} data-neuron-id={step?.neuronId ?? ''} data-source={step?.kind === 'edge' ? step.from : undefined} data-target={step?.kind === 'edge' ? step.neuronId : undefined} data-synapses={step?.kind === 'edge' ? step.synapseCount : undefined}>
        <div className="inspector-heading"><p className="eyebrow">{inspecting ? 'SELECTED BEAT' : 'THIS BEAT’S SELECTION'}</p><span className="beat-counter">{step ? `${String(beat + 1).padStart(2, '0')} / 32` : '— / 32'}</span></div>
        <h3 data-testid="scan-neuron-type">{step?.kind === 'rest' ? 'A little silence' : neuron?.type ?? (score ? 'Untyped neuron' : 'Ready when you are')}</h3>
        <p className="neuron-id">{neuron ? `BODY ID ${neuron.id}` : step?.kind === 'rest' ? 'REST / NO NEURON SELECTED' : 'PRESS START LISTENING TO BEGIN'}</p>
        {step ? <>
          <div className="connection-detail"><span className="detail-label">{step.kind === 'edge' ? 'INCOMING CONNECTION' : 'TRAVERSAL RULE'}</span><p>{step.kind === 'edge' ? <>{source?.type ?? 'Untyped'} <span className="connection-arrow">→</span> {neuron?.type ?? 'Untyped'}</> : step.kind === 'rest' ? 'Dead end · resting until the next bar' : step.kind === 'restart' ? 'Restart across the whole connectome' : 'Phrase begins across the whole connectome'}</p>{step.kind === 'edge' && <div className="connection-stats"><span><strong>{step.synapseCount}</strong> synapses</span><span><strong>{formatChance(step.probability)}</strong> selection chance</span></div>}</div>
          <div className="musical-choices"><span className="detail-label">SHAPING THE MUSIC</span>{step.uses.length ? <ul>{step.uses.map(use => <li key={use}>{use}</li>)}</ul> : <p>The bass rests. The arrangement continues.</p>}</div>
        </> : <p className="inspector-idle">A seeded walk selects a neuron on each beat. Watch its path and see how each choice becomes bass, keys, and harmony.</p>}
        <div className="scan-dataset-stats"><span><strong>{graph?.neurons.size.toLocaleString('en-US') ?? '—'}</strong>neurons</span><span><strong>{graph?.manifest.counts.connections.toLocaleString('en-US') ?? '—'}</strong>connections</span><span><strong>{graph?.manifest.counts.cellTypes.toLocaleString('en-US') ?? '—'}</strong>cell types</span></div>
      </div>
    </div>
    <div className="phrase-trace"><div className="trace-heading"><span className="detail-label">{score ? `PHRASE ${score.phraseIndex + 1} / 8 BARS` : 'YOUR PHRASE / 8 BARS'}</span><button type="button" className="follow-button" data-testid="scan-follow" disabled={!inspecting} onClick={() => setInspection(null)}>{inspecting ? 'Follow live beat' : 'Following live beat'}</button></div><div className="trace-bars">{Array.from({ length: 8 }, (_, bar) => <div className="trace-bar" key={bar}><span className="trace-bar-label">{bar + 1}</span>{Array.from({ length: 4 }, (_, beatInBar) => {
      const index = bar * 4 + beatInBar
      const traceStep = score?.trace[index]
      const visited = !!score && index <= liveBeat
      return <button key={index} type="button" className={`trace-beat${visited ? ' trace-beat--visited' : ''}${score && index === beat ? ' trace-beat--selected' : ''}${traceStep?.kind === 'rest' ? ' trace-beat--rest' : ''}`} data-testid={`scan-beat-${index}`} disabled={!visited} aria-label={`Inspect bar ${bar + 1}, beat ${beatInBar + 1}${traceStep?.neuronType ? `: ${traceStep.neuronType}` : ''}`} aria-pressed={!!score && index === beat} onClick={() => { if (phraseKey) setInspection({ phraseKey, beat: index }) }}><span /></button>
    })}</div>)}</div></div>
    <p className="scan-disclaimer">Real neuron IDs and synapse counts from MaleCNS v1.0. {wholeOverview && 'The overview plots every traced neuron across the brain and nerve cord, with representative background connections. Each beat walks the full graph. '}Positions are schematic, not an anatomical scan. Highlights show the music’s traversal, not measured neural firing.</p>
  </section>
}
