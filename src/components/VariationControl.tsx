import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function VariationControl() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)
  const variation = Math.round((pending.variation ?? active.variation) * 100)

  return (
    <label>Variation <input type="range" data-testid="variation" min="0" max="100" step="1" value={variation} onChange={event => controller.setVariation(Number(event.target.value) / 100)} /><output>{variation}</output></label>
  )
}
