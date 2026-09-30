import { describe, expect, it } from 'vitest'
import { generateAudioBuffers } from './buffers'

const expectedPeaks = { kick: 0.9, snare: 0.8, hat: 0.6, rain: 0.5, crackle: 0.5, impulse: 0.7 }

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
    const expectedLengths = { kick: [22050], snare: [15435], hat: [5292], rain: [341775, 341775], crackle: [253575, 253575], impulse: [97020, 97020] }

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

  it('crossfades both rain loop seams smoothly', () => {
    const rain = generateAudioBuffers(44100).rain
    for (const channel of rain.channels) expect(Math.abs(channel.at(-1)! - channel[0]!)).toBeLessThan(0.1)
  })

  it('renders all six buffers at 48 kHz within the generation budget', () => {
    const start = performance.now()
    const buffers = generateAudioBuffers(48000)
    const elapsedMs = performance.now() - start
    console.info(`Generated all six 48 kHz audio buffers in ${elapsedMs.toFixed(1)} ms`)
    expect(Object.keys(buffers)).toHaveLength(6)
    expect(elapsedMs).toBeLessThan(2000)
  })
})
