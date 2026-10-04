import Wall from './layers/Wall'
import Window from './layers/Window'
import Rain from './layers/Rain'
import Lighting from './layers/Lighting'
import Desk from './layers/Desk'
import Banana from './layers/Banana'
import Fly from './fly/Fly'
import './scene.css'

export default function Scene({ preserveAspectRatio = 'xMidYMid slice' }: { preserveAspectRatio?: string }) {
  return (
    <svg className="scene" viewBox="0 0 1600 900" preserveAspectRatio={preserveAspectRatio} role="img" aria-labelledby="scene-title scene-desc">
      <title id="scene-title">A fruit fly studying beside a banana</title>
      <desc id="scene-desc">A fruit fly in a hoodie and headphones studies its homework at a desk beside an overripe banana while rain runs down the window behind it.</desc>
      <Wall />
      <Window><Rain /></Window>
      <Lighting />
      <Desk />
      <Fly />
      <Banana />
    </svg>
  )
}
