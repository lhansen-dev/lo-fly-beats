import { useAppState } from '../app/store'
import { useMediaQuery } from '../app/useMediaQuery'
import { sceneCrop, WIDE_SCENE_QUERY } from './crop'
import Scene from './Scene'
import { useAnimationEnabled } from './useAnimationEnabled'
import { useDocumentHidden } from './useDocumentHidden'

export default function SceneFrame({ wide }: { wide?: boolean }) {
  const matches = useMediaQuery(WIDE_SCENE_QUERY)
  const crop = sceneCrop(wide ?? matches)
  const sessionSeed = useAppState(s => s.active.sessionSeed)
  const presetId = useAppState(s => s.active.presetId)
  const ready = useAppState(s => s.circuit.status !== 'loading')
  const enabled = useAnimationEnabled()
  const hidden = useDocumentHidden()

  return (
    <div className="scene-frame" data-testid="scene-frame" style={{ aspectRatio: crop.aspectRatio }}>
      <Scene sessionSeed={sessionSeed} presetId={presetId} still={!enabled} paused={hidden} ready={ready} />
    </div>
  )
}
