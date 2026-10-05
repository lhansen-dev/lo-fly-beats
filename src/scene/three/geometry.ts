import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type Point = readonly [number, number, number]

export function material(color: THREE.ColorRepresentation, roughness = 0.65, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material, position: Point = [0, 0, 0]): THREE.Mesh {
  const object = new THREE.Mesh(geometry, surface)
  object.position.set(...position)
  object.castShadow = true
  object.receiveShadow = true
  parent.add(object)
  return object
}

export function ellipsoid(parent: THREE.Object3D, surface: THREE.Material, position: Point, scale: Point, segments = 24): THREE.Mesh {
  const object = mesh(parent, new THREE.SphereGeometry(1, segments, 16), surface, position)
  object.scale.set(...scale)
  return object
}

export function box(parent: THREE.Object3D, surface: THREE.Material, position: Point, size: Point): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position)
}

export function segment(parent: THREE.Object3D, surface: THREE.Material, start: Point, end: Point, radius: number, tipRadius = radius): THREE.Mesh {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  const direction = b.clone().sub(a)
  const object = mesh(parent, new THREE.CylinderGeometry(tipRadius, radius, direction.length(), 8), surface)
  object.position.copy(a.add(b).multiplyScalar(0.5))
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return object
}

export function tube(parent: THREE.Object3D, surface: THREE.Material, points: readonly Point[], radius: number, segments = 40): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)))
  return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 8, false), surface)
}

/** Batch static pieces within each animated group to reduce GPU draw calls. */
export function batchMeshes(root: THREE.Object3D): void {
  for (const child of [...root.children]) if (!(child instanceof THREE.Mesh)) batchMeshes(child)
  const batches = new Map<THREE.Material, THREE.Mesh[]>()
  for (const child of root.children) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) continue
    const batch = batches.get(child.material) ?? []
    batch.push(child)
    batches.set(child.material, batch)
  }
  for (const [surface, objects] of batches) {
    if (objects.length < 2) continue
    const geometries = objects.map(object => {
      object.updateMatrix()
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      return geometry.applyMatrix4(object.matrix)
    })
    const combined = mergeGeometries(geometries)
    for (const geometry of geometries) geometry.dispose()
    if (!combined) continue
    const batched = new THREE.Mesh(combined, surface)
    batched.name = objects.map(object => object.name).filter(Boolean).join('+')
    batched.castShadow = objects.some(object => object.castShadow)
    batched.receiveShadow = objects.some(object => object.receiveShadow)
    root.add(batched)
    for (const object of objects) { root.remove(object); object.geometry.dispose() }
  }
}

/** Release shared geometry, materials, and textures only once. */
export function disposeObjects(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return
    geometries.add(object.geometry)
    for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(surface)
      for (const value of Object.values(surface)) if (value instanceof THREE.Texture) textures.add(value)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const texture of textures) texture.dispose()
  for (const surface of materials) surface.dispose()
}
