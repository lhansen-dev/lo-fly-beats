import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useOptionalController } from '../app/ControllerContext'
import { createCueSession, findCueTargets } from './sceneCueDriver'

export function useSceneCues(svgRef: RefObject<SVGSVGElement | null>, { sessionSeed, enabled, hidden }: {
  sessionSeed: number
  enabled: boolean
  hidden: boolean
}): void {
  const controller = useOptionalController()
  const sessionRef = useRef<ReturnType<typeof createCueSession> | null>(null)
  if (sessionRef.current === null) sessionRef.current = createCueSession()
  const session = sessionRef.current

  useEffect(() => {
    const svg = svgRef.current
    session.update({ sessionSeed, enabled, hidden, source: controller, targets: svg ? findCueTargets(svg) : null })
    return () => session.stop()
  }, [controller, sessionSeed, enabled, hidden, svgRef])
}
