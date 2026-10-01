import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { SessionController } from './controller'

const ControllerContext = createContext<SessionController | null>(null)

export function ControllerProvider({ controller, children }: { controller: SessionController; children: ReactNode }) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>
}

export function useController(): SessionController {
  const controller = useContext(ControllerContext)
  if (controller === null) throw new Error('useController must be used inside ControllerProvider')
  return controller
}
