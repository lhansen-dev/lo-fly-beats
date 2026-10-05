import * as THREE from 'three'
import { box, ellipsoid, material, mesh, segment } from './geometry'
import type { Point } from './geometry'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, width = 512, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function woodTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(ctx => {
    ctx.fillStyle = '#b4a28a'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 750; i++) {
      const y = i / 750 * 512
      ctx.strokeStyle = i % 5 === 0 ? '#5a483320' : '#efe1c113'
      ctx.lineWidth = i % 7 === 0 ? 1.6 : 0.6
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.012 + i * 0.37) * (2 + i % 5))
      ctx.stroke()
    }
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = '#49362123'
      ctx.fillRect(0, i * 128, 512, 1)
    }
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 3)
  return texture
}

function notebook(parent: THREE.Group): void {
  const group = new THREE.Group()
  group.name = 'notebook'
  group.position.set(-0.75, 0.028, 1.04)
  group.rotation.y = -0.16
  box(group, material('#3a4945'), [0, 0, 0], [2.55, 0.05, 1.64])
  box(group, material('#d6cfb5'), [0, 0.035, 0], [2.48, 0.04, 1.59])
  const paper = canvasTexture(ctx => {
    ctx.fillStyle = '#ede6d4'
    ctx.fillRect(0, 0, 1024, 512)
    ctx.strokeStyle = '#b3b7ad'
    ctx.lineWidth = 1
    for (let y = 82; y < 486; y += 29) {
      for (const start of [35, 551]) {
        ctx.beginPath(); ctx.moveTo(start, y); ctx.lineTo(start + 426, y); ctx.stroke()
      }
    }
    ctx.fillStyle = '#555c58'
    ctx.font = 'italic 25px Georgia'
    ctx.fillText('A small study in slowing down', 45, 53)
    ctx.font = 'italic 19px Georgia'
    ctx.fillText('notes, connections & other things', 558, 53)
    ctx.strokeStyle = '#686c605f'
    for (let row = 0; row < 10; row++) {
      for (const start of [47, 567]) {
        ctx.beginPath()
        ctx.moveTo(start, 106 + row * 29)
        for (let x = 0; x < 260 + row % 4 * 25; x += 5) ctx.lineTo(start + x, 106 + row * 29 + Math.sin(x * 0.63 + row) * 3 + Math.sin(x * 0.16) * 2)
        ctx.stroke()
      }
    }
    const gradient = ctx.createLinearGradient(485, 0, 539, 0)
    gradient.addColorStop(0, '#ede6d400'); gradient.addColorStop(0.5, '#5a514442'); gradient.addColorStop(1, '#ede6d400')
    ctx.fillStyle = gradient; ctx.fillRect(485, 0, 54, 512)
  }, 1024, 512)
  const page = mesh(group, new THREE.PlaneGeometry(2.47, 1.58), new THREE.MeshStandardMaterial({ map: paper, roughness: 1 }), [0, 0.06, 0])
  page.rotation.x = -Math.PI / 2
  const pencil = new THREE.Group()
  pencil.position.set(0.14, 0.11, 0.43)
  pencil.rotation.y = 0.22
  segment(pencil, material('#bd8743'), [-0.5, 0, 0], [0.56, 0, 0], 0.028)
  segment(pencil, material('#d1b894'), [-0.65, 0, 0], [-0.5, 0, 0], 0.001, 0.028)
  segment(pencil, material('#2a2923'), [-0.7, 0, 0], [-0.65, 0, 0], 0.001, 0.007)
  group.add(pencil)
  parent.add(group)
}

function banana(parent: THREE.Group): void {
  const group = new THREE.Group()
  group.name = 'banana'
  group.position.set(2.05, 0.05, 0.46)
  group.rotation.y = -0.25
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.8, 0.43, 0), new THREE.Vector3(-0.55, 0.25, 0),
    new THREE.Vector3(0, 0.18, 0), new THREE.Vector3(0.55, 0.35, 0), new THREE.Vector3(0.95, 0.76, 0),
  ])
  const texture = canvasTexture(ctx => {
    ctx.fillStyle = '#c5a34a'; ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 160; i++) {
      const x = (Math.sin(i * 43.13) * 0.5 + 0.5) * 512
      const y = (Math.cos(i * 17.79) * 0.5 + 0.5) * 512
      ctx.fillStyle = i % 3 ? '#5f46248f' : '#4c3828b3'
      ctx.beginPath(); ctx.ellipse(x, y, 1.5 + i % 6, 1 + i % 4, i, 0, Math.PI * 2); ctx.fill()
    }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#81652929'; ctx.fillRect(0, i * 102, 512, 2) }
  })
  const geometry = new THREE.TubeGeometry(curve, 48, 0.23, 10, false)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i <= 48; i++) {
    const t = i / 48
    const taper = 0.25 + 0.75 * Math.sin(Math.PI * t) ** 0.4
    const center = curve.getPointAt(t)
    for (let j = 0; j <= 10; j++) {
      const index = i * 11 + j
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).sub(center).multiplyScalar(taper).add(center)
      positions.setXYZ(index, point.x, point.y, point.z)
    }
  }
  geometry.computeVertexNormals()
  mesh(group, geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.84 }))
  segment(group, material('#51402a'), [0.95, 0.76, 0], [1.05, 0.97, -0.02], 0.075, 0.055)
  ellipsoid(group, material('#493723'), [-0.81, 0.44, 0], [0.066, 0.073, 0.065])
  parent.add(group)
}

function mug(parent: THREE.Group): void {
  const group = new THREE.Group()
  group.name = 'mug'
  group.position.set(-2.24, 0.025, -0.55)
  const ceramic = material('#8a6b52', 0.3)
  mesh(group, new THREE.CylinderGeometry(0.3, 0.25, 0.59, 32, 1, true), ceramic, [0, 0.31, 0])
  const rim = mesh(group, new THREE.TorusGeometry(0.289, 0.02, 8, 32), material('#b59b7d'), [0, 0.6, 0])
  rim.rotation.x = Math.PI / 2
  mesh(group, new THREE.CylinderGeometry(0.277, 0.277, 0.018, 32), material('#201b13', 0.2), [0, 0.555, 0])
  const handle = mesh(group, new THREE.TorusGeometry(0.19, 0.042, 10, 24), ceramic, [-0.31, 0.34, 0])
  handle.scale.x = 0.75
  parent.add(group)
}

function plant(parent: THREE.Group): void {
  const group = new THREE.Group()
  group.position.set(-3.45, 0.8, -2.95)
  const pot = material('#7e5740', 0.9)
  mesh(group, new THREE.CylinderGeometry(0.38, 0.27, 0.5, 24), pot, [0, 0.25, 0])
  mesh(group, new THREE.CylinderGeometry(0.35, 0.35, 0.02, 24), material('#30271c'), [0, 0.505, 0])
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.399963
    const height = 0.95 + (i % 3) * 0.24
    const end: Point = [Math.cos(angle) * 0.35, height, Math.sin(angle) * 0.29]
    segment(group, material('#526042'), [0, 0.46, 0], end, 0.015, 0.008)
    const leaf = ellipsoid(group, material(i % 2 ? '#526749' : '#6c7751', 0.85), end, [0.15, 0.32, 0.035])
    leaf.rotation.set(0.3, angle, -0.45 + i % 3 * 0.3)
  }
  parent.add(group)
}

function lamp(parent: THREE.Group): THREE.PointLight {
  const group = new THREE.Group()
  group.name = 'lamp'
  group.position.set(3.1, 0, -1.85)
  const metal = material('#333b35', 0.42, 0.4)
  mesh(group, new THREE.CylinderGeometry(0.46, 0.5, 0.09, 32), metal, [0, 0.045, 0])
  segment(group, metal, [0, 0.1, 0], [0, 1.92, 0], 0.035)
  mesh(group, new THREE.CylinderGeometry(0.35, 0.66, 0.57, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#67715a', roughness: 0.8, side: THREE.DoubleSide }), [0, 2.03, 0])
  const bulb = new THREE.MeshStandardMaterial({ color: '#ffe0a3', emissive: '#ffd498', emissiveIntensity: 1.7 })
  ellipsoid(group, bulb, [0, 1.87, 0], [0.13, 0.15, 0.13])
  const light = new THREE.PointLight('#ffd3a0', 9, 8, 2)
  light.position.set(0, 1.73, 0)
  group.add(light)
  parent.add(group)
  return light
}

export interface RoomModel {
  root: THREE.Group
  wall: THREE.MeshStandardMaterial
  desk: THREE.MeshStandardMaterial
  sky: THREE.MeshBasicMaterial
  windowLight: THREE.DirectionalLight
  lampLight: THREE.PointLight
  rain: THREE.LineSegments
  rainPositions: Float32Array
}

export function createRoom(): RoomModel {
  const root = new THREE.Group()
  root.name = 'room'
  const wall = material('#3b4a5a', 1)
  box(root, wall, [0, 3, -4], [24, 8, 0.16])
  const desk = new THREE.MeshStandardMaterial({ color: '#9a7e5d', map: woodTexture(), roughness: 0.82 })
  box(root, desk, [0, -0.14, 0], [20, 0.28, 12]).name = 'desk'
  const frame = material('#454c41', 0.8)
  const sky = new THREE.MeshBasicMaterial({ color: '#738e94' })
  box(root, sky, [-1.5, 2.75, -3.84], [6.3, 3.9, 0.04]).name = 'window-sky'
  for (const x of [-4.72, -1.5, 1.72]) box(root, frame, [x, 2.75, -3.66], [0.13, 4.1, 0.24])
  for (const y of [0.76, 2.65, 4.76]) box(root, frame, [-1.5, y, -3.66], [6.58, 0.13, 0.24])
  box(root, material('#727661'), [-1.5, 0.69, -3.52], [6.85, 0.16, 0.65])
  for (let i = 0; i < 7; i++) {
    const x = -4.05 + i * 0.8
    const height = 0.35 + (i * 7 % 9) * 0.09
    ellipsoid(root, material(i % 2 ? '#4c6250' : '#5d7460', 1), [x, 0.85 + height, -3.76], [0.59, height, 0.065], 16).castShadow = false
  }
  const glass = mesh(root, new THREE.PlaneGeometry(6.2, 3.8), new THREE.MeshPhysicalMaterial({ color: '#b4c5b5', transparent: true, opacity: 0.06, roughness: 0.2, metalness: 0.1 }), [-1.5, 2.75, -3.49])
  glass.castShadow = false
  const rainPositions = new Float32Array(65 * 6)
  const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)), new THREE.LineBasicMaterial({ color: '#d7e2da', transparent: true, opacity: 0.25 }))
  rain.name = 'rain'
  root.add(rain)
  notebook(root)
  banana(root)
  mug(root)
  plant(root)
  const lampLight = lamp(root)
  // A small analogue player and a stack of books anchor the back of the desk.
  box(root, material('#3d4943'), [0.75, 0.17, -2.7], [1.2, 0.34, 0.72])
  for (let i = 0; i < 2; i++) {
    const dial = mesh(root, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24), material('#949480', 0.35, 0.4), [0.38 + i * 0.67, 0.2, -2.325])
    dial.rotation.x = Math.PI / 2
  }
  box(root, material('#182925'), [0.75, 0.21, -2.328], [0.35, 0.09, 0.016])
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Group()
    book.position.set(-2.28, 0.07 + i * 0.13, -2.25)
    book.rotation.y = i * 0.1 - 0.2
    box(book, material(['#586452', '#886c50', '#515f61'][i]), [0, 0, 0], [1.07, 0.12, 0.66])
    box(book, material('#c5bea6'), [0.03, 0, 0.013], [1.03, 0.076, 0.62])
    root.add(book)
  }
  const windowLight = new THREE.DirectionalLight('#c7dfde', 1.7)
  windowLight.position.set(-3, 4, -2)
  root.add(windowLight)
  return { root, wall, desk, sky, windowLight, lampLight, rain, rainPositions }
}
