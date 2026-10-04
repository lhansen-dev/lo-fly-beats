import { useAppState } from '../app/store'
import { TRACK_TITLE } from '../app/copy'
import { getPreset } from '../presets/presets'
import { seedHex } from '../music/streams'

export default function NowPlaying() {
  const active = useAppState(state => state.active)
  return <p data-testid="now-playing">Now playing: {TRACK_TITLE} · {getPreset(active.presetId).name} · seed <span data-testid="seed-hex">{seedHex(active.sessionSeed)}</span></p>
}
