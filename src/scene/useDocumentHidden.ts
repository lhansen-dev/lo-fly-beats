import { useCallback, useSyncExternalStore } from 'react'

export function useDocumentHidden(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    if (typeof document === 'undefined') return () => {}
    document.addEventListener('visibilitychange', callback)
    return () => document.removeEventListener('visibilitychange', callback)
  }, [])
  const getSnapshot = useCallback(() => typeof document === 'undefined' ? false : document.hidden, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
