import type { CircuitGraph } from '../../connectome/types'
import type { TraceStep } from '../../music/types'

export function neuronLabel(graph: Pick<CircuitGraph, 'neurons' | 'startNeuronIds'>, id: string): string {
  const type = graph.neurons.get(id)?.type
  return type ? `${type} (${id})` : `Untyped neuron (${id})`
}

export function formatChance(probability: number): string {
  return probability < 0.01 ? '<1%' : `${Math.round(probability * 100)}%`
}

export function describeTraceStep(
  step: TraceStep,
  graph: Pick<CircuitGraph, 'neurons' | 'startNeuronIds'>,
): { label: 'Real connection' | 'Authored rule'; title: string; detail: string } {
  const chose = step.uses.length > 0 ? ` · chose ${step.uses.join(', ')}` : ''
  if (step.kind === 'edge') {
    const count = step.synapseCount === 1 ? '1 synapse' : `${step.synapseCount} synapses`
    return {
      label: 'Real connection',
      title: `${neuronLabel(graph, step.from)} → ${neuronLabel(graph, step.neuronId)}`,
      detail: `${count} · ${formatChance(step.probability)} chance${chose}`,
    }
  }
  if (step.kind === 'start') {
    return {
      label: 'Authored rule',
      title: `Phrase start at ${neuronLabel(graph, step.neuronId)}`,
      detail: `Each phrase begins at one of the ${graph.startNeuronIds.length} authored start neurons${chose}`,
    }
  }
  if (step.kind === 'restart') {
    return {
      label: 'Authored rule',
      title: `Restart at ${neuronLabel(graph, step.neuronId)} after a dead end`,
      detail: `The walk jumps back to an authored start neuron at the bar boundary${chose}`,
    }
  }
  return {
    label: 'Authored rule',
    title: 'Rest',
    detail: 'The previous neuron has no outgoing connections in this subset, so the walk rests until the next bar.',
  }
}
