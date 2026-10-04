import { useController } from '../app/ControllerContext'
import { useAppState } from '../app/store'

export default function NewBeatButton() {
  const controller = useController()
  const seed = useAppState(state => state.pending.sessionSeed)
  return <div><button type="button" data-testid="new-beat" aria-describedby="new-beat-pending" onClick={() => controller.newBeat()}>New beat</button><span id="new-beat-pending">{seed !== undefined ? ' New beat at the next phrase' : ''}</span></div>
}
