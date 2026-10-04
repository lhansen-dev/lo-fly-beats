import { useAppState } from '../app/store'
import { TRACK_TITLE } from '../app/copy'
import { getPreset } from '../presets/presets'
import { seedHex } from '../music/streams'

export default function NowPlaying() {
  const active = useAppState(state => state.active)
  const preset = getPreset(active.presetId)
  return <div className="now-playing" data-testid="now-playing"><div><p className="eyebrow">ON THE TURNTABLE</p><h2>{TRACK_TITLE}</h2><p className="track-meta">{preset.name}<span>·</span>{preset.keyName}<span>·</span>{active.tempoBpm} BPM</p></div><div className="seed-tag"><span>SEED</span><span data-testid="seed-hex">{seedHex(active.sessionSeed)}</span></div></div>
}
