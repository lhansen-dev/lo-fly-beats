import type { NoteEvent, PhraseScore, SessionRecipe } from '../music/types'
import type { PresetId } from '../presets/types'
import { PHRASE_STEPS } from './timing'

export type PendingChange =
  | { kind: 'tempo'; tempoBpm: number }
  | { kind: 'variation'; variation: number }
  | { kind: 'newBeat'; sessionSeed: number }
  | { kind: 'preset'; presetId: PresetId; tempoBpm: number }

export interface StepPlan {
  globalStep: number
  phraseIndex: number
  stepInPhrase: number
  bar: number
  beat: number
  tempoBpm: number
  tempoChanged: boolean
  phraseStarted: PhraseScore | null
  applied: PendingChange['kind'][]
  events: readonly NoteEvent[]
}

export class PlaybackSequencer {
  private readonly compose: (recipe: SessionRecipe, phraseIndex: number) => PhraseScore
  private recipe: SessionRecipe
  private globalStep = 0
  private recipeStartStep = 0
  private score: PhraseScore | null = null
  private eventsByStep: readonly NoteEvent[][] = []
  private tempoNeedsApply = true

  constructor(compose: (recipe: SessionRecipe, phraseIndex: number) => PhraseScore, recipe: SessionRecipe) {
    this.compose = compose
    this.recipe = recipe
  }

  get active(): SessionRecipe { return this.recipe }

  get pending(): Readonly<Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>> { return {} }

  get currentScore(): PhraseScore | null { return this.score }

  get scoresHeld(): number { return this.score === null ? 0 : 1 }

  reset(recipe: SessionRecipe): void {
    this.recipe = recipe
    this.globalStep = 0
    this.recipeStartStep = 0
    this.score = null
    this.eventsByStep = []
    this.tempoNeedsApply = true
  }

  advance(): StepPlan {
    const globalStep = this.globalStep++
    const rel = globalStep - this.recipeStartStep
    const stepInPhrase = rel % PHRASE_STEPS
    const phraseIndex = Math.floor(rel / PHRASE_STEPS)
    let phraseStarted: PhraseScore | null = null
    if (stepInPhrase === 0) {
      phraseStarted = this.compose(this.recipe, phraseIndex)
      this.score = phraseStarted
      const indexed: NoteEvent[][] = Array.from({ length: PHRASE_STEPS }, () => [])
      for (const event of phraseStarted.events) indexed[event.step]?.push(event)
      this.eventsByStep = indexed
    }
    const tempoChanged = this.tempoNeedsApply
    this.tempoNeedsApply = false
    return {
      globalStep, phraseIndex, stepInPhrase,
      bar: Math.floor(stepInPhrase / 16),
      beat: Math.floor((stepInPhrase % 16) / 4),
      tempoBpm: this.recipe.tempoBpm, tempoChanged, phraseStarted,
      applied: [], events: this.eventsByStep[stepInPhrase] ?? [],
    }
  }
}
