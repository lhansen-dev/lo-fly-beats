
export default function Lighting() {
  return (
    <>
      <g className="lamp">
        <defs><radialGradient id="lamp-halo"><stop style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0.22" /><stop offset="1" style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="1385" cy="315" rx="265" ry="215" fill="url(#lamp-halo)" />
        <ellipse cx="1400" cy="594" rx="72" ry="10" style={{ fill: 'var(--scene-lamp)' }} />
        <path d="M 1390 594 L 1375 345 L 1428 220" fill="none" strokeWidth="14" strokeLinecap="round" style={{ stroke: 'var(--scene-lamp)' }} />
        <path d="M 1393 593 L 1380 346 M 1375 345 L 1428 220" fill="none" strokeWidth="4" strokeLinecap="round" style={{ stroke: 'var(--scene-lamp-shade)' }} />
        <path d="M 1378 214 L 1478 240 L 1450 300 L 1353 273 Z" style={{ fill: 'var(--scene-lamp-shade)' }} />
      </g>
      <g className="lighting">
        <ellipse cx="1384" cy="272" rx="42" ry="8" transform="rotate(15 1384 272)" style={{ fill: 'var(--scene-warm)' }} opacity="0.9" />
        <defs>
          <radialGradient id="scene-light-glow" cx="88%" cy="32%" r="55%">
            <stop offset="0%" style={{ stopColor: 'var(--scene-light-color)', stopOpacity: 'var(--scene-light-opacity)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--scene-light-color)', stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id="scene-light-cone-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--scene-light-color)', stopOpacity: 'var(--scene-light-opacity)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--scene-light-color)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path className="light-cone" d="M 1375 275 L 1290 640 L 700 640 Z" fill="url(#scene-light-cone-gradient)" />
        <rect className="light-overlay" x="0" y="0" width="1600" height="900" fill="url(#scene-light-glow)" />
      </g>
    </>
  )
}
