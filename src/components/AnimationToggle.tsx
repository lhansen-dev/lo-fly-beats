import { useController } from '../app/ControllerContext'
import { useAnimationEnabled } from '../scene/useAnimationEnabled'

export default function AnimationToggle() {
  const controller = useController()
  const checked = useAnimationEnabled()

  return <label>
    <input type="checkbox" data-testid="animation-toggle" checked={checked} onChange={event => controller.setAnimationEnabled(event.target.checked)} />
    Animate scene
  </label>
}
