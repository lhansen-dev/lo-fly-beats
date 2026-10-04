import { describe, expect, it } from 'vitest'
import { detectOnsets } from '../../audio/onsets'

const sampleRate = 44100

function concatenate(segments: Array<{ values: number[]; record?: boolean }>): { samples: Float32Array; indices: number[] } {
  const samples: number[] = []
  const indices: number[] = []
  for (const { values, record } of segments) {
    if (record) indices.push(samples.length)
    samples.push(...values)
  }
  return { samples: Float32Array.from(samples), indices }
}

describe('detectOnsets', () => {
  it('detects the first threshold crossing of a phase-zero sine', () => {
    const samples = Float32Array.from({ length: 44100 }, (_, n) => 0.5 * Math.sin(2 * Math.PI * 50 * n / 44100))
    expect(samples[3]).toBeGreaterThan(0.01)
    expect(Math.abs(samples[14])).toBeLessThanOrEqual(0.05)
    expect(samples[15]).toBeGreaterThan(0.05)
    expect(detectOnsets(samples, sampleRate)).toEqual([15 / 44100])
  })

  it('requires a latched quiet interval and does not disarm on intermediate levels', () => {
    const { samples, indices: [A, B] } = concatenate([
      { values: Array(100).fill(0.06) }, { values: Array(2205).fill(0) }, { values: Array(10).fill(0.02) }, { values: Array(10).fill(0.04) }, { values: Array(100).fill(0.06), record: true },
      { values: Array(2205).fill(0) }, { values: Array(10).fill(0.02) }, { values: Array(10).fill(0.04) }, { values: Array(100).fill(0.06), record: true }, { values: Array(100).fill(0) },
    ])
    expect(detectOnsets(samples, sampleRate)).toEqual([0, A / sampleRate, B / sampleRate])
  })

  it('rejects a silence shorter than the required interval', () => {
    const samples = Float32Array.from([...Array(100).fill(0.06), ...Array(1000).fill(0), ...Array(100).fill(0.06)])
    expect(detectOnsets(samples, sampleRate)).toEqual([0])
  })

  it('arms at exactly 50 ms of silence', () => {
    const short = Float32Array.from([...Array(100).fill(0.06), ...Array(2204).fill(0), ...Array(100).fill(0.06)])
    expect(detectOnsets(short, sampleRate)).toEqual([0])
    const exact = Float32Array.from([...Array(100).fill(0.06), ...Array(2205).fill(0), ...Array(100).fill(0.06)])
    expect(detectOnsets(exact, sampleRate)).toEqual([0, 2305 / sampleRate])
  })
})
