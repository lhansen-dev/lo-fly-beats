import { createRng } from '../music/rng'
import type { PresetId } from '../presets/types'
import { critique, CRITIC_PARTS, realizesSection, type CriticPart } from './critic'
import type { BrainModel } from './model'
import { freshRuntime, perform, type PhraseActions } from './perform'
import { createTutor, tutorPhrase } from './tutor'
import { BARS, HEADS, STEPS_PER_BAR, type StepHead } from './vocabulary'

export const EVALUATION_PRESETS: readonly PresetId[] = ['rainy-windowsill', 'overripe-2am', 'fruit-bowl-finals']

export interface PlayMeasurement {
  phrases: number
  total: number
  parts: Record<CriticPart, number>
  /** Fraction of phrases that differ from every other phrase in the sample. */
  distinctPhrases: number
  /** Distinct four-chord progressions across sessions. */
  progressions: number
  /** Fraction of the fly's drum, bass, and lead bars that never occur in a large tutor sample. */
  originality: Record<'drums' | 'bass' | 'lead', number>
  /** Share of phrases in each section. */
  sections: Record<string, number>
  /** Share of intros and breakdowns whose music actually matches the section. */
  realized: number
  /** Mean onsets per phrase for each layer. */
  density: Record<'kick' | 'snare' | 'hat' | 'bass' | 'keys' | 'lead', number>
}

type Player = (session: number, phrase: number, presetId: PresetId) => PhraseActions

function barKey(actions: PhraseActions, heads: readonly StepHead[], bar: number): string {
  return heads.map(head => actions.steps[head].slice(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR).join('')).join('/')
}

const ORIGINALITY_LAYERS = { drums: ['kick', 'snare', 'hat'], bass: ['bass'], lead: ['lead'] } as const satisfies Record<string, readonly StepHead[]>

/** Every bar the tutor plays across many seeded songs, for measuring what the fly invented. */
export function tutorVocabulary(songs = 300, phrasesPerSong = 6): Record<keyof typeof ORIGINALITY_LAYERS, Set<string>> {
  const vocabulary = { drums: new Set<string>(), bass: new Set<string>(), lead: new Set<string>() }
  for (let song = 0; song < songs; song++) {
    const rng = createRng(`tutor-vocabulary|${song}`)
    const tutor = createTutor(EVALUATION_PRESETS[song % 3]!, rng)
    for (let phrase = 0; phrase < phrasesPerSong; phrase++) {
      const actions = tutorPhrase(tutor, rng)
      for (let bar = 0; bar < BARS; bar++) {
        for (const [layer, heads] of Object.entries(ORIGINALITY_LAYERS)) vocabulary[layer as keyof typeof vocabulary].add(barKey(actions, heads, bar))
      }
    }
  }
  return vocabulary
}

export function measurePlay(player: Player, sessions: number, phrasesPerSession: number, vocabulary?: ReturnType<typeof tutorVocabulary>): PlayMeasurement {
  const parts = Object.fromEntries(CRITIC_PARTS.map(part => [part, 0])) as Record<CriticPart, number>
  let total = 0
  let count = 0
  const keys = new Map<string, number>()
  const progressions = new Set<string>()
  const novel = { drums: [0, 0], bass: [0, 0], lead: [0, 0] }
  const sections: Record<string, number> = { groove: 0, breakdown: 0, intro: 0 }
  let special = 0
  let realizedCount = 0
  const density = { kick: 0, snare: 0, hat: 0, bass: 0, keys: 0, lead: 0 }
  for (let session = 0; session < sessions; session++) {
    const presetId = EVALUATION_PRESETS[session % EVALUATION_PRESETS.length]!
    const previous: PhraseActions[] = []
    for (let phrase = 0; phrase < phrasesPerSession; phrase++) {
      const actions = player(session, phrase, presetId)
      const critic = critique(actions, presetId, previous)
      previous.push(actions)
      total += critic.total
      for (const part of CRITIC_PARTS) parts[part] += critic[part]
      count++
      const key = JSON.stringify(actions.steps)
      keys.set(key, (keys.get(key) ?? 0) + 1)
      if (phrase === 0) progressions.add(actions.chords.join())
      const section = HEADS.section[actions.section] ?? 'groove'
      sections[section] = (sections[section] ?? 0) + 1
      if (section !== 'groove') { special++; if (realizesSection(actions)) realizedCount++ }
      density.kick += actions.steps.kick.filter(Boolean).length
      density.snare += actions.steps.snare.filter(Boolean).length
      density.hat += actions.steps.hat.filter(Boolean).length
      density.bass += actions.steps.bass.filter(action => action >= 2).length
      density.keys += actions.steps.keys.filter(action => action === 1 || action === 2).length
      density.lead += actions.steps.lead.filter(action => action >= 2).length
      if (vocabulary) {
        for (let bar = 0; bar < BARS; bar++) {
          for (const [layer, heads] of Object.entries(ORIGINALITY_LAYERS) as [keyof typeof novel, readonly StepHead[]][]) {
            // Silent bars are neither original nor copied.
            const minimum = layer === 'drums' ? 1 : 2
            const sounds = heads.some(head => actions.steps[head].slice(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR).some(action => action >= minimum))
            if (!sounds) continue
            const key = barKey(actions, heads, bar)
            novel[layer][1]!++
            if (!vocabulary[layer].has(key)) novel[layer][0]!++
          }
        }
      }
    }
  }
  for (const part of CRITIC_PARTS) parts[part] /= count
  for (const layer of Object.keys(density) as (keyof typeof density)[]) density[layer] /= count
  for (const section of Object.keys(sections)) sections[section] = sections[section]! / count
  const unique = [...keys.values()].filter(times => times === 1).length
  return {
    phrases: count, total: total / count, parts, distinctPhrases: unique / count, progressions: progressions.size,
    originality: {
      drums: novel.drums[1] ? novel.drums[0]! / novel.drums[1]! : 0,
      bass: novel.bass[1] ? novel.bass[0]! / novel.bass[1]! : 0,
      lead: novel.lead[1] ? novel.lead[0]! / novel.lead[1]! : 0,
    },
    sections, realized: special ? realizedCount / special : 1, density,
  }
}

/** The fly plays seeded sessions from fresh moods; nothing about the tutor reaches it. */
export function flyPlayer(model: BrainModel, readout: Float32Array, temperature: number, seed = 'evaluation'): Player {
  let runtime = freshRuntime(model)
  let rng = createRng(seed)
  return (session, phrase, presetId) => {
    if (phrase === 0) {
      rng = createRng(`${seed}|${session}`)
      runtime = freshRuntime(model, rng)
    }
    const performance = perform(model, readout, runtime, { temperature, rng, presetId })
    runtime = performance.runtime
    return performance.actions
  }
}

export function tutorPlayer(seed = 'evaluation-tutor'): Player {
  let tutor = createTutor(EVALUATION_PRESETS[0]!, createRng(seed))
  let rng = createRng(seed)
  return (session, phrase, presetId) => {
    if (phrase === 0) {
      rng = createRng(`${seed}|${session}`)
      tutor = createTutor(presetId, rng)
    }
    return tutorPhrase(tutor, rng)
  }
}
