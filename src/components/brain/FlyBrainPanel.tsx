import { useState } from 'react'
import { useController } from '../../app/ControllerContext'
import { useAppState } from '../../app/store'
import type { BrainCheckpoint } from '../../brain/checkpoint'
import BrainView from './BrainView'

const PART_LABELS = { drums: 'Groove', bass: 'Bass', harmony: 'Chords', keys: 'Keys', lead: 'Melody', structure: 'Form' } as const

function LearningCurve({ history }: { history: BrainCheckpoint['history'] }) {
  if (history.length < 2) return null
  const width = 320
  const height = 74
  const points = history.map((point, index) => {
    const x = 6 + index / (history.length - 1) * (width - 12)
    const y = height - 8 - point.bananas / 10 * (height - 16)
    return { ...point, x, y }
  })
  const firstPractice = points.find(point => point.stage === 'practice')
  const firstListening = points.find(point => point.stage === 'listening')
  return <svg className="learning-curve" viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`Bananas per phrase over the fly's training, from ${points[0]!.bananas} to ${points.at(-1)!.bananas} out of 10.`}>
    <line x1="6" x2={width - 6} y1={height - 8 - 0.9 * (height - 16)} y2={height - 8 - 0.9 * (height - 16)} className="curve-guide" />
    {firstPractice && <line x1={firstPractice.x} x2={firstPractice.x} y1="4" y2={height - 4} className="curve-stage" />}
    {firstListening && <line x1={firstListening.x} x2={firstListening.x} y1="4" y2={height - 4} className="curve-stage" />}
    <polyline points={points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')} className="curve-line" />
    <text x="8" y="12" className="curve-label">school</text>
    {firstPractice && <text x={firstPractice.x + 4} y="12" className="curve-label">practice</text>}
    {firstListening && <text x={firstListening.x + 4} y="12" className="curve-label">with you</text>}
  </svg>
}

export default function FlyBrainPanel() {
  const controller = useController()
  const brain = useAppState(state => state.brain)
  const [forgetting, setForgetting] = useState(false)
  if (!brain) return null
  const experience = brain.experience?.experience
  const playing = brain.playing
  const given = playing !== null && brain.bananaGiven === playing.id
  return <section className="fly-brain" aria-labelledby="fly-brain-title" data-testid="fly-brain">
    <div className="fly-brain-heading">
      <div>
        <p className="eyebrow"><span className="status-dot" /> {brain.status === 'error' ? 'THE FLY IS RESTING' : 'NOW COMPOSING: THE FLY'}</p>
        <h2 id="fly-brain-title">Straight from his <span>little fly brain</span></h2>
        <p>Every kick, chord, bassline, and melody below is chosen by a simulated network built from this male fly's real ear-to-song wiring. He learned from a tutor, then practiced alone for bananas, and he keeps practicing while you listen.</p>
      </div>
    </div>
    <div className="fly-brain-layout">
      <BrainView />
      <div className="fly-brain-side">
        <p className="brain-status" role="status" data-testid="brain-status">{brain.message}</p>
        {playing && <div className="phrase-review" data-testid="phrase-review">
          <p className="detail-label">THIS PHRASE, BY HIS OWN CRITIC</p>
          <p className="phrase-bananas"><span data-testid="phrase-bananas">{playing.bananas.toFixed(1)}</span> / 10 bananas</p>
          <dl className="part-meters">{(Object.keys(PART_LABELS) as (keyof typeof PART_LABELS)[]).map(part => <div key={part}>
            <dt>{PART_LABELS[part]}</dt><dd><meter min={0} max={1} value={playing.parts[part]} aria-label={`${PART_LABELS[part]} ${Math.round(playing.parts[part] * 100)} percent`} /></dd>
          </div>)}</dl>
          {playing.notes.length > 0 && <p className="critic-notes">Self-critique: {playing.notes.join('; ')}.</p>}
        </div>}
        <button type="button" className="banana-button" data-testid="give-banana" disabled={!playing || given || brain.status === 'error'}
          onClick={() => controller.giveBanana()}>{given ? 'Banana received. He will lean into this.' : 'Give him a banana 🍌'}</button>
        {experience && <dl className="experience" data-testid="brain-experience">
          <div><dt>Tutor lessons</dt><dd>{experience.schoolLessons.toLocaleString()}</dd></div>
          <div><dt>Solo practice phrases</dt><dd>{experience.practicePhrases.toLocaleString()}</dd></div>
          <div><dt>Phrases played for you</dt><dd>{experience.listeningPhrases.toLocaleString()}</dd></div>
          <div><dt>Bananas from you</dt><dd>{experience.bananasFromListeners.toLocaleString()}</dd></div>
        </dl>}
        {brain.experience && <LearningCurve history={brain.experience.history} />}
        {brain.experience && (brain.experience.source === 'saved' || experience?.listeningPhrases) ? <p className="forget-row">
          {forgetting
            ? <><span>Forget what he practiced in this browser?</span> <button type="button" onClick={() => { void controller.forgetBrainPractice(); setForgetting(false) }}>Forget</button> <button type="button" onClick={() => setForgetting(false)}>Keep</button></>
            : <button type="button" className="text-button" onClick={() => setForgetting(true)}>Forget his practice here</button>}
        </p> : null}
      </div>
    </div>
  </section>
}
