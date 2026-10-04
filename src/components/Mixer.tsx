import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'
import type { Layer } from '../music/types'

const layers: { key: Layer; label: string }[] = [
  { key: 'drums', label: 'Drums' },
  { key: 'bass', label: 'Bass' },
  { key: 'keys', label: 'Keys' },
]

export default function Mixer() {
  const controller = useController()
  const mix = useAppState(state => state.mix)
  return <fieldset className="mixer">
    <legend>Mixer</legend>
    {layers.map(({ key, label }) => {
      const percentage = Math.round(mix.layers[key].level * 100)
      return <div className="mixer-channel" key={key}>
        <label htmlFor={`layer-${key}-level`}>{label}<span className="sr-only"> level</span></label>{' '}
        <input id={`layer-${key}-level`} data-testid={`layer-${key}-level`} type="range" min="0" max="100" step="1" value={percentage} aria-valuetext={`${label} level ${percentage} percent`} onChange={event => controller.setMix({ layers: { [key]: { level: Number(event.target.value) / 100 } } })} />{' '}
        <output htmlFor={`layer-${key}-level`} role="none">{percentage}%</output>{' '}
        <label className="mute-control" htmlFor={`layer-${key}-mute`}><span className="sr-only">{label} </span>mute <input id={`layer-${key}-mute`} data-testid={`layer-${key}-mute`} type="checkbox" checked={mix.layers[key].muted} onChange={event => controller.setMix({ layers: { [key]: { muted: event.target.checked } } })} /></label>
      </div>
    })}
    <div className="ambience-row"><span>Rain & vinyl texture</span><label htmlFor="ambience-toggle">Ambience <input id="ambience-toggle" data-testid="ambience-toggle" type="checkbox" checked={mix.ambienceOn} onChange={event => controller.setMix({ ambienceOn: event.target.checked })} /></label></div>
  </fieldset>
}
