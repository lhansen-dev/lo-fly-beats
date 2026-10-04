import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import Icon from './Icon'

export default function MasterVolume() {
  const controller = useController()
  const mix = useAppState(state => state.mix)
  const percentage = Math.round(mix.masterVolume * 100)

  return (
    <label className="master-volume"><Icon name="volume" /><span className="sr-only">Master volume</span><input type="range" data-testid="master-volume" min="0" max="100" step="1" value={percentage} aria-valuetext={`Master volume ${percentage} percent`} onChange={event => controller.setMix({ masterVolume: Number(event.target.value) / 100 })} /><output role="none">{percentage}%</output></label>
  )
}
