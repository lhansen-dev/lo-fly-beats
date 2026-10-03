import { useController } from '../app/ControllerContext'

export default function NewBeatButton() {
  const controller = useController()
  return <button type="button" data-testid="new-beat" onClick={() => controller.newBeat()}>New beat</button>
}
