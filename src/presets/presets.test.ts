import { describe, expect, it } from 'vitest'
import { getPreset, PRESETS } from './presets'

describe('preset visual parameters', () => {
  it('defines the exact visual values for every preset', () => {
    expect(PRESETS['rainy-windowsill'].visual).toEqual({
      wall: '#3b4a5a', windowSky: '#6f8ba3', glassTint: 'rgba(180, 205, 230, 0.25)',
      desk: '#6b4f3a', deskEdge: '#4f3a2b', lightColor: '#9fc3e6', lightOpacity: 0.18,
      shadowOpacity: 0.35, uiAccent: '#9fc3e6',
    })
    expect(PRESETS['overripe-2am'].visual).toEqual({
      wall: '#2a2320', windowSky: '#151b2b', glassTint: 'rgba(90, 110, 150, 0.2)',
      desk: '#4a3426', deskEdge: '#33241a', lightColor: '#ffb35c', lightOpacity: 0.35,
      shadowOpacity: 0.55, uiAccent: '#ffb35c',
    })
    expect(PRESETS['fruit-bowl-finals'].visual).toEqual({
      wall: '#e9d8b8', windowSky: '#bcd9ea', glassTint: 'rgba(255, 255, 255, 0.18)',
      desk: '#a47449', deskEdge: '#7d5634', lightColor: '#ffe7a8', lightOpacity: 0.22,
      shadowOpacity: 0.2, uiAccent: '#e8a33d',
    })
  })

  it('returns the preset visual accent', () => {
    expect(getPreset('overripe-2am').visual.uiAccent).toBe('#ffb35c')
  })
})
