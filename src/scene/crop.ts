export const WIDE_SCENE_QUERY = '(min-width: 700px)'

export interface SceneCrop {
  aspectRatio: '16 / 9' | '4 / 3'
  preserveAspectRatio: 'xMidYMid slice' | 'xMaxYMid slice'
}

export function sceneCrop(wide: boolean): SceneCrop {
  return wide
    ? { aspectRatio: '16 / 9', preserveAspectRatio: 'xMidYMid slice' }
    : { aspectRatio: '4 / 3', preserveAspectRatio: 'xMaxYMid slice' }
}
