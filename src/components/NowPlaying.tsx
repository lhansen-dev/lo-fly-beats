import { useAppState } from '../app/store'
import { getPreset } from '../presets/presets'
import { seedHex } from '../music/streams'

export default function NowPlaying() {
  const active = useAppState(state => state.active)
  return <p data-testid="now-playing">Now playing: No Thoughts, Only Fruit · {getPreset(active.presetId).name} · seed <span data-testid="seed-hex">{seedHex(active.sessionSeed)}</span></p>
}
