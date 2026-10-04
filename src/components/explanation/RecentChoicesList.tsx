import type { CircuitGraph } from '../../connectome/types'
import type { TraceStep } from '../../music/types'
import { describeTraceStep } from './describe'

export default function RecentChoicesList({ steps, graph }: { steps: TraceStep[]; graph: Pick<CircuitGraph, 'neurons' | 'startNeuronIds'> }) {
  return <ol>{steps.map((step, index) => {
    const description = describeTraceStep(step, graph)
    return <li key={`${step.beat}-${index}`} data-kind={step.kind} data-beat={step.beat} {...(step.kind === 'edge' ? { 'data-source': step.from, 'data-target': step.neuronId, 'data-synapses': step.synapseCount } : {})}>
      <strong>{description.label}</strong> {description.title} {description.detail}
    </li>
  })}</ol>
}
