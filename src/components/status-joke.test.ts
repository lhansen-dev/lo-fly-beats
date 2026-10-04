// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInitialState } from '../app/state'
import { createAppStore } from '../app/store'
import { selectJoke } from '../app/jokes'
import type { PhraseScore } from '../music/types'
import StatusJoke from './StatusJoke'

describe('StatusJoke', () => {
  it('shows only the joke for the active phrase score', () => {
    const store = createAppStore(createInitialState(null))
    const markup = () => renderToStaticMarkup(createElement(StatusJoke))

    expect(markup()).toBe('')
    const phraseIndex = Array.from({ length: 300 }, (_, p) => p).find(p => selectJoke(1, p) !== null)
    expect(phraseIndex).toBeDefined()
    const joke = selectJoke(1, phraseIndex!)
    store.dispatch({ type: 'phraseStarted', score: { sessionSeed: 1, phraseIndex: phraseIndex! } as unknown as PhraseScore })
    const activeMarkup = markup()
    expect(activeMarkup).toContain('data-testid="status-joke"')
    expect(activeMarkup).toContain(joke!)
    expect(activeMarkup).not.toContain('aria-')
    expect(activeMarkup).not.toContain('role=')

    store.dispatch({ type: 'phraseStarted', score: { sessionSeed: 1, phraseIndex: phraseIndex! + 1 } as unknown as PhraseScore })
    expect(markup()).toBe('')
  })
})
