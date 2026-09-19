export interface WavData {
  sampleRate: number
  channels: readonly Float32Array[]
}

export function encodeWav16({ sampleRate, channels }: WavData): ArrayBuffer {
  if (channels.length === 0) throw new Error('WAV requires at least one channel')
  const frames = channels[0].length
  if (channels.some(channel => channel.length !== frames)) throw new Error('WAV channel lengths must match')
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) throw new Error('WAV sample rate must be a positive integer')
  const blockAlign = channels.length * 2
  const dataBytes = frames * blockAlign
  const byteRate = sampleRate * blockAlign
  if (blockAlign > 0xffff || byteRate > 0xffffffff || dataBytes > 0xffffffff - 36) throw new Error('WAV data exceeds the PCM header limits')
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  function text(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels.length, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]))
      if (Number.isNaN(sample)) throw new Error(`Invalid WAV sample at frame ${frame}`)
      view.setInt16(offset, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true)
      offset += 2
    }
  }
  return buffer
}
