import { useEffect } from 'react'
import { useController } from './ControllerContext'
import { getAppStore } from './store'

export function useKeyboardShortcuts(): void {
  const controller = useController()
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('input, select, textarea, button, a, [contenteditable]:not([contenteditable="false"])')) return
      if (target !== document.body && !target.closest('[data-testid="scene-frame"]')) return
      const key = event.key.toLowerCase()
      if (key !== ' ' && key !== 'k' && key !== 'n') return
      event.preventDefault()
      if (key === 'n') controller.newBeat()
      else if (getAppStore().getState().engineStatus === 'idle') void controller.startListening()
      else controller.togglePlay()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [controller])
}
