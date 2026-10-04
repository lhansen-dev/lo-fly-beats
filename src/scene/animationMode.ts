export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function effectiveAnimationEnabled(stored: boolean | null, prefersReducedMotion: boolean): boolean {
  return stored ?? !prefersReducedMotion
}

export function sceneClassName({ still, paused }: { still: boolean; paused: boolean }): string {
  return `scene${still ? ' scene--still' : ''}${paused ? ' scene--paused' : ''}`
}
