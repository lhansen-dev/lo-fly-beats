import { useMediaQuery } from '../app/useMediaQuery'
import { sceneCrop, WIDE_SCENE_QUERY } from './crop'

export default function SceneFrame({ wide }: { wide?: boolean }) {
  const matches = useMediaQuery(WIDE_SCENE_QUERY)
  const crop = sceneCrop(wide ?? matches)

  return (
    <div className="scene-frame" data-testid="scene-frame" style={{ aspectRatio: crop.aspectRatio }}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio={crop.preserveAspectRatio} role="img" aria-labelledby="scene-title scene-desc">
        <title id="scene-title">A fruit fly studying beside a banana</title>
        <desc id="scene-desc">A placeholder of colored blocks for the wall, window, desk, homework, fly, and banana.</desc>
        <rect x="0" y="0" width="1600" height="900" style={{ fill: 'var(--scene-wall)' }} />
        <rect x="110" y="70" width="590" height="470" style={{ fill: 'var(--scene-window-sky)' }} />
        <rect x="110" y="70" width="590" height="470" style={{ fill: 'var(--scene-glass-tint)' }} />
        <rect x="0" y="600" width="1600" height="300" style={{ fill: 'var(--scene-desk)' }} />
        <rect x="0" y="860" width="1600" height="40" style={{ fill: 'var(--scene-desk-edge)' }} />
        <rect x="0" y="0" width="1600" height="900" style={{ fill: 'var(--scene-light-color)', opacity: 'var(--scene-light-opacity)' }} />
        <rect x="700" y="640" width="350" height="140" style={{ fill: '#efe8d8' }} />
        <rect x="820" y="250" width="440" height="470" style={{ fill: '#2b2b2b' }} />
        <rect x="1180" y="780" width="360" height="20" style={{ fill: '#000', opacity: 'var(--scene-shadow-opacity)' }} />
        <rect x="1180" y="640" width="360" height="160" style={{ fill: '#e8c547' }} />
      </svg>
    </div>
  )
}
