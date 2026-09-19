import type * as ToneTypes from 'tone'
import type { CircuitGraph } from '../connectome/types'
import { encodeWav16 } from './wav'

export interface SpikeNote {
  neuronId: string
  type: string | null
  midi: number
}

export function spikeNotes(graph: CircuitGraph): SpikeNote[] {
  const notes: SpikeNote[] = []
  const pitches = [62, 65, 67, 69, 72]
  let id = graph.startNeuronIds[0]
  while (notes.length < 8) {
    const neuron = graph.neurons.get(id)
    if (!neuron) break
    notes.push({ neuronId: id, type: neuron.type, midi: pitches[Number(BigInt(id) % 5n)] })
    const outgoing = graph.outgoing.get(id) ?? []
    let next = outgoing[0]
    if (!next) break
    for (const edge of outgoing) {
      if (edge.synapseCount > next.synapseCount) next = edge
    }
    id = next.target
  }
  return notes
}

// Importing Tone itself initializes its global context. Defer it to a button action.
let toneRequest: Promise<typeof import('tone')> | undefined
const loadTone = () => toneRequest ??= import('tone')
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
let context: ToneTypes.BaseContext | undefined
let synth: ToneTypes.PolySynth<ToneTypes.FMSynth> | undefined
let starting = false
let generation = 0

type SpikeAudioState = AudioContextState | 'inactive'
const stateListeners = new Set<(state: SpikeAudioState) => void>()
const emitState = () => {
  for (const listener of stateListeners) listener(context?.state ?? 'inactive')
}

export function subscribeSpikeState(listener: (state: SpikeAudioState) => void): () => void {
  stateListeners.add(listener)
  listener(context?.state ?? 'inactive')
  return () => { stateListeners.delete(listener) }
}

export async function startSpike(graph: CircuitGraph): Promise<void> {
  if (synth || starting) return
  starting = true
  const currentGeneration = ++generation
  try {
    const Tone = await loadTone()
    if (generation !== currentGeneration) return
    await Tone.start()
    if (generation !== currentGeneration) return
    if (!context) {
      context = Tone.getContext()
      context.on('statechange', emitState)
    }
    const notes = spikeNotes(graph)
    if (notes.length === 0) throw new Error('The circuit has no playable traversal')
    synth = new Tone.PolySynth({ context, voice: Tone.FMSynth, volume: -10 }).connect(context.destination)
    context.transport.bpm.value = 90
    let position = 0
    context.transport.scheduleRepeat(time => {
      const note = notes[position % notes.length]
      synth?.triggerAttackRelease(midiToHz(note.midi), 0.3, time)
      position++
    }, '8n')
    context.transport.start()
    emitState()
  } catch (error) {
    stopSpike()
    throw error
  } finally {
    starting = false
  }
}

export function stopSpike(): void {
  generation++
  if (context) {
    context.transport.stop()
    context.transport.cancel()
  }
  synth?.dispose()
  synth = undefined
}

export async function renderSpikeWav(graph: CircuitGraph): Promise<Blob> {
  const Tone = await loadTone()
  const offlineContext = new Tone.OfflineContext(2, 3, 44100)
  let offlineSynth: ToneTypes.PolySynth<ToneTypes.FMSynth> | undefined
  try {
    offlineSynth = new Tone.PolySynth({ context: offlineContext, voice: Tone.FMSynth, volume: -10 }).connect(offlineContext.destination)
    spikeNotes(graph).forEach((note, i) => offlineSynth!.triggerAttackRelease(midiToHz(note.midi), 0.3, i / 3))
    const rendered = await offlineContext.render()
    try {
      return new Blob([encodeWav16({ sampleRate: 44100, channels: [rendered.getChannelData(0), rendered.getChannelData(1)] })], { type: 'audio/wav' })
    } finally {
      rendered.dispose()
    }
  } finally {
    offlineSynth?.dispose()
    offlineContext.dispose()
  }
}
