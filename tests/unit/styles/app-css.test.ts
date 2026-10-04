import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, readCssColor } from '../helpers/contrast'

const appCss = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('app stylesheet', () => {
  it('defines responsive layout, focus, motion, and link styles', () => {
    for (const required of [
      '@media (max-width: 1100px)',
      'minmax(0, 1.65fr) minmax(340px, 1fr)',
      '@media (max-width: 850px)',
      'grid-template-columns: 1fr 1fr',
      '@media (max-width: 699px)',
      '.transport-bar',
      'position: fixed',
      ':focus-visible',
      'outline: 3px solid var(--focus)',
      'outline-offset: 4px',
      '@media (prefers-reduced-motion: reduce)',
      'transition-duration: 0s !important',
      'var(--ui-bg)',
      'color: var(--ui-text)'
    ]) {
      expect(appCss).toContain(required)
    }

    expect(appCss).toMatch(/a,\s*a:visited\s*\{[^}]*color:\s*var\(--ui-accent\)/)
    expect(appCss).not.toContain('scene-placeholder')
  })

  it('uses text colors with sufficient contrast on both surfaces', () => {
    const text = readCssColor(tokensCss, 'ui-text')
    expect(contrastRatio(text, readCssColor(tokensCss, 'ui-surface'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(text, readCssColor(tokensCss, 'ui-bg'))).toBeGreaterThanOrEqual(4.5)
    for (const accent of ['#9fc3e6', '#ffb35c', '#e8a33d']) {
      expect(contrastRatio(accent, readCssColor(tokensCss, 'ui-surface'))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
