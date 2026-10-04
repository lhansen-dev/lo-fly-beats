import type { ReactNode } from 'react'
import { WINDOW_PANES } from './rainLayout'

export default function Window({ children }: { children?: ReactNode }) {
  return (
    <g className="window">
      <defs>
        <clipPath id="scene-window-clip">
          {WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} />)}
        </clipPath>
      </defs>
      <rect x="110" y="70" width="590" height="470" style={{ fill: 'var(--scene-window-frame)' }} />
      {WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} style={{ fill: 'var(--scene-window-sky)' }} />)}
      {children}
      {WINDOW_PANES.map((pane, index) => <rect key={index} x={pane.x} y={pane.y} width={pane.width} height={pane.height} style={{ fill: 'var(--scene-glass-tint)' }} />)}
      <rect x="90" y="540" width="630" height="22" style={{ fill: 'var(--scene-window-frame)' }} />
      <rect x="90" y="562" width="630" height="4" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
    </g>
  )
}
