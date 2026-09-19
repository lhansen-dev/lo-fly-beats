/** Inspect the canonical 44-byte, 16-bit PCM WAV format emitted by encodeWav16. */
export function parseWavHeader(buffer: ArrayBuffer) {
  if (buffer.byteLength < 44) throw new Error('Truncated WAV header')
  const view = new DataView(buffer)
  const text = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4))
  if (text(0) !== 'RIFF' || text(8) !== 'WAVE' || text(12) !== 'fmt ' || text(36) !== 'data') throw new Error('Invalid WAV chunk identifiers')
  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  const dataBytes = view.getUint32(40, true)
  if (view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || bitsPerSample !== 16) throw new Error('Expected 16-bit PCM WAV')
  if (channels === 0 || sampleRate === 0 || dataBytes % (channels * 2) !== 0) throw new Error('Invalid WAV sample layout')
  if (view.getUint16(32, true) !== channels * 2 || view.getUint32(28, true) !== sampleRate * channels * 2) throw new Error('Invalid WAV byte rate or block alignment')
  if (dataBytes + 44 !== buffer.byteLength || view.getUint32(4, true) !== dataBytes + 36) throw new Error('WAV size does not match the buffer')
  let peak = 0
  for (let offset = 44; offset < buffer.byteLength; offset += 2) peak = Math.max(peak, Math.abs(view.getInt16(offset, true)))
  const frames = dataBytes / (channels * 2)
  return { channels, sampleRate, bitsPerSample, dataBytes, frames, durationSeconds: frames / sampleRate, peak }
}
