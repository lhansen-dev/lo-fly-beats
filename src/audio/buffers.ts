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

function crossfadeLoop(input: Float32Array, sampleRate: number): Float32Array {
  const fadeSamples = Math.round(0.25 * sampleRate)
  const output = input.slice(0, input.length - fadeSamples)
  for (let i = 0; i < fadeSamples; i++) {
    const p = i / fadeSamples
    output[i] = input[i]! * Math.sqrt(p) + input[input.length - fadeSamples + i]! * Math.sqrt(1 - p)
  }
  // Bring the last few samples onto the loop's first sample after the long equal-power blend.
  const seamSamples = Math.max(2, Math.round(0.001 * sampleRate))
  const seamStart = output.length - seamSamples
  const seamTarget = output[0]!
  for (let i = seamStart; i < output.length; i++) {
    const progress = (i - seamStart + 1) / seamSamples
    output[i] += (seamTarget - output[i]!) * progress
  }
  return output
}

export function generateKick(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('kick', sampleRate)
  let phase = 0
  return mono(sampleRate, 0.5, (t) => {
    const frequency = 48 + 62 * Math.exp(-t / 0.03)
    phase += 2 * Math.PI * frequency / sampleRate
    return Math.sin(phase) * Math.exp(-t / 0.18) + noise(rng) * 0.3 * Math.exp(-t / 0.002)
  }, 0.9)
}

export function generateSnare(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('snare', sampleRate)
  const length = Math.round(0.35 * sampleRate)
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  const filtered = highpass(raw, 1200, sampleRate)
  const drum = mono(sampleRate, 0.35, (t, i) => filtered[i]! * 0.7 * Math.exp(-t / 0.09) + Math.sin(2 * Math.PI * 185 * t) * 0.5 * Math.exp(-t / 0.05), 0.8)
  return drum
}

export function generateHat(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('hat', sampleRate)
  const length = Math.round(0.12 * sampleRate)
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  const once = highpass(raw, 7000, sampleRate)
  const twice = highpass(once, 7000, sampleRate)
  const result = mono(sampleRate, 0.12, (t, i) => twice[i]! * Math.exp(-t / 0.03), 0.6)
  return result
}

function generateRainChannel(sampleRate: number, channelIndex: number, rng: ReturnType<typeof bufferRng>): Float32Array {
  const length = sampleRate * 8
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  const filtered = highpass(lowpass(raw, 2500, sampleRate), 400, sampleRate)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    output[i] = filtered[i]! * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.13 * t + channelIndex * Math.PI / 2))
  }
  const dripCount = 24
  for (let drip = 0; drip < dripCount; drip++) {
    const start = Math.floor(rng.float() * (length - Math.round(0.05 * sampleRate)))
    const frequency = 3000 + 3000 * rng.float()
    const amplitude = 0.05 + 0.1 * rng.float()
    const dripLength = Math.round(0.05 * sampleRate)
    let phase = 0
    for (let j = 0; j < dripLength && start + j < length; j++) {
      const t = j / sampleRate
      phase += 2 * Math.PI * frequency / sampleRate
      output[start + j] += amplitude * Math.sin(phase) * Math.exp(-t / 0.01)
    }
  }
  return crossfadeLoop(output, sampleRate)
}

export function generateRain(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('rain', sampleRate)
  const channels = [generateRainChannel(sampleRate, 0, rng), generateRainChannel(sampleRate, 1, rng)]
  scalePeak(channels, 0.5)
  return { sampleRate, channels }
}

function generateCrackleChannel(sampleRate: number, rng: ReturnType<typeof bufferRng>): Float32Array {
  const length = sampleRate * 6
  const raw = new Float32Array(length)
  for (let i = 0; i < length; i++) raw[i] = noise(rng)
  const filtered = lowpass(raw, 6000, sampleRate)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) output[i] = filtered[i]! * 0.01
  const clicks = 72
  for (let click = 0; click < clicks; click++) {
    const start = Math.floor(rng.float() * (length - 3))
    const amplitude = 0.05 + 0.35 * rng.float() ** 2
    output[start] += amplitude
    output[start + 1] -= amplitude * 0.5
    output[start + 2] += amplitude * 0.25
  }
  return crossfadeLoop(output, sampleRate)
}

export function generateCrackle(sampleRate: number): SeededAudioBuffer {
  const rng = bufferRng('crackle', sampleRate)
  const channels = [generateCrackleChannel(sampleRate, rng), generateCrackleChannel(sampleRate, rng)]
  scalePeak(channels, 0.5)
  return { sampleRate, channels }
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

export function generateAudioBuffers(sampleRate: number): Record<'kick' | 'snare' | 'hat' | 'rain' | 'crackle' | 'impulse', SeededAudioBuffer> {
  return {
    kick: generateKick(sampleRate),
    snare: generateSnare(sampleRate),
    hat: generateHat(sampleRate),
    rain: generateRain(sampleRate),
    crackle: generateCrackle(sampleRate),
    impulse: generateImpulse(sampleRate),
  }
}
