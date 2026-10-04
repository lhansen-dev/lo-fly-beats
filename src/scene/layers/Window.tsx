import type { ReactNode } from 'react'
import { WINDOW_PANES } from './rainLayout'

const buildings = [
  { x: 120, width: 55, top: 310 }, { x: 175, width: 78, top: 255 }, { x: 250, width: 55, top: 335 },
  { x: 307, width: 62, top: 285 }, { x: 370, width: 75, top: 340 }, { x: 450, width: 57, top: 240 },
  { x: 510, width: 86, top: 302 }, { x: 598, width: 78, top: 276 },
]

export default function Window({ children }: { children?: ReactNode }) {
  return <g className="window">
    <defs>
      <clipPath id="scene-window-clip">{WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} />)}</clipPath>
      <linearGradient id="window-night" x1="0" x2="0" y1="0" y2="1"><stop style={{ stopColor: 'var(--scene-night)' }} stopOpacity="0.35" /><stop offset="1" style={{ stopColor: 'var(--scene-night)' }} stopOpacity="0.85" /></linearGradient>
      <radialGradient id="window-moon"><stop style={{ stopColor: 'var(--scene-paper)' }} stopOpacity="0.24" /><stop offset="1" style={{ stopColor: 'var(--scene-paper)' }} stopOpacity="0" /></radialGradient>
    </defs>
    <rect x="96" y="55" width="620" height="500" rx="8" style={{ fill: 'var(--scene-shadow)' }} opacity="0.22" />
    <rect x="110" y="70" width="590" height="470" rx="5" style={{ fill: 'var(--scene-window-frame)' }} />
    {WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} style={{ fill: 'var(--scene-window-sky)' }} />)}
    <g clipPath="url(#scene-window-clip)">
      <rect className="sky-depth" x="130" y="90" width="550" height="430" fill="url(#window-night)" />
      <circle cx="570" cy="173" r="110" fill="url(#window-moon)" /><circle cx="570" cy="173" r="26" style={{ fill: 'var(--scene-paper)' }} opacity="0.66" />
      <path d="M 130 300 Q 220 220 290 290 T 450 285 T 680 310 V 530 H 130 Z" style={{ fill: 'var(--scene-city)' }} opacity="0.35" />
      {buildings.map((building, i) => <g key={i}>
        <rect x={building.x} y={building.top} width={building.width} height={540 - building.top} style={{ fill: 'var(--scene-city)' }} />
        <path d={`M ${building.x + 8} ${building.top} V ${building.top - 8} H ${building.x + building.width - 7} V ${building.top}`} style={{ fill: 'var(--scene-city)' }} />
        {Array.from({ length: 15 }, (_, j) => <rect key={j} x={building.x + 10 + j % 3 * 15} y={building.top + 15 + Math.floor(j / 3) * 25} width="5" height="9" style={{ fill: 'var(--scene-city-light)' }} opacity={(i * 7 + j * 3) % 5 < 2 ? 0.55 : 0.08} />)}
      </g>)}
      <path d="M 130 465 H 215 V 405 H 275 V 449 H 340 V 420 H 400 V 472 H 460 V 438 H 530 V 460 H 610 V 415 H 680 V 540 H 130 Z" style={{ fill: 'var(--scene-city-near)' }} />
      <path d="M 145 493 H 665" style={{ stroke: 'var(--scene-city-light)' }} strokeWidth="2" opacity="0.18" />
    </g>
    {children}
    {WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} style={{ fill: 'var(--scene-glass-tint)' }} />)}
    <g clipPath="url(#scene-window-clip)" fill="none" style={{ stroke: 'var(--scene-paper)' }} opacity="0.07" strokeWidth="22"><path d="M 130 270 L 430 70 M 370 550 L 710 300" /></g>
    <path d="M 112 72 H 698 M 112 72 V 540 M 398 90 V 522 M 415 90 V 522 M 130 296 H 680" fill="none" style={{ stroke: 'var(--scene-paper)' }} opacity="0.12" strokeWidth="3" />
    <rect x="90" y="540" width="630" height="22" rx="3" style={{ fill: 'var(--scene-window-frame)' }} />
    <rect x="90" y="540" width="630" height="3" style={{ fill: 'var(--scene-paper)' }} opacity="0.12" />
    <rect x="90" y="562" width="630" height="4" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
  </g>
}
