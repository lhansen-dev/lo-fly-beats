import { describe, expect, it } from 'vitest'
import { generateAudioBuffers, generateHat, generateKick, generateSnare } from './buffers'

const expectedPeaks = { kick: 0.9, snare: 0.62, hat: 0.4, impulse: 0.7 }

function peakAndRms(channels: Float32Array[]): { peak: number; rms: number } {
  let peak = 0
  let squares = 0
  let count = 0
  for (const channel of channels) for (const sample of channel) {
    peak = Math.max(peak, Math.abs(sample))
    squares += sample * sample
    count++
  }
  return { peak, rms: Math.sqrt(squares / count) }
}

describe('seeded audio buffers', () => {
  it('has deterministic samples, documented lengths, peaks, finite samples, and useful RMS at 44.1 kHz', () => {
    const first = generateAudioBuffers(44100)
    const second = generateAudioBuffers(44100)
    const expectedLengths = { kick: [22050], snare: [9702], hat: [4410], impulse: [97020, 97020] }

    for (const name of Object.keys(first) as (keyof typeof first)[]) {
      const buffer = first[name]
      expect(buffer.sampleRate).toBe(44100)
      expect(buffer.channels.map(channel => channel.length)).toEqual(expectedLengths[name])
      expect(buffer.channels.length).toBe(second[name].channels.length)
      if (buffer.channels.length === 2) expect(buffer.channels[0]).not.toEqual(buffer.channels[1])
      for (let channelIndex = 0; channelIndex < buffer.channels.length; channelIndex++) {
        const channel = buffer.channels[channelIndex]!
        expect(Array.from(channel)).toEqual(Array.from(second[name].channels[channelIndex]!))
        expect(channel.every(Number.isFinite)).toBe(true)
      }
      const { peak, rms } = peakAndRms(buffer.channels)
      expect(peak).toBeCloseTo(expectedPeaks[name], 6)
      expect(rms).toBeGreaterThan(0.001)
    }
  })


  it.each([44100, 48000])('keeps drum edges silent and the snare damped at %i Hz', sampleRate => {
    for (const render of [generateKick, generateSnare, generateHat]) {
      const samples = render(sampleRate).channels[0]!
      expect(Math.abs(samples[0]!)).toBe(0)
      expect(Math.abs(samples.at(-1)!)).toBe(0)
    }
    const snare = generateSnare(sampleRate).channels[0]!
    let energy = 0
    let tailEnergy = 0
    let differenceEnergy = 0
    for (let i = 0; i < snare.length; i++) {
      energy += snare[i]! ** 2
      if (i >= sampleRate * 0.1) tailEnergy += snare[i]! ** 2
      if (i > 0) differenceEnergy += (snare[i]! - snare[i - 1]!) ** 2
    }
    expect(tailEnergy / energy).toBeLessThan(0.01)
    // Rapid sample changes expose harsh high-frequency noise even when the peak is low.
    expect(differenceEnergy / energy).toBeLessThan(0.1)
  })

  it('renders all four buffers at 48 kHz within the generation budget', () => {
    const start = performance.now()
    const buffers = generateAudioBuffers(48000)
    const elapsedMs = performance.now() - start
    console.info(`Generated all four 48 kHz audio buffers in ${elapsedMs.toFixed(1)} ms`)
    expect(Object.keys(buffers)).toHaveLength(4)
    expect(elapsedMs).toBeLessThan(2000)
  })
})
