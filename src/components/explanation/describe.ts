import type { CircuitGraph } from '../../connectome/types'
import type { PresetDefinition } from '../../presets/types'
import { CHORD_SLOT_BARS } from '../../music/harmony'
import { HUMANIZE_MAX_OFFSETS, HUMANIZE_VELOCITY_SPREAD, KEYS_PATTERNS, STRONG_BASS_CELLS, WEAK_BASS_CELLS } from '../../music/patterns'
import type { TraceStep } from '../../music/types'

export function describeMappingRules(preset: PresetDefinition): string[] {
  const chordBars = CHORD_SLOT_BARS.map(bar => bar + 1)
  const chordBarText = `${chordBars.slice(0, -1).join(', ')}, and ${chordBars[chordBars.length - 1]}`
  const strongIds = STRONG_BASS_CELLS.map(cell => cell.id).join(', ')
  const weakIds = WEAK_BASS_CELLS.map(cell => cell.id).join(', ')
  const keyIds = KEYS_PATTERNS.map(pattern => pattern.id).join(', ')
  const fillLow = Math.round(preset.fillChance * 50)
  const fillHigh = Math.round(preset.fillChance * 100)

  return [
    `Chords last two bars and change at bars ${chordBarText}.`,
    `The neuron type at each chord slot picks from the ring ${preset.chordRing.map(chord => chord.symbol).join(' → ')}; if it would repeat the previous slot's chord, the ring steps to the next chord.`,
    `On beats 1 and 3, the neuron picks a strong bass cell (${strongIds}); on beats 2 and 4 it picks a weak cell (${weakIds}), and a rest step silences the bass.`,
    `The neuron at the start of each bar picks one keys pattern (${keyIds}).`,
    'Bars 5–8 may copy the keys pattern and bass cells from four bars earlier, more often at low variation.',
    `Beat 4 may add a high keys note in up to ${Math.round(preset.embellishChance * 100)}% of bars at full variation.`,
    `The last bar's drums get a fill with a ${fillLow}%–${fillHigh}% chance.`,
    `Velocities vary by up to ±${Math.round(HUMANIZE_VELOCITY_SPREAD * 100)}% and notes land slightly late, at most ${HUMANIZE_MAX_OFFSETS.keys} of a sixteenth for keys.`,
  ]
}

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
