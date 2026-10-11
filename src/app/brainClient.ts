import type { PreparedScoreProvider } from '../audio/sequencer'
import type { PhraseScore, SessionRecipe } from '../music/types'
import type { BrainAtlas, BrainExperience, BrainPort, BrainRequest, BrainResponse, ComposedPhrase } from '../brain/protocol'

export interface PlayedPhraseSummary {
  id: string
  phraseIndex: number
  bananas: number
  section: string
  parts: ComposedPhrase['parts']
  notes: string[]
  composeMs: number
}

export interface BrainStatus {
  status: 'loading' | 'ready' | 'error'
  message: string
  experience: BrainExperience | null
  playing: PlayedPhraseSummary | null
  bananaGiven: string | null
}

export interface BrainDiagnostics {
  workers: number
  readyScores: number
  pendingCompositions: number
  fallbackCount: number
  composeMs: number
}

interface Forecast { recipe: SessionRecipe; phraseIndex: number; fresh: boolean; generation: number }

const recipeKey = (recipe: SessionRecipe) => `${recipe.presetId}|${recipe.sessionSeed}|${recipe.variation}`
const matches = (forecast: { recipe: SessionRecipe; phraseIndex: number }, recipe: SessionRecipe, phraseIndex: number) =>
  recipeKey(forecast.recipe) === recipeKey(recipe) && forecast.phraseIndex === phraseIndex

/**
 * Keeps the next phrase the fly composed ready for the sequencer. The audio callback only takes a
 * ready score; composition, learning, and saving happen in the brain worker.
 */
export class BrainClient implements PreparedScoreProvider {
  readonly initialPhraseIndex = 0
  private readonly worker: BrainPort
  private readonly onStatus: (status: BrainStatus) => void
  private atlasValue: BrainAtlas | null = null
  private experience: BrainExperience | null = null
  private active: ComposedPhrase | null = null
  private ready: { forecast: Forecast; phrase: ComposedPhrase } | null = null
  private forecast: Forecast | null = null
  private composing: Forecast | null = null
  private generation = 0
  private sequence = 0
  private failed = false
  private disposed = false
  private fallbackCount = 0
  private status: BrainStatus['status'] = 'loading'
  private message = 'Waking the fly…'
  private bananaGiven: string | null = null
  private readonly frames = new Map<string, Int8Array>()
  private readonly waiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []
  private readonly pending = new Map<number, { resolve: (response: BrainResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  constructor(options: { onStatus: (status: BrainStatus) => void; worker?: BrainPort }) {
    this.onStatus = options.onStatus
    this.worker = options.worker ?? new Worker(new URL('../brain/worker.ts', import.meta.url), { type: 'module' }) as unknown as BrainPort
    this.worker.onmessage = event => this.receive(event.data)
    this.worker.onerror = event => { event.preventDefault(); this.fail(event.message || 'The fly brain stopped') }
  }

  get atlas(): BrainAtlas | null { return this.atlasValue }
  get scoresHeld(): number { return Number(this.active !== null) + Number(this.ready !== null) }

  async initialize(baseUrl: string, recipe: SessionRecipe): Promise<void> {
    this.publish()
    // The worker lives under assets/, so a relative deployment base must be resolved against the page.
    const absolute = new URL(baseUrl, globalThis.document?.baseURI ?? globalThis.location?.href).href
    const response = await this.send({ type: 'initialize', baseUrl: absolute })
    if (response.type !== 'initialized') throw new Error('Unexpected brain response')
    this.atlasValue = response.atlas
    this.experience = response.state
    this.setStatus('ready', 'The fly is awake and listening to the clock.')
    this.update(recipe, 0, true)
  }

  /** Activity of every neuron at each beat of a phrase the fly composed. */
  framesFor(phraseId: string): Int8Array | null {
    return this.frames.get(phraseId) ?? null
  }

  get playingId(): string | null { return this.active?.id ?? null }

  private send(body: BrainRequest extends infer R ? R extends { id: number } ? Omit<R, 'id'> : never : never, timeoutMs = 60_000): Promise<BrainResponse> {
    if (this.failed || this.disposed) return Promise.reject(new Error('The fly brain is unavailable'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail('The fly brain stopped responding'), timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try { this.worker.postMessage({ ...body, id } as BrainRequest) }
      catch (error) { this.fail(error instanceof Error ? error.message : String(error)) }
    })
  }

  private receive(response: BrainResponse): void {
    const pending = this.pending.get(response.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(response.id)
    if (response.type === 'error') pending.reject(new Error(response.message))
    else pending.resolve(response)
  }

  update(recipe: SessionRecipe, phraseIndex: number, resetContext = false): void {
    if (this.failed || this.disposed || !this.atlasValue) return
    if (this.forecast && matches(this.forecast, recipe, phraseIndex) && !resetContext) return
    this.generation++
    this.ready = null
    // A queued fresh start survives later variation or tempo requests for the same phrase.
    const fresh = resetContext || (!!this.forecast?.fresh && this.forecast.phraseIndex === phraseIndex)
    this.forecast = { recipe: { ...recipe }, phraseIndex, fresh, generation: this.generation }
    this.queueComposition()
  }

  reset(recipe: SessionRecipe): void {
    if (this.failed || this.disposed) return
    this.active = null
    this.update(recipe, 0, true)
  }

  async ensureReady(recipe: SessionRecipe, phraseIndex: number): Promise<void> {
    if (this.failed || this.disposed) throw new Error(this.message)
    this.update(recipe, phraseIndex)
    if (this.ready && matches(this.ready.forecast, recipe, phraseIndex)) return
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }

  /** Called from audio scheduling: swap pointers only, defer messaging. */
  take(recipe: SessionRecipe, phraseIndex: number): PhraseScore {
    const ready = this.ready
    if (ready && ready.forecast.generation === this.generation && matches(ready.forecast, recipe, phraseIndex)) {
      const previous = this.active
      this.active = ready.phrase
      this.ready = null
      this.forecast = { recipe: { ...recipe }, phraseIndex: phraseIndex + 1, fresh: false, generation: this.generation }
      queueMicrotask(() => {
        if (this.disposed) return
        if (previous && previous.id !== this.bananaGiven) this.frames.delete(previous.id)
        for (const id of this.frames.keys()) if (id !== this.active?.id && id !== this.bananaGiven) this.frames.delete(id)
        this.bananaGiven = null
        void this.send({ type: 'adopt', phraseId: ready.phrase.id }).then(response => {
          if (response.type === 'adopted') { this.experience = response.state; this.publish() }
        }, () => undefined)
        this.setStatus('ready', 'The fly is playing what it just composed.')
        this.queueComposition()
      })
      return ready.phrase.score
    }
    if (!this.active) throw new Error('The fly has not composed its first phrase yet')
    // Missed the boundary: repeat the current phrase rather than stall the music.
    this.fallbackCount++
    this.forecast = { recipe: { ...recipe }, phraseIndex: phraseIndex + 1, fresh: this.forecast?.fresh ?? false, generation: ++this.generation }
    queueMicrotask(() => this.queueComposition())
    return this.active.score
  }

  private queueComposition(): void {
    if (this.composing || this.ready || !this.forecast || this.failed || this.disposed) return
    const forecast = this.forecast
    this.composing = forecast
    void this.send({ type: 'compose', recipe: forecast.recipe, phraseIndex: forecast.phraseIndex, fresh: forecast.fresh }).then(response => {
      if (response.type !== 'composed') throw new Error('Unexpected brain response')
      if (this.disposed || forecast.generation !== this.generation || this.forecast !== forecast) return
      this.frames.set(response.phrase.id, response.phrase.frames)
      this.ready = { forecast, phrase: response.phrase }
      for (const waiter of this.waiters.splice(0)) waiter.resolve()
      this.publish()
    }).catch(error => this.fail(error instanceof Error ? error.message : String(error))).finally(() => {
      if (this.composing === forecast) this.composing = null
      if (!this.ready) this.queueComposition()
    })
  }

  /** The listener liked what they are hearing right now. */
  giveBanana(): void {
    const phrase = this.active
    if (!phrase || this.bananaGiven === phrase.id || this.failed) return
    this.bananaGiven = phrase.id
    this.publish()
    void this.send({ type: 'banana', phraseId: phrase.id }).then(response => {
      if (response.type === 'bananaReceived') { this.experience = response.state; this.publish() }
    }, () => undefined)
  }

  async forget(): Promise<void> {
    const response = await this.send({ type: 'forget' })
    if (response.type === 'forgotten') this.experience = response.state
    this.publish()
  }

  private setStatus(status: BrainStatus['status'], message: string): void {
    this.status = status
    this.message = message
    this.publish()
  }

  private publish(): void {
    if (this.disposed) return
    const active = this.active
    this.onStatus({
      status: this.status, message: this.message, experience: this.experience,
      playing: active ? {
        id: active.id, phraseIndex: active.score.phraseIndex, bananas: active.bananas, section: active.section, parts: active.parts,
        notes: active.notes, composeMs: active.composeMs,
      } : null,
      bananaGiven: this.bananaGiven,
    })
  }

  private fail(message: string): void {
    if (this.failed || this.disposed) return
    this.failed = true
    this.worker.terminate()
    this.ready = null
    const error = new Error(message)
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
    this.setStatus('error', `The fly brain is unavailable (${message}). ${this.active ? 'The current phrase keeps playing.' : 'The connectome walk will compose instead.'}`)
  }

  getDiagnostics(): BrainDiagnostics {
    return {
      workers: Number(!this.failed && !this.disposed), readyScores: this.scoresHeld, pendingCompositions: Number(this.composing !== null),
      fallbackCount: this.fallbackCount, composeMs: this.ready?.phrase.composeMs ?? this.active?.composeMs ?? 0,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.worker.terminate()
    this.worker.onmessage = null
    this.worker.onerror = null
    const error = new Error('The fly brain was closed')
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
    this.frames.clear()
  }
}
