import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function TempoControl() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)
  const tempoBpm = pending.tempoBpm ?? active.tempoBpm

  return (
    <label className="parameter-control">Tempo <input type="range" data-testid="tempo" min="60" max="100" step="1" value={tempoBpm} aria-valuetext={`${tempoBpm} BPM`} aria-describedby="tempo-pending" onChange={event => controller.setTempo(Number(event.target.value))} /><output role="none">{tempoBpm} BPM</output><span id="tempo-pending">{pending.tempoBpm !== undefined ? ` ${tempoBpm} BPM at the next ${pending.presetId ? 'phrase' : 'bar'}` : ''}</span></label>
  )
}
