import type { Neuron } from '../../connectome/types'
import { describeAnatomy, positionLabel } from './anatomy'
import type { BodyPart } from './anatomy'

const legs = [
  { part: 'front', left: 'M66 66 40 47 27 19 11 13', right: 'M94 66 120 47 133 19 149 13' },
  { part: 'middle', left: 'M64 85 34 88 22 111 7 121', right: 'M96 85 126 88 138 111 153 121' },
  { part: 'hind', left: 'M68 106 42 125 35 161 16 178', right: 'M92 106 118 125 125 161 144 178' },
] as const

export default function FlyActivity({ neuron }: { neuron: Neuron | null | undefined }) {
  const location = neuron ? describeAnatomy(neuron) : null
  const partClass = (part: BodyPart, side?: 'L' | 'R') => `fly-body-part${location?.parts.includes(part) && (!side || !location.side || location.side === side) ? ' fly-body-part--active' : ''}`
  return <div className="fly-location" data-testid="fly-location" data-region={location?.label ?? ''}>
    <svg className="fly-body-map" viewBox="0 0 160 196" aria-hidden="true" data-testid="fly-body-map">
      <g className="fly-body-wings"><path className={partClass('wings', 'L')} d="M67 76C33 74 8 116 21 139 38 145 62 116 72 92Z" /><path className={partClass('wings', 'R')} d="M93 76C127 74 152 116 139 139 122 145 98 116 88 92Z" /><path d="M66 85 26 132M94 85 134 132" /></g>
      <path className={partClass('abdomen')} d="M64 109C55 129 64 161 80 176 96 161 105 129 96 109Z" />
      <path className="fly-body-segments" d="M61 126Q80 134 99 126M64 140Q80 147 96 140M69 155Q80 161 91 155" />
      <ellipse className={partClass('thorax')} cx="80" cy="85" rx="19" ry="31" />
      <g className="fly-body-legs">{legs.map(leg => <g key={leg.part}><path className={partClass(leg.part, 'L')} d={leg.left} data-body-part={`${leg.part}-L`} /><path className={partClass(leg.part, 'R')} d={leg.right} data-body-part={`${leg.part}-R`} /></g>)}</g>
      <path className={partClass('brain')} d="M56 37C56 21 104 21 104 37L96 53Q80 63 64 53Z" />
      <ellipse className={partClass('eyes', 'L')} cx="57" cy="39" rx="9" ry="14" transform="rotate(-15 57 39)" />
      <ellipse className={partClass('eyes', 'R')} cx="103" cy="39" rx="9" ry="14" transform="rotate(15 103 39)" />
      <path className={partClass('antennae', 'L')} d="M73 28 67 17 58 12M67 17 67 7" /><path className={partClass('antennae', 'R')} d="M87 28 93 17 102 12M93 17 93 7" />
      <g className="fly-body-cns"><path d="M80 44V147" /><path className={partClass('brain')} d="M67 40Q80 33 93 40Q80 50 67 40Z" /><circle className={partClass('thorax')} cx="80" cy="71" r="4" /><circle className={partClass('thorax')} cx="80" cy="87" r="4" /><circle className={partClass('thorax')} cx="80" cy="103" r="4" /><circle className={partClass('abdomen')} cx="80" cy="137" r="4" /></g>
      <text x="15" y="193">L</text><text x="140" y="193">R</text>
    </svg>
    <div className="fly-location-copy"><span className="detail-label">LOCATION IN THE FLY</span><p className="fly-region" data-testid="scan-region">{location?.label ?? 'Follow a neuron'}</p><p>{location?.detail ?? 'The selected circuit lights up here as the music moves.'}</p><span className="position-kind" data-testid="scan-position-kind">{neuron ? positionLabel(neuron) : 'Body map linked to source annotations'}</span></div>
  </div>
}
