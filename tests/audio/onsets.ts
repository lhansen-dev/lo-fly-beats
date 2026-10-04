export function detectOnsets(samples: Float32Array, sampleRate: number): number[] {
  const quietNeeded = Math.round(0.05 * sampleRate)
  const onsets: number[] = []
  let armed = true
  let quietRun = 0

  for (let i = 0; i < samples.length; i++) {
    const level = Math.abs(samples[i])
    if (armed) {
      if (level > 0.05) {
        onsets.push(i / sampleRate)
        armed = false
        quietRun = 0
      }
    } else if (level < 0.01) {
      quietRun++
      if (quietRun >= quietNeeded) armed = true
    } else {
      quietRun = 0
    }
  }

  return onsets
}
