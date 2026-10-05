import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'

export default function LearningLab() {
  const controller = useController()
  const learning = useAppState(state => state.learning)
  const score = useAppState(state => state.activeScore)
  const busy = !learning || learning.status === 'loading' || learning.status === 'teaching' || learning.status === 'pending'
  return <section aria-labelledby="learning-lab-title" data-testid="learning-lab">
    <h2 id="learning-lab-title">MBON motif experiment</h2>
    <p>The player uses the fixed MBON reservoir for bass decisions and the whole CNS traversal for accompaniment. Teach the original two-bar motif while listening; the decoder changes at a prepared phrase boundary.</p>
    <button type="button" disabled={busy || learning?.status === 'error'} onClick={() => controller.teachMotif()}>Teach motif</button>{' '}
    <button type="button" disabled={!learning || !['teaching', 'pending'].includes(learning.status)} onClick={() => controller.cancelTeaching()}>Cancel teaching</button>
    <p role="status" data-testid="learning-status">{learning?.message ?? 'Loading the learning experiment…'}</p>
    <p role="status" data-testid="learning-checkpoint">{learning?.checkpoint}</p>
    <p data-testid="learning-counters">Model revision: {learning?.modelRevision ?? 0}. Accepted training updates: {learning?.trainingUpdateCount ?? 0}. Generation: {learning?.generationIndex ?? 0}.</p>
    <p>Pause, resume, mixer changes, and WAV export preserve learned parameters. Reload recovers a committed phrase with playback paused. Internal connections remain fixed; this experiment has not established an advantage from fly wiring.</p>
    {score?.learning && <ol aria-label="Reservoir decoder bass decisions">{score.learning.bassDecisions.map(decision => <li key={decision.beat}>
      Bar {Math.floor(decision.beat / 4) + 1}, beat {decision.beat % 4 + 1}: {decision.cellId}{decision.forcedRest ? ' (traversal-forced silence)' : ''}
    </li>)}</ol>}
  </section>
}
