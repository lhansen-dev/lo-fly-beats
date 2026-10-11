import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function VariationControl() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)
  const variation = Math.round((pending.variation ?? active.variation) * 100)
  const flyComposing = useAppState(state => state.brain?.status === 'ready')

  return (
    <label className="parameter-control">Variation <input type="range" data-testid="variation" min="0" max="100" step="1" value={variation} aria-valuetext={`Variation ${variation} percent`} aria-describedby="variation-pending" onChange={event => controller.setVariation(Number(event.target.value) / 100)} /><output role="none">{variation}</output><span id="variation-pending">{pending.variation !== undefined ? ` Variation ${variation} at the next phrase` : ''}</span>{flyComposing && <span className="variation-hint">How adventurous the fly plays: steady at 0, daring at 100.</span>}</label>
  )
}
