import { useMemo } from 'react'
import { DEFAULT_SESSION_SEED } from '../../music/versions'
import { rainTimings } from '../cues'
import { RAIN_DROPS, RAIN_STREAKS } from './rainLayout'

export default function Rain({ sessionSeed = DEFAULT_SESSION_SEED }: { sessionSeed?: number }) {
  const timings = useMemo(() => rainTimings(sessionSeed, RAIN_STREAKS.length), [sessionSeed])
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
          style={{
            stroke: 'var(--scene-rain)',
            animationDelay: `${timings[index].delayMs}ms`,
            animationDuration: `${timings[index].durationMs}ms`,
          }}
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
