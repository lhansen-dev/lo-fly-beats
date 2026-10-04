import { useAppState } from '../app/store'
import { useMediaQuery } from '../app/useMediaQuery'
import { effectiveAnimationEnabled, REDUCED_MOTION_QUERY } from './animationMode'

export function useAnimationEnabled(): boolean {
  return effectiveAnimationEnabled(useAppState((state) => state.ui.animationEnabled), useMediaQuery(REDUCED_MOTION_QUERY))
}
