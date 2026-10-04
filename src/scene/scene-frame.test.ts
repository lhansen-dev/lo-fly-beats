import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SceneFrame from './SceneFrame'
import { sceneCrop } from './crop'

describe('SceneFrame', () => {
  it('returns the responsive crops', () => {
    expect(sceneCrop(true)).toEqual({ aspectRatio: '16 / 9', preserveAspectRatio: 'xMidYMid slice' })
    expect(sceneCrop(false)).toEqual({ aspectRatio: '4 / 3', preserveAspectRatio: 'xMaxYMid slice' })
  })

  it('renders the wide scene with its responsive tokens', () => {
    const markup = renderToStaticMarkup(createElement(SceneFrame, { wide: true }))
    for (const expected of [
      'data-testid="scene-frame"',
      'viewBox="0 0 1600 900"',
      'preserveAspectRatio="xMidYMid slice"',
      'aspect-ratio:16 / 9',
      'var(--scene-wall)',
      'var(--scene-window-sky)',
      'var(--scene-desk)',
      'var(--scene-light-color)',
      'id="scene-title"',
    ]) expect(markup).toContain(expected)
  })

  it('renders the narrow crop and defaults to it on the server', () => {
    const narrow = renderToStaticMarkup(createElement(SceneFrame, { wide: false }))
    expect(narrow).toContain('preserveAspectRatio="xMaxYMid slice"')
    expect(narrow).toContain('aspect-ratio:4 / 3')

    const fallback = renderToStaticMarkup(createElement(SceneFrame))
    expect(fallback).toContain('preserveAspectRatio="xMaxYMid slice"')
    expect(fallback).toContain('aspect-ratio:4 / 3')
  })
})
