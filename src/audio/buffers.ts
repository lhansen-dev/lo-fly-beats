import { bufferRng } from '../music/streams'

export interface SeededAudioBuffer {
  sampleRate: number
  channels: Float32Array[]
}

const noise = (rng: ReturnType<typeof bufferRng>) => rng.float() * 2 - 1

function lowpass(input: Float32Array, cutoff: number, sampleRate: number): Float32Array {
  const output = new Float32Array(input.length)
  const a = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate)
  let y = 0
  for (let i = 0; i < input.length; i++) {
    y += a * (input[i]! - y)
    output[i] = y
  }
  return output
}

function highpass(input: Float32Array, cutoff: number, sampleRate: number): Float32Array {
  const low = lowpass(input, cutoff, sampleRate)
  const output = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) output[i] = input[i]! - low[i]!
  return output
}

function scalePeak(channels: Float32Array[], target: number): void {
  let peak = 0
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample))
  if (peak === 0) return
  const scale = target / peak
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= scale
}

function mono(sampleRate: number, seconds: number, render: (t: number, i: number, length: number) => number, peak: number): SeededAudioBuffer {
  const length = Math.round(seconds * sampleRate)
  const channel = new Float32Array(length)
  for (let i = 0; i < length; i++) channel[i] = render(i / sampleRate, i, length)
  const channels = [channel]
  scalePeak(channels, peak)
  return { sampleRate, channels }
}

function drumEdgeGain(t: number, i: number, length: number, sampleRate: number, attackSeconds: number): number {
  // Ease into the transient and end at zero so each one-shot has no hard sample edges.
  return (1 - Math.exp(-t / attackSeconds)) * Math.min(1, (length - 1 - i) / (0.01 * sampleRate))
}

export function generateKick(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('kick', sampleRate)
  const raw = new Float32Array(Math.round(0.5 * sampleRate))
  for (let i = 0; i < raw.length; i++) raw[i] = noise(rng)
  const transient = lowpass(raw, 1500, sampleRate)
  let phase = 0
  return mono(sampleRate, 0.5, (t, i, length) => {
    const frequency = 48 + 62 * Math.exp(-t / 0.03)
    phase += 2 * Math.PI * frequency / sampleRate
    const body = Math.sin(phase) * Math.exp(-t / 0.14)
    const click = transient[i]! * 0.12 * Math.exp(-t / 0.003)
    return (body + click) * drumEdgeGain(t, i, length, sampleRate, 0.0006)
  }, 0.9)
}

export function generateSnare(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('snare', sampleRate)
  const length = Math.round(0.22 * sampleRate)
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  // A damped, woody backbeat with a little wire texture instead of a long white-noise snap.
  const filtered = lowpass(lowpass(highpass(raw, 600, sampleRate), 2800, sampleRate), 2800, sampleRate)
  let phase = 0
  return mono(sampleRate, 0.22, (t, i, length) => {
    phase += 2 * Math.PI * (165 + 45 * Math.exp(-t / 0.012)) / sampleRate
    const body = Math.sin(phase) * 0.65 * Math.exp(-t / 0.025)
    const rim = Math.sin(2 * Math.PI * 330 * t) * 0.18 * Math.exp(-t / 0.012)
    const wires = filtered[i]! * 0.45 * Math.exp(-t / 0.035)
    return (body + rim + wires) * drumEdgeGain(t, i, length, sampleRate, 0.0008)
  }, 0.62)
}

export function generateHat(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('hat', sampleRate)
  const length = Math.round(0.1 * sampleRate)
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  const high = highpass(highpass(raw, 5500, sampleRate), 5500, sampleRate)
  const filtered = lowpass(lowpass(high, 9000, sampleRate), 9000, sampleRate)
  return mono(sampleRate, 0.1, (t, i, length) =>
    filtered[i]! * Math.exp(-t / 0.018) * drumEdgeGain(t, i, length, sampleRate, 0.0004), 0.4)
}

export function generateImpulse(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('impulse', sampleRate)
  const start = Math.round(0.012 * sampleRate)
  const length = Math.round(2.2 * sampleRate)
  const channels = Array.from({ length: 2 }, () => {
    const raw = new Float32Array(length)
    for (let i = start; i < length; i++) {
      const t = (i - start) / sampleRate
      raw[i] = noise(rng) * Math.exp(-t / 0.45)
    }
    return lowpass(raw, 5000, sampleRate)
  })
  scalePeak(channels, 0.7)
  return { sampleRate, channels }
}

export function generateAudioBuffers(sampleRate: number): Record<'kick' | 'snare' | 'hat' | 'impulse', SeededAudioBuffer> {
  return {
    kick: generateKick(sampleRate),
    snare: generateSnare(sampleRate),
    hat: generateHat(sampleRate),
    impulse: generateImpulse(sampleRate),
  }
}
