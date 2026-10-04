import type { VisualParams } from '../presets/types'

export function visualCssVars(visual: VisualParams): Record<string, string> {
  return {
    '--scene-wall': visual.wall,
    '--scene-window-sky': visual.windowSky,
    '--scene-glass-tint': visual.glassTint,
    '--scene-desk': visual.desk,
    '--scene-desk-edge': visual.deskEdge,
    '--scene-light-color': visual.lightColor,
    '--scene-light-opacity': String(visual.lightOpacity),
    '--scene-shadow-opacity': String(visual.shadowOpacity),
    '--ui-accent': visual.uiAccent,
  }
}
