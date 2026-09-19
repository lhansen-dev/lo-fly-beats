import { describe, expect, it } from 'vitest'
import { encodeWav16 } from './wav'
import { parseWavHeader } from './wavInfo'

function samples(buffer: ArrayBuffer): number[] {
  const view = new DataView(buffer)
  return Array.from({ length: (buffer.byteLength - 44) / 2 }, (_, i) => view.getInt16(44 + i * 2, true))
}

describe('encodeWav16', () => {
  it('writes the stereo 44.1 kHz PCM header in little-endian order', () => {
    const buffer = encodeWav16({ sampleRate: 44100, channels: [new Float32Array(441), new Float32Array(441)] })
    const view = new DataView(buffer)
    expect(buffer.byteLength).toBe(1808)
    expect(view.getUint32(4, true)).toBe(1800)
    expect(view.getUint32(28, true)).toBe(176400)
    expect(view.getUint16(32, true)).toBe(4)
    expect(view.getUint32(40, true)).toBe(1764)
    expect(parseWavHeader(buffer)).toEqual({ channels: 2, sampleRate: 44100, bitsPerSample: 16, dataBytes: 1764, frames: 441, durationSeconds: 0.01, peak: 0 })
  })

  it('rounds and clamps signed samples with the full 16-bit range', () => {
    const buffer = encodeWav16({ sampleRate: 44100, channels: [new Float32Array([1, -1, 0.5, -0.25, 2, -3])] })
    expect(samples(buffer)).toEqual([32767, -32768, 16384, -8192, 32767, -32768])
    expect(parseWavHeader(buffer).peak).toBe(32768)
  })

  it('interleaves channels frame by frame', () => {
    const buffer = encodeWav16({ sampleRate: 44100, channels: [new Float32Array([1, 0.5]), new Float32Array([-1, -0.25])] })
    expect(samples(buffer)).toEqual([32767, -32768, 16384, -8192])
  })

  it('round-trips mono audio at a different sample rate', () => {
    const buffer = encodeWav16({ sampleRate: 22050, channels: [new Float32Array(2205).fill(0.5)] })
    expect(parseWavHeader(buffer)).toEqual({ channels: 1, sampleRate: 22050, bitsPerSample: 16, dataBytes: 4410, frames: 2205, durationSeconds: 0.1, peak: 16384 })
  })

  it('rejects missing channels and mismatched channel lengths', () => {
    expect(() => encodeWav16({ sampleRate: 44100, channels: [] })).toThrow('at least one channel')
    expect(() => encodeWav16({ sampleRate: 44100, channels: [new Float32Array(1), new Float32Array(2)] })).toThrow('lengths must match')
  })

  it.each([0, -1, 44100.5, NaN, Infinity])('rejects an invalid sample rate %s', sampleRate => {
    expect(() => encodeWav16({ sampleRate, channels: [new Float32Array(1)] })).toThrow('sample rate')
  })

  it('accepts empty channels and rejects NaN samples', () => {
    expect(parseWavHeader(encodeWav16({ sampleRate: 44100, channels: [new Float32Array()] })).frames).toBe(0)
    expect(() => encodeWav16({ sampleRate: 44100, channels: [new Float32Array([NaN])] })).toThrow('Invalid WAV sample')
  })
})

it('rejects truncated or incorrectly sized WAV buffers', () => {
  expect(() => parseWavHeader(new ArrayBuffer(10))).toThrow('Truncated')
  const buffer = encodeWav16({ sampleRate: 44100, channels: [new Float32Array(4)] })
  expect(() => parseWavHeader(buffer.slice(0, -2))).toThrow('size')
})
