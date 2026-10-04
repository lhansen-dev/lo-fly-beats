import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, readCssColor } from '../helpers/contrast'

const appCss = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('app stylesheet', () => {
  it('defines responsive layout, focus, motion, and link styles', () => {
    for (const required of [
      '@media (min-width: 960px)',
      'minmax(0, 2fr) minmax(0, 1fr)',
      '@media (min-width: 700px) and (max-width: 959px)',
      'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 699px)',
      '.transport-bar',
      'position: fixed',
      ':focus-visible',
      'outline: 3px solid var(--focus)',
      'outline-offset: 2px',
      '@media (prefers-reduced-motion: reduce)',
      'transition-duration: 0s !important',
      'background: var(--ui-bg)',
      'color: var(--ui-text)'
    ]) {
      expect(appCss).toContain(required)
    }

    expect(appCss).toMatch(/a,\s*a:visited\s*\{[^}]*color:\s*var\(--ui-text\)[^}]*text-decoration:\s*underline/)
    expect(appCss).not.toContain('scene-placeholder')
  })

  it('uses link text colors with sufficient contrast on both surfaces', () => {
    const text = readCssColor(tokensCss, 'ui-text')
    expect(contrastRatio(text, readCssColor(tokensCss, 'ui-surface'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(text, readCssColor(tokensCss, 'ui-bg'))).toBeGreaterThanOrEqual(4.5)
  })
})
