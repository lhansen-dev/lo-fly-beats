import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import { PRESETS } from '../presets/presets'

export default function PresetPicker() {
  const controller = useController()
  const { active, pending } = useAppState(state => ({ active: state.active, pending: state.pending }))
  const selected = pending.presetId ?? active.presetId

  return (
    <fieldset>
      <legend>Preset</legend>
      {Object.values(PRESETS).map(preset => (
        <label key={preset.id}><input type="radio" name="preset" data-testid={`preset-${preset.id}`} value={preset.id} checked={selected === preset.id} onChange={() => controller.selectPreset(preset.id)} /> {preset.name}</label>
      ))}
    </fieldset>
  )
}
