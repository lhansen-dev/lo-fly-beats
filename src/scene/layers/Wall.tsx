export default function Wall() {
  return <g className="wall">
    <defs>
      <linearGradient id="wall-depth" x1="0" x2="1" y1="0" y2="1"><stop style={{ stopColor: 'var(--scene-night)' }} stopOpacity="0.7" /><stop offset="0.6" style={{ stopColor: 'var(--scene-shadow)' }} stopOpacity="0.14" /><stop offset="1" style={{ stopColor: 'var(--scene-shadow)' }} stopOpacity="0.48" /></linearGradient>
      <radialGradient id="wall-warmth" cx="80%" cy="35%" r="60%"><stop style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0.19" /><stop offset="1" style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0" /></radialGradient>
      <pattern id="wall-texture" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.6" style={{ fill: 'var(--scene-paper)' }} opacity="0.12" /></pattern>
    </defs>
    <rect className="wall-base" width="1600" height="900" style={{ fill: 'var(--scene-wall)' }} />
    <rect width="1600" height="900" fill="url(#wall-depth)" />
    <rect width="1600" height="900" fill="url(#wall-warmth)" />
    <rect width="1600" height="900" fill="url(#wall-texture)" />
    <path d="M 0 578 H 1600 M 770 0 V 578 M 1535 0 V 578" fill="none" strokeWidth="3" style={{ stroke: 'var(--scene-shadow)' }} opacity="0.12" />
    <path d="M 0 583 H 1600" fill="none" strokeWidth="2" style={{ stroke: 'var(--scene-paper)' }} opacity="0.1" />
  </g>
}
