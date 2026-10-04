import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import { PRESETS } from '../presets/presets'
import Icon from './Icon'

const moods = { 'rainy-windowsill': { icon: 'rain', detail: 'Rain on glass. A warm cup.' }, 'overripe-2am': { icon: 'moon', detail: 'Late nights. Dusty records.' }, 'fruit-bowl-finals': { icon: 'sun', detail: 'Golden light. A little focus.' } } as const

export default function PresetPicker() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)
  const selected = pending.presetId ?? active.presetId

  return (
    <fieldset className="preset-picker">
      <legend>Preset</legend>
      {Object.values(PRESETS).map(preset => (
        <label className={`preset-option preset-${preset.id}`} key={preset.id}><input type="radio" name="preset" data-testid={`preset-${preset.id}`} value={preset.id} checked={selected === preset.id} aria-describedby="preset-pending" onChange={() => controller.selectPreset(preset.id)} /><span className="preset-art"><Icon name={moods[preset.id].icon} /></span><span className="preset-copy"><strong>{preset.name}</strong><small>{moods[preset.id].detail}</small></span><span className="preset-bpm">{preset.tempoBpm}<small>BPM</small></span></label>
      ))}
      <p id="preset-pending">{pending.presetId ? `${PRESETS[pending.presetId].name} at the next phrase` : ''}</p>
    </fieldset>
  )
}
