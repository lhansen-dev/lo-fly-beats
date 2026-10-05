import type { NoteEvent, PhraseScore, SessionRecipe } from '../music/types'
import type { PresetId } from '../presets/types'
import { PHRASE_STEPS } from './timing'

export type PendingChange =
  | { kind: 'tempo'; tempoBpm: number }
  | { kind: 'variation'; variation: number }
  | { kind: 'newBeat'; sessionSeed: number }
  | { kind: 'preset'; presetId: PresetId; tempoBpm: number }

export interface PreparedScoreProvider {
  readonly initialPhraseIndex: number
  readonly scoresHeld: number
  ensureReady(recipe: SessionRecipe, phraseIndex: number): Promise<void>
  take(recipe: SessionRecipe, phraseIndex: number): PhraseScore
  update(recipe: SessionRecipe, phraseIndex: number, resetContext?: boolean): void
  reset(recipe: SessionRecipe): void
}

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
  private pendingTempo: number | null = null
  private pendingVariation: number | null = null
  private pendingSeed: number | null = null
  private pendingPreset: { presetId: PresetId; tempoBpm: number } | null = null
  private prepared?: PreparedScoreProvider

  useBaseline(): void { this.prepared = undefined }

  constructor(compose: (recipe: SessionRecipe, phraseIndex: number) => PhraseScore, recipe: SessionRecipe, prepared?: PreparedScoreProvider) {
    this.compose = compose
    this.recipe = recipe
    this.prepared = prepared
    this.recipeStartStep = -(prepared?.initialPhraseIndex ?? 0) * PHRASE_STEPS
  }

  get active(): SessionRecipe { return this.recipe }

  get pending(): Readonly<Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>> {
    const result: Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>> = {}
    const tempoBpm = this.pendingPreset?.tempoBpm ?? this.pendingTempo
    if (tempoBpm !== null) result.tempoBpm = tempoBpm
    if (this.pendingVariation !== null) result.variation = this.pendingVariation
    if (this.pendingSeed !== null) result.sessionSeed = this.pendingSeed
    if (this.pendingPreset !== null) result.presetId = this.pendingPreset.presetId
    return result
  }

  get currentScore(): PhraseScore | null { return this.score }

  get scoresHeld(): number { return this.prepared?.scoresHeld ?? (this.score === null ? 0 : 1) }

  get nextPhrase(): { recipe: SessionRecipe; phraseIndex: number } {
    return {
      recipe: { ...this.recipe, ...this.pending },
      phraseIndex: this.pendingSeed !== null ? 0 : this.score === null
        ? Math.floor(-this.recipeStartStep / PHRASE_STEPS)
        : Math.floor((this.globalStep - 1 - this.recipeStartStep) / PHRASE_STEPS) + 1,
    }
  }

  reset(recipe: SessionRecipe): void {
    this.recipe = recipe
    this.pendingTempo = null
    this.pendingVariation = null
    this.pendingSeed = null
    this.pendingPreset = null
    this.globalStep = 0
    this.recipeStartStep = 0
    this.score = null
    this.eventsByStep = []
    this.tempoNeedsApply = true
    this.prepared?.reset(recipe)
  }

  request(change: PendingChange): void {
    if (this.currentScore === null) {
      switch (change.kind) {
        case 'tempo': this.recipe = { ...this.recipe, tempoBpm: change.tempoBpm }; this.tempoNeedsApply = true; break
        case 'variation': this.recipe = { ...this.recipe, variation: change.variation }; break
        case 'newBeat': this.recipe = { ...this.recipe, sessionSeed: change.sessionSeed }; this.recipeStartStep = this.globalStep; break
        case 'preset': this.recipe = { ...this.recipe, presetId: change.presetId, tempoBpm: change.tempoBpm }; this.tempoNeedsApply = true; break
      }
      const next = this.nextPhrase
      this.prepared?.update(next.recipe, next.phraseIndex, change.kind === 'preset' || change.kind === 'newBeat')
      return
    }
    switch (change.kind) {
      case 'tempo': this.pendingTempo = change.tempoBpm; break
      case 'variation': this.pendingVariation = change.variation; break
      case 'newBeat': this.pendingSeed = change.sessionSeed; break
      case 'preset': this.pendingTempo = null; this.pendingPreset = { presetId: change.presetId, tempoBpm: change.tempoBpm }; break
    }
    const next = this.nextPhrase
    this.prepared?.update(next.recipe, next.phraseIndex, change.kind === 'preset' || change.kind === 'newBeat')
  }

  applyTempoNow(tempoBpm: number): void {
    this.recipe = { ...this.recipe, tempoBpm }
    this.pendingTempo = null
    this.tempoNeedsApply = true
  }

  advance(): StepPlan {
    const globalStep = this.globalStep++
    let rel = globalStep - this.recipeStartStep
    let stepInPhrase = rel % PHRASE_STEPS
    const applied: PendingChange['kind'][] = []
    if (stepInPhrase === 0) {
      if (this.pendingTempo !== null) {
        if (this.recipe.tempoBpm !== this.pendingTempo) this.tempoNeedsApply = true
        this.recipe = { ...this.recipe, tempoBpm: this.pendingTempo }
        this.pendingTempo = null
        applied.push('tempo')
      }
      if (this.pendingVariation !== null) {
        this.recipe = { ...this.recipe, variation: this.pendingVariation }
        this.pendingVariation = null
        applied.push('variation')
      }
      if (this.pendingSeed !== null) {
        this.recipe = { ...this.recipe, sessionSeed: this.pendingSeed }
        this.pendingSeed = null
        this.recipeStartStep = globalStep
        rel = 0
        stepInPhrase = 0
        applied.push('newBeat')
      }
      if (this.pendingPreset !== null) {
        if (this.recipe.tempoBpm !== this.pendingPreset.tempoBpm) this.tempoNeedsApply = true
        this.recipe = { ...this.recipe, presetId: this.pendingPreset.presetId, tempoBpm: this.pendingPreset.tempoBpm }
        this.pendingPreset = null
        applied.push('preset')
      }
    }
    const phraseIndex = Math.floor(rel / PHRASE_STEPS)
    let phraseStarted: PhraseScore | null = null
    if (stepInPhrase === 0) {
      phraseStarted = this.prepared?.take(this.recipe, phraseIndex) ?? this.compose(this.recipe, phraseIndex)
      this.score = phraseStarted
      const indexed: NoteEvent[][] = Array.from({ length: PHRASE_STEPS }, () => [])
      for (const event of phraseStarted.events) indexed[event.step]?.push(event)
      this.eventsByStep = indexed
    }
    if (stepInPhrase % 16 === 0 && this.pendingTempo !== null) {
      this.recipe = { ...this.recipe, tempoBpm: this.pendingTempo }
      this.pendingTempo = null
      this.tempoNeedsApply = true
      applied.push('tempo')
    }
    const tempoChanged = this.tempoNeedsApply
    this.tempoNeedsApply = false
    return {
      globalStep, phraseIndex, stepInPhrase,
      bar: Math.floor(stepInPhrase / 16),
      beat: Math.floor((stepInPhrase % 16) / 4),
      tempoBpm: this.recipe.tempoBpm, tempoChanged, phraseStarted,
      applied, events: this.eventsByStep[stepInPhrase] ?? [],
    }
  }
}
