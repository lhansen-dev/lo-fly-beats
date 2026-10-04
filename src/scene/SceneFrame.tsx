import { useMediaQuery } from '../app/useMediaQuery'
import { sceneCrop, WIDE_SCENE_QUERY } from './crop'
import Scene from './Scene'

export default function SceneFrame({ wide }: { wide?: boolean }) {
  const matches = useMediaQuery(WIDE_SCENE_QUERY)
  const crop = sceneCrop(wide ?? matches)

  return (
    <div className="scene-frame" data-testid="scene-frame" style={{ aspectRatio: crop.aspectRatio }}>
      <Scene preserveAspectRatio={crop.preserveAspectRatio} />
    </div>
  )
}
