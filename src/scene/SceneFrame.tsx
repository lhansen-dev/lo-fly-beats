import { useRef } from 'react'
import { useAppState } from '../app/store'
import { useMediaQuery } from '../app/useMediaQuery'
import { sceneCrop, WIDE_SCENE_QUERY } from './crop'
import Scene from './Scene'
import { useAnimationEnabled } from './useAnimationEnabled'
import { useDocumentHidden } from './useDocumentHidden'
import { useSceneCues } from './useSceneCues'

export default function SceneFrame({ wide }: { wide?: boolean }) {
  const matches = useMediaQuery(WIDE_SCENE_QUERY)
  const crop = sceneCrop(wide ?? matches)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const sessionSeed = useAppState(s => s.active.sessionSeed)
  const enabled = useAnimationEnabled()
  const hidden = useDocumentHidden()
  useSceneCues(svgRef, { sessionSeed, enabled, hidden })

  return (
    <div className="scene-frame" data-testid="scene-frame" style={{ aspectRatio: crop.aspectRatio }}>
      <Scene preserveAspectRatio={crop.preserveAspectRatio} sessionSeed={sessionSeed} still={!enabled} paused={hidden} svgRef={svgRef} />
    </div>
  )
}
