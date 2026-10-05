import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SceneFrame from './SceneFrame'
import { sceneCrop } from './crop'

describe('SceneFrame', () => {
  it('returns the responsive crops', () => {
    expect(sceneCrop(true)).toEqual({ aspectRatio: '16 / 9' })
    expect(sceneCrop(false)).toEqual({ aspectRatio: '4 / 3' })
  })

  it('renders the wide scene with its accessible canvas', () => {
    const markup = renderToStaticMarkup(createElement(SceneFrame, { wide: true }))
    for (const expected of [
      'data-testid="scene-frame"',
      'class="scene"',
      'class="scene-canvas"',
      'aspect-ratio:16 / 9',
      'id="scene-title"',
      'id="scene-desc"',
    ]) expect(markup).toContain(expected)
    expect(markup).not.toContain('placeholder of colored blocks')
  })

  it('renders the narrow crop and defaults to it on the server', () => {
    const narrow = renderToStaticMarkup(createElement(SceneFrame, { wide: false }))
    expect(narrow).toContain('aspect-ratio:4 / 3')

    const fallback = renderToStaticMarkup(createElement(SceneFrame))
    expect(fallback).toContain('aspect-ratio:4 / 3')
  })
})
