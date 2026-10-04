export default function Wall() {
  return (
    <g className="wall">
      <rect className="wall-base" x="0" y="0" width="1600" height="900" style={{ fill: 'var(--scene-wall)' }} />
      {Array.from({ length: 20 }, (_, index) => (
        <rect key={index} x={index * 80} y="0" width="30" height="900" style={{ fill: 'var(--scene-stripe)' }} />
      ))}
    </g>
  )
}
