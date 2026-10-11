import * as Tone from 'tone'
import type { BaseContext } from 'tone'
import { generateAudioBuffers, type SeededAudioBuffer } from './buffers'
import { midiToHz } from './timing'
import type { Layer, NoteEvent } from '../music/types'
import type { SoundParams } from '../presets/types'

export interface MixSettings {
  masterVolume: number
  layers: Record<Layer, { level: number; muted: boolean }>
  ambienceOn: boolean
}

export const DEFAULT_MIX: MixSettings = {
  masterVolume: 0.8,
  layers: {
    drums: { level: 0.8, muted: false },
    bass: { level: 0.7, muted: false },
    keys: { level: 0.6, muted: false },
    lead: { level: 0.55, muted: false },
  },
  ambienceOn: true,
}

export interface InstrumentRig {
  trigger(event: NoteEvent, time: number, durationSeconds: number): void
  applySound(sound: SoundParams, time: number): void
  setMix(mix: MixSettings, time: number): void
  startAmbience(time: number): void
  stopAmbience(time: number): void
  releaseAll(time: number): void
  rampMasterGain(target: number, rampSeconds: number, time: number): void
  readonly keysActiveVoices: number
  dispose(): void
}

export function toAudioBuffer(context: BaseContext, data: SeededAudioBuffer): AudioBuffer {
  const length = data.channels[0]?.length ?? 0
  if (length === 0 || data.channels.some(channel => channel.length !== length)) {
    throw new Error('Seeded audio buffer channels must have the same non-zero length')
  }
  const buffer = new AudioBuffer({ length, numberOfChannels: data.channels.length, sampleRate: data.sampleRate })
  data.channels.forEach((channel, index) => buffer.copyToChannel(new Float32Array(channel), index))
  // Tone's explicit context is the authority for all nodes; this also catches accidental
  // use of a buffer built for a different sample rate before Web Audio silently resamples.
  if (buffer.sampleRate !== context.sampleRate) throw new Error('Seeded audio buffer sample rate does not match the audio context')
  return buffer
}

export function createRig(context: BaseContext, sound: SoundParams, initialMix: MixSettings): InstrumentRig {
  const seeded = generateAudioBuffers(context.sampleRate)
  const audio = {
    kick: toAudioBuffer(context, seeded.kick),
    snare: toAudioBuffer(context, seeded.snare),
    hat: toAudioBuffer(context, seeded.hat),
    rain: toAudioBuffer(context, seeded.rain),
    crackle: toAudioBuffer(context, seeded.crackle),
    impulse: toAudioBuffer(context, seeded.impulse),
  }

  const drumsBus = new Tone.Gain({ context, gain: initialMix.layers.drums.muted ? 0 : initialMix.layers.drums.level })
  const bassBus = new Tone.Gain({ context, gain: initialMix.layers.bass.muted ? 0 : initialMix.layers.bass.level })
  const keysBus = new Tone.Gain({ context, gain: initialMix.layers.keys.muted ? 0 : initialMix.layers.keys.level })
  const leadBus = new Tone.Gain({ context, gain: initialMix.layers.lead.muted ? 0 : initialMix.layers.lead.level })
  const ambienceBus = new Tone.Gain({ context, gain: 1 })
  const master = new Tone.Gain({ context, gain: initialMix.masterVolume })
  const drumsFilter = new Tone.Filter({ context, type: 'lowpass', frequency: sound.drumsCutoffHz, Q: 0.5 })
  const keysFilter = new Tone.Filter({ context, type: 'lowpass', frequency: sound.keysCutoffHz, Q: 0.5 })
  const bass = new Tone.MonoSynth({
    context,
    volume: -6,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.008, decay: 0.25, sustain: 0.7, release: 0.2 },
    filter: { type: 'lowpass', Q: 0.8 },
    filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2, baseFrequency: sound.bassCutoffHz, octaves: 2 },
  })
  // FrequencyEnvelope.baseFrequency is a plain setter in Tone. Scale its output with an
  // audio-rate multiplier so preset changes follow the required 0.5 s ramp without timers.
  const bassEnvelopeScale = new Tone.Multiply({ context, value: 1 })
  bass.filterEnvelope.disconnect(bass.filter.frequency)
  bass.filterEnvelope.connect(bassEnvelopeScale)
  bassEnvelopeScale.connect(bass.filter.frequency)

  const keys = new Tone.PolySynth({
    context,
    voice: Tone.FMSynth,
    maxPolyphony: 8,
    volume: -8,
    options: {
      harmonicity: 3,
      modulationIndex: 2.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0.2, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
    },
  })
  // A soft, slightly detuned bell for the fly's melodies, with tape wobble and a short echo.
  const lead = new Tone.MonoSynth({
    context,
    volume: -11,
    portamento: 0.015,
    oscillator: { type: 'fattriangle', count: 2, spread: 12 },
    envelope: { attack: 0.012, decay: 0.6, sustain: 0.35, release: 0.6 },
    filter: { type: 'lowpass', Q: 0.6, rolloff: -24 },
    filterEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.6, baseFrequency: 700, octaves: 2.2 },
  })
  const leadVibrato = new Tone.Vibrato({ context, frequency: 4.6, depth: 0.08 })
  const leadFilter = new Tone.Filter({ context, type: 'lowpass', frequency: Math.min(3600, sound.keysCutoffHz * 1.4), Q: 0.4 })
  const leadEcho = new Tone.FeedbackDelay({ context, delayTime: 0.36, feedback: 0.28, wet: 0.18 })
  const leadSend = new Tone.Gain({ context, gain: Math.min(0.5, sound.reverbSend * 1.4) })
  const drums = new Tone.Sampler({ context, urls: { C2: audio.kick, D2: audio.snare, 'F#2': audio.hat }, release: 0.05 })

  const rain = new Tone.Player({ context, url: audio.rain, loop: true, fadeIn: 1.5, fadeOut: 1 })
  const crackle = new Tone.Player({ context, url: audio.crackle, loop: true, fadeIn: 1.5, fadeOut: 1 })
  const rainGain = new Tone.Gain({ context, gain: initialMix.ambienceOn ? sound.rainLevel : 0 })
  const crackleGain = new Tone.Gain({ context, gain: initialMix.ambienceOn ? sound.crackleLevel : 0 })
  const reverb = new Tone.Convolver({ context, url: audio.impulse })
  const keysSend = new Tone.Gain({ context, gain: sound.reverbSend })
  const drumsSend = new Tone.Gain({ context, gain: 0.035 })
  const saturation = new Tone.Distortion({ context, distortion: 0.1, oversample: '2x', wet: sound.saturationWet })
  const masterFilter = new Tone.Filter({ context, type: 'lowpass', frequency: sound.masterCutoffHz })
  const limiter = new Tone.Limiter({ context, threshold: -1 })

  drums.chain(drumsFilter, drumsBus)
  bass.connect(bassBus)
  keys.connect(keysFilter)
  keysFilter.connect(keysBus)
  lead.chain(leadVibrato, leadFilter, leadEcho, leadBus)
  leadBus.connect(master)
  leadBus.connect(leadSend)
  leadSend.connect(reverb)
  rain.connect(rainGain)
  crackle.connect(crackleGain)
  rainGain.connect(ambienceBus)
  crackleGain.connect(ambienceBus)
  drumsBus.connect(master)
  bassBus.connect(master)
  keysBus.connect(master)
  ambienceBus.connect(master)
  keysBus.connect(keysSend)
  drumsBus.connect(drumsSend)
  keysSend.connect(reverb)
  drumsSend.connect(reverb)
  reverb.connect(master)
  master.chain(saturation, masterFilter, limiter, context.destination)

  let currentSound = sound
  let currentMix = initialMix
  let ambienceStarted = false
  let disposed = false
  const audioNodes = [
    drums, bass, keys, lead, leadVibrato, leadFilter, leadEcho, leadSend, leadBus,
    rain, crackle, drumsBus, bassBus, keysBus, ambienceBus, master,
    drumsFilter, keysFilter, bassEnvelopeScale, rainGain, crackleGain, reverb, keysSend, drumsSend,
    saturation, masterFilter, limiter,
  ]

  const rampLayer = (layer: Layer, time: number) => {
    const setting = currentMix.layers[layer]
    const target = setting.muted ? 0 : setting.level
    ;({ drums: drumsBus, bass: bassBus, keys: keysBus, lead: leadBus }[layer]).gain.rampTo(target, 0.03, time)
  }
  const rampAmbience = (time: number) => {
    rainGain.gain.rampTo(currentMix.ambienceOn ? currentSound.rainLevel : 0, 0.03, time)
    crackleGain.gain.rampTo(currentMix.ambienceOn ? currentSound.crackleLevel : 0, 0.03, time)
  }

  return {
    trigger(event, time, durationSeconds) {
      if (disposed) return
      if (event.layer === 'drums') {
        const note = event.drum === 'kick' ? 'C2' : event.drum === 'snare' ? 'D2' : 'F#2'
        drums.triggerAttack(note, time, event.velocity)
      } else if (event.midi !== null) {
        const hz = midiToHz(event.midi)
        if (event.layer === 'bass') bass.triggerAttackRelease(hz, durationSeconds, time, event.velocity)
        else if (event.layer === 'lead') lead.triggerAttackRelease(hz, durationSeconds, time, event.velocity)
        else keys.triggerAttackRelease(hz, durationSeconds, time, event.velocity)
      }
    },
    applySound(nextSound, time) {
      if (disposed) return
      currentSound = nextSound
      drumsFilter.frequency.rampTo(nextSound.drumsCutoffHz, 0.5, time)
      keysFilter.frequency.rampTo(nextSound.keysCutoffHz, 0.5, time)
      bassEnvelopeScale.factor.rampTo(nextSound.bassCutoffHz / sound.bassCutoffHz, 0.5, time)
      masterFilter.frequency.rampTo(nextSound.masterCutoffHz, 0.5, time)
      keysSend.gain.rampTo(nextSound.reverbSend, 0.5, time)
      leadSend.gain.rampTo(Math.min(0.5, nextSound.reverbSend * 1.4), 0.5, time)
      leadFilter.frequency.rampTo(Math.min(3600, nextSound.keysCutoffHz * 1.4), 0.5, time)
      saturation.wet.rampTo(nextSound.saturationWet, 0.5, time)
      rainGain.gain.rampTo(currentMix.ambienceOn ? nextSound.rainLevel : 0, 0.5, time)
      crackleGain.gain.rampTo(currentMix.ambienceOn ? nextSound.crackleLevel : 0, 0.5, time)
    },
    setMix(nextMix, time) {
      if (disposed) return
      currentMix = nextMix
      master.gain.rampTo(nextMix.masterVolume, 0.03, time)
      rampLayer('drums', time)
      rampLayer('bass', time)
      rampLayer('keys', time)
      rampLayer('lead', time)
      rampAmbience(time)
    },
    startAmbience(time) {
      if (disposed || ambienceStarted) return
      ambienceStarted = true
      rain.start(time)
      crackle.start(time)
    },
    stopAmbience(time) {
      if (!ambienceStarted) return
      ambienceStarted = false
      rain.stop(time)
      crackle.stop(time)
    },
    releaseAll(time) {
      if (disposed) return
      keys.releaseAll(time)
      bass.triggerRelease(time)
      lead.triggerRelease(time)
      drums.releaseAll(time)
    },
    rampMasterGain(target, rampSeconds, time) {
      if (disposed) return
      master.gain.rampTo(target, rampSeconds, time)
    },
    get keysActiveVoices() {
      return keys.activeVoices
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const node of audioNodes) node.dispose()
      ambienceStarted = false
    },
  }
}
