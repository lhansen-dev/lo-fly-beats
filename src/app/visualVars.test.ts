import { describe, expect, it } from 'vitest'
import { PRESETS } from '../presets/presets'
import { visualCssVars } from './visualVars'

describe('visualCssVars', () => {
  it('maps preset visual values to scene and UI CSS variables', () => {
    expect(visualCssVars(PRESETS['overripe-2am'].visual)).toEqual({
      '--scene-wall': '#2a2320',
      '--scene-window-sky': '#151b2b',
      '--scene-glass-tint': 'rgba(90, 110, 150, 0.2)',
      '--scene-desk': '#4a3426',
      '--scene-desk-edge': '#33241a',
      '--scene-light-color': '#ffb35c',
      '--scene-light-opacity': '0.35',
      '--scene-shadow-opacity': '0.55',
      '--ui-accent': '#ffb35c',
    })
  })
})
