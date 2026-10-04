import { selectJoke } from '../app/jokes'
import { useAppState } from '../app/store'

export default function StatusJoke() {
  const score = useAppState(state => state.activeScore)
  const joke = score ? selectJoke(score.sessionSeed, score.phraseIndex) : null
  return joke === null ? null : <p data-testid="status-joke" className="status-joke">{joke}</p>
}
