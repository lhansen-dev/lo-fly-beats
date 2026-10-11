import { describe, expect, it } from 'vitest'
import * as Tone from 'tone'
import { createRig, DEFAULT_MIX, type MixSettings } from '../../src/audio/rig'
import { PRESETS } from '../../src/presets/presets'
import type { NoteEvent } from '../../src/music/types'

const sound = PRESETS['rainy-windowsill'].sound

function note(layer: NoteEvent['layer']): NoteEvent {
  return {
    layer,
    step: 0,
    time: 0,
    velocity: 1,
    durationSteps: 2,
    microOffset: 0,
    traceBeat: 0,
    midi: layer === 'drums' ? null : layer === 'bass' ? 36 : 60,
    drum: layer === 'drums' ? 'kick' : null,
  } as NoteEvent
}

async function render(seconds: number, mix: MixSettings, schedule: (rig: ReturnType<typeof createRig>) => void) {
  const context = new Tone.OfflineContext(2, seconds, 44100)
  const rig = createRig(context, sound, mix)
  try {
    schedule(rig)
    const rendered = await context.render()
    try {
      const buffer = rendered.get()!
      return Array.from({ length: 2 }, (_, channel) => buffer.getChannelData(channel).slice())
    } finally {
      rendered.dispose()
    }
  } finally {
    rig.dispose()
    context.dispose()
  }
}

function rms(samples: Float32Array, start: number, end: number) {
  const first = Math.floor(start * 44100)
  const last = Math.floor(end * 44100)
  let sum = 0
  for (let i = first; i < last; i++) sum += samples[i] ** 2
  return Math.sqrt(sum / (last - first))
}

describe('mixer offline rendering', () => {
  it('softens hats on a preset sound change while preserving the kick body', async () => {
    const mix = DEFAULT_MIX
    const hits = (rig: ReturnType<typeof createRig>) => {
      for (const time of [0.1, 1.1]) rig.trigger({ ...note('drums'), drum: 'hat' }, time, 0)
      rig.trigger(note('drums'), 1.4, 0)
    }
    const control = await render(2, mix, hits)
    const changed = await render(2, mix, rig => {
      hits(rig)
      rig.applySound({ ...sound, drumsCutoffHz: PRESETS['overripe-2am'].sound.drumsCutoffHz }, 0.4)
    })
    for (let channel = 0; channel < 2; channel++) {
      expect(rms(changed[channel], 0.1, 0.25)).toBeCloseTo(rms(control[channel], 0.1, 0.25), 6)
      const originalHat = rms(control[channel], 1.1, 1.25)
      expect(rms(changed[channel], 1.1, 1.25)).toBeLessThan(originalHat * 0.9)
      expect(rms(changed[channel], 1.1, 1.25)).toBeGreaterThan(originalHat * 0.4)
      expect(rms(changed[channel], 1.4, 1.6)).toBeGreaterThan(rms(control[channel], 1.4, 1.6) * 0.95)
    }
  })

  it('silences all layers at zero master while nonzero master is audible', async () => {
    const silentMix: MixSettings = { ...DEFAULT_MIX, masterVolume: 0 }
    const renderMix = (mix: MixSettings) => render(3, mix, rig => {
      rig.trigger(note('drums'), 0.1, 0.2)
      rig.trigger(note('bass'), 0.2, 0.3)
      rig.trigger(note('keys'), 0.3, 0.3)
    })
    const silent = await renderMix(silentMix)
    for (const channel of silent) {
      for (const sample of channel) expect(Number.isFinite(sample)).toBe(true)
      let peak = 0
      for (const sample of channel) peak = Math.max(peak, Math.abs(sample))
      expect(peak).toBeLessThan(0.001)
    }
    const audible = await renderMix({ ...silentMix, masterVolume: 0.8 })
    for (const channel of audible) expect(rms(channel, 0, 3)).toBeGreaterThan(0.001)
  }, 30000)

  it('ramps drums to silence at 0.5s without a discontinuity', async () => {
    const isolated: MixSettings = {
      masterVolume: 0.8,
      layers: {
        drums: { level: 0.8, muted: false },
        bass: { level: 0, muted: true },
        keys: { level: 0, muted: true },
        lead: { level: 0, muted: true },
      },
    }
    const hits = (rig: ReturnType<typeof createRig>) => {
      for (const time of [0.05, 0.25, 0.45, 0.65, 0.85, 1.05]) rig.trigger(note('drums'), time, 0)
    }
    const changed = await render(1.3, isolated, rig => {
      hits(rig)
      rig.setMix({ ...isolated, layers: { ...isolated.layers, drums: { level: 0, muted: false } } }, 0.5)
    })
    const control = await render(1.3, isolated, hits)
    for (let channel = 0; channel < 2; channel++) {
      const before = rms(changed[channel], 0, 0.5)
      expect(before).toBeGreaterThan(0)
      expect(rms(changed[channel], 0.6, 1.2)).toBeLessThan(before * 0.05)
      expect(rms(control[channel], 0.6, 1.2)).toBeGreaterThan(before * 0.05)
      const start = Math.floor(0.49 * 44100)
      const end = Math.floor(0.56 * 44100)
      let maximumJump = 0
      for (let i = start + 1; i < end; i++) maximumJump = Math.max(maximumJump, Math.abs(changed[channel][i] - changed[channel][i - 1]))
      expect(maximumJump).toBeLessThanOrEqual(0.5)
    }
  }, 30000)
})
