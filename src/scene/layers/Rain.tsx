import { RAIN_DROPS, RAIN_STREAKS } from './rainLayout'

export default function Rain() {
  return (
    <g className="rain" clipPath="url(#scene-window-clip)">
      {RAIN_STREAKS.map((streak, index) => (
        <line
          key={index}
          className="rain-streak"
          x1={streak.x}
          y1={streak.y}
          x2={streak.x + streak.slant}
          y2={streak.y + streak.length}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ stroke: 'var(--scene-rain)' }}
        />
      ))}
      {RAIN_DROPS.map((drop, index) => (
        <circle
          key={index}
          className="rain-drop"
          cx={drop.cx}
          cy={drop.cy}
          r={drop.r}
          style={{ fill: 'var(--scene-rain)' }}
        />
      ))}
    </g>
  )
}
