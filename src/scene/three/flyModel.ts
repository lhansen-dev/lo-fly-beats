import * as THREE from 'three'
import { ellipsoid, material, mesh, segment, tube } from './geometry'
import type { Point } from './geometry'

export interface FlyModel {
  root: THREE.Group
  body: THREE.Group
  head: THREE.Group
  wings: THREE.Group[]
  forelegs: THREE.Group[]
}

function compoundEye(parent: THREE.Group, side: number, surface: THREE.MeshPhysicalMaterial): void {
  const center: Point = [side * 0.335, 0.015, 0.22]
  const scale: Point = [0.235, 0.3, 0.245]
  ellipsoid(parent, surface, center, scale, 32).name = `compound-eye-${side < 0 ? 'left' : 'right'}`
  const facets = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), surface, 528)
  const dummy = new THREE.Object3D()
  let index = 0
  for (let row = 0; row < 22; row++) {
    const latitude = (row + 0.5) / 22 * Math.PI
    for (let column = 0; column < 24; column++) {
      const longitude = (column + (row % 2) * 0.5) / 24 * Math.PI * 2
      const normal = new THREE.Vector3(Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude))
      dummy.position.set(center[0] + normal.x * scale[0], center[1] + normal.y * scale[1], center[2] + normal.z * scale[2])
      dummy.scale.set(0.016, 0.016, 0.003)
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      dummy.updateMatrix()
      facets.setMatrixAt(index++, dummy.matrix)
    }
  }
  facets.name = 'eye-facets'
  parent.add(facets)
}

function wing(parent: THREE.Group, side: number): THREE.Group {
  const group = new THREE.Group()
  group.name = `wing-${side < 0 ? 'left' : 'right'}`
  group.position.set(side * 0.18, 1.16, -0.05)
  group.rotation.set(-0.14, side * -0.42, side * 0.1)
  const outline = new THREE.Shape()
  outline.moveTo(0, 0)
  outline.bezierCurveTo(side * 0.15, -0.15, side * 0.58, -0.55, side * 0.54, -1.03)
  outline.bezierCurveTo(side * 0.53, -1.42, side * 0.23, -1.56, side * 0.09, -1.18)
  outline.bezierCurveTo(side * -0.03, -0.82, side * -0.08, -0.2, 0, 0)
  const surface = new THREE.MeshPhysicalMaterial({ color: '#bbc6c1', transparent: true, opacity: 0.3, roughness: 0.22, metalness: 0.12, side: THREE.DoubleSide, depthWrite: false })
  const membrane = mesh(group, new THREE.ShapeGeometry(outline, 24), surface)
  membrane.rotation.x = Math.PI / 2
  membrane.castShadow = false
  membrane.name = 'wing-membrane'
  const vein = material('#616c61', 0.85)
  const paths: Point[][] = [
    [[0, 0, 0], [side * 0.15, 0.006, -0.32], [side * 0.34, 0.006, -0.75], [side * 0.31, 0.006, -1.31]],
    [[side * 0.08, 0.006, -0.25], [side * 0.1, 0.006, -0.6], [side * 0.13, 0.006, -1.16]],
    [[side * 0.17, 0.006, -0.4], [side * 0.36, 0.006, -0.51], [side * 0.48, 0.006, -0.83]],
    [[side * 0.11, 0.006, -0.66], [side * 0.3, 0.006, -0.73], [side * 0.48, 0.006, -0.99]],
  ]
  for (const points of paths) tube(group, vein, points, 0.004, 16).castShadow = false
  parent.add(group)
  return group
}

export function createFly(): FlyModel {
  const root = new THREE.Group()
  root.name = 'fly'
  const body = new THREE.Group()
  body.name = 'fly-body'
  root.add(body)
  const chitin = material('#29251e', 0.48, 0.12)
  const headShell = material('#353026', 0.56, 0.05)
  const legShell = material('#716b4d', 0.72)
  const joint = material('#353025', 0.65)
  const eye = new THREE.MeshPhysicalMaterial({ color: '#7d160c', roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.4 })

  const abdomen = ellipsoid(body, chitin, [0, 0.78, -0.64], [0.36, 0.34, 0.66])
  abdomen.name = 'abdomen'
  abdomen.rotation.x = -0.2
  for (let i = 0; i < 5; i++) {
    const z = -0.31 - i * 0.18
    const radius = 0.32 * Math.sqrt(1 - ((z + 0.64) / 0.73) ** 2)
    const ring = mesh(body, new THREE.TorusGeometry(radius, 0.018, 5, 28), material(i % 2 ? '#3d3829' : '#50482d'), [0, 0.78 + (z + 0.64) * 0.2, z])
    ring.scale.y = 0.95
  }
  ellipsoid(body, chitin, [0, 0.93, -0.03], [0.405, 0.435, 0.5]).name = 'thorax'
  ellipsoid(body, material('#4c4532', 0.68), [0, 1.15, -0.04], [0.27, 0.21, 0.38])

  const head = new THREE.Group()
  head.name = 'fly-head'
  head.position.set(0, 0.91, 0.46)
  body.add(head)
  ellipsoid(head, headShell, [0, 0, 0.11], [0.405, 0.335, 0.34])
  compoundEye(head, -1, eye)
  compoundEye(head, 1, eye)
  ellipsoid(head, material('#77684e'), [0, -0.11, 0.4], [0.07, 0.12, 0.06])
  for (const side of [-1, 1]) {
    ellipsoid(head, legShell, [side * 0.075, 0.03, 0.43], [0.035, 0.065, 0.038])
    segment(head, joint, [side * 0.07, 0.07, 0.45], [side * 0.22, 0.18, 0.53], 0.009, 0.004)
    for (let i = 0; i < 5; i++) {
      const x = side * (0.14 + i * 0.017)
      segment(head, joint, [x, 0.125 + i * 0.011, 0.49], [x + side * 0.04, 0.21 + i * 0.016, 0.52], 0.003, 0.001)
    }
    segment(head, joint, [side * 0.1, -0.24, 0.29], [side * 0.13, -0.34, 0.4], 0.009, 0.003)
  }
  segment(head, headShell, [0, -0.2, 0.32], [0, -0.36, 0.44], 0.043, 0.022).name = 'proboscis'

  const bristlePositions: number[] = []
  for (let i = 0; i < 130; i++) {
    const angle = i * 2.399963
    const height = 1 - 2 * (i + 0.5) / 130
    const radius = Math.sqrt(1 - height * height)
    const n = new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
    if (n.y < -0.3) continue
    const start = new THREE.Vector3(n.x * 0.405, 0.93 + n.y * 0.435, -0.03 + n.z * 0.5)
    const end = start.clone().addScaledVector(n, 0.06 + (i % 4) * 0.015)
    bristlePositions.push(...start.toArray(), ...end.toArray())
  }
  const bristles = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bristlePositions, 3)), new THREE.LineBasicMaterial({ color: '#211e18', transparent: true, opacity: 0.8 }))
  bristles.name = 'bristles'
  body.add(bristles)

  const forelegs: THREE.Group[] = []
  for (const side of [-1, 1]) {
    for (let pair = 0; pair < 3; pair++) {
      const leg = new THREE.Group()
      leg.name = `${['foreleg', 'midleg', 'hindleg'][pair]}-${side < 0 ? 'left' : 'right'}`
      const z = 0.31 - pair * 0.32
      const knee: Point = [side * (0.57 + pair * 0.08), 0.51, z + (pair === 0 ? 0.38 : -0.12)]
      const ankle: Point = [side * (0.69 + pair * 0.12), 0.08, z + (pair === 0 ? 0.54 : -0.32)]
      const foot: Point = [side * (0.83 + pair * 0.14), 0.015, z + (pair === 0 ? 0.86 : -0.62)]
      segment(leg, joint, [side * 0.27, 0.8, z], knee, 0.04, 0.03)
      segment(leg, legShell, knee, ankle, 0.024, 0.014)
      segment(leg, joint, ankle, foot, 0.015, 0.006)
      ellipsoid(leg, joint, knee, [0.036, 0.036, 0.036], 12)
      for (let i = 1; i < 4; i++) {
        const t = i / 4
        const p = new THREE.Vector3(...ankle).lerp(new THREE.Vector3(...foot), t)
        segment(leg, joint, p.toArray() as [number, number, number], [p.x + side * 0.04, p.y + 0.035, p.z], 0.003, 0.001)
      }
      root.add(leg)
      if (pair === 0) forelegs.push(leg)
    }
  }
  const wings = [-1, 1].map(side => wing(body, side))

  const headphones = new THREE.Group()
  headphones.name = 'headphones'
  const headphoneShell = material('#21282a', 0.43, 0.3)
  const pad = material('#111818', 0.95)
  const bandPoints: Point[] = Array.from({ length: 17 }, (_, i) => {
    const angle = i / 16 * Math.PI
    return [Math.cos(angle) * 0.47, 0.13 + Math.sin(angle) * 0.32, -0.095]
  })
  tube(headphones, headphoneShell, bandPoints, 0.042)
  for (const side of [-1, 1]) {
    ellipsoid(headphones, pad, [side * 0.41, -0.035, -0.105], [0.07, 0.17, 0.145])
    ellipsoid(headphones, headphoneShell, [side * 0.47, -0.035, -0.105], [0.065, 0.15, 0.13])
    const trim = mesh(headphones, new THREE.TorusGeometry(0.1, 0.008, 6, 24), material('#969677', 0.38, 0.6), [side * 0.522, -0.035, -0.105])
    trim.rotation.y = Math.PI / 2
    trim.scale.y = 1.17
  }
  head.add(headphones)
  tube(root, material('#181d1d'), [[0.47, 0.88, 0.35], [0.64, 0.44, 0.04], [0.63, 0.022, -0.3], [1.17, 0.022, -0.76], [1.64, 0.022, -0.57], [1.88, 0.025, -1.25]], 0.011)
  return { root, body, head, wings, forelegs }
}
