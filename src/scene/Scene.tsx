import Wall from './layers/Wall'
import Window from './layers/Window'
import Rain from './layers/Rain'
import Lighting from './layers/Lighting'
import Desk from './layers/Desk'
import Banana from './layers/Banana'

export default function Scene({ preserveAspectRatio = 'xMidYMid slice' }: { preserveAspectRatio?: string }) {
  return (
    <svg className="scene" viewBox="0 0 1600 900" preserveAspectRatio={preserveAspectRatio} role="img" aria-labelledby="scene-title scene-desc">
      <title id="scene-title">A fruit fly studying beside a banana</title>
      <desc id="scene-desc">A fruit fly in a hoodie and headphones studies its homework at a desk beside an overripe banana while rain runs down the window behind it.</desc>
      <Wall />
      <Window><Rain /></Window>
      <Lighting />
      <Desk />
      {/* Phase 28 replaces this silhouette with src/scene/fly/Fly.tsx. */}
      <g className="fly">
        <ellipse cx="1040" cy="560" rx="92" ry="145" style={{ fill: 'var(--scene-fly-silhouette)' }} />
        <circle cx="1020" cy="360" r="82" style={{ fill: 'var(--scene-fly-silhouette)' }} />
        <circle cx="990" cy="345" r="24" style={{ fill: 'var(--scene-fly-silhouette)' }} />
        <circle cx="1050" cy="345" r="24" style={{ fill: 'var(--scene-fly-silhouette)' }} />
        <line x1="995" y1="285" x2="970" y2="250" strokeWidth="8" style={{ stroke: 'var(--scene-fly-silhouette)' }} />
        <line x1="1045" y1="285" x2="1070" y2="250" strokeWidth="8" style={{ stroke: 'var(--scene-fly-silhouette)' }} />
      </g>
      <Banana />
    </svg>
  )
}
