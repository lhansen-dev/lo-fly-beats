import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import { PRESETS } from '../presets/presets'

export default function PresetPicker() {
  const controller = useController()
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)
  const selected = pending.presetId ?? active.presetId

  return (
    <fieldset>
      <legend>Preset</legend>
      {Object.values(PRESETS).map(preset => (
        <label key={preset.id}><input type="radio" name="preset" data-testid={`preset-${preset.id}`} value={preset.id} checked={selected === preset.id} aria-describedby="preset-pending" onChange={() => controller.selectPreset(preset.id)} /> {preset.name}</label>
      ))}
      <p id="preset-pending">{pending.presetId ? `${PRESETS[pending.presetId].name} at the next phrase` : ''}</p>
    </fieldset>
  )
}
