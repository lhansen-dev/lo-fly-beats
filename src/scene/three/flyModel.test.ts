import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createFly } from './flyModel'
import { batchMeshes, disposeObjects } from './geometry'

describe('3D fly', () => {
  it('has six separate jointed legs, two veined wings and two compound eyes', () => {
    const fly = createFly()
    const legs = fly.root.children.filter(object => /^(foreleg|midleg|hindleg)-/.test(object.name))
    expect(legs).toHaveLength(6)
    for (const leg of legs) expect(leg.children.filter(object => object instanceof THREE.Mesh).length).toBeGreaterThanOrEqual(4)
    expect(fly.wings).toHaveLength(2)
    for (const wing of fly.wings) {
      expect(wing.getObjectByName('wing-membrane')).toBeInstanceOf(THREE.Mesh)
      expect(wing.children.length).toBeGreaterThan(1)
    }
    const eyes = fly.head.children.filter(object => object.name.startsWith('compound-eye-'))
    expect(eyes).toHaveLength(2)
    expect(fly.head.getObjectByName('proboscis')).toBeDefined()
    const bounds = new THREE.Box3().setFromObject(fly.root, true)
    // The curved headphone cable can dip slightly below the model's origin.
    expect(bounds.min.y).toBeGreaterThan(-0.05)
    expect(bounds.max.y).toBeLessThan(1.7)
    expect(bounds.isEmpty()).toBe(false)
    disposeObjects(fly.root)
  })

  it('disposes shared eye and leg materials once when the scene unmounts', () => {
    const fly = createFly()
    const materials = new Set<THREE.Material>()
    const geometries = new Set<THREE.BufferGeometry>()
    fly.root.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return
      geometries.add(object.geometry)
      for (const surface of Array.isArray(object.material) ? object.material : [object.material]) materials.add(surface)
    })
    const spies = [...materials, ...geometries].map(resource => vi.spyOn(resource, 'dispose'))
    disposeObjects(fly.root)
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
  })

  it('batches geometry without changing the fly shape or its movable joints', () => {
    const fly = createFly()
    fly.head.rotation.x = 0.12
    fly.forelegs[0].rotation.y = 0.08
    const before = new THREE.Box3().setFromObject(fly.root, true)
    let countBefore = 0
    fly.root.traverse(object => { if (object instanceof THREE.Mesh) countBefore++ })
    batchMeshes(fly.root)
    const after = new THREE.Box3().setFromObject(fly.root, true)
    let countAfter = 0
    fly.root.traverse(object => { if (object instanceof THREE.Mesh) countAfter++ })
    expect(countAfter).toBeLessThan(countBefore * 0.75)
    expect(before.min.distanceTo(after.min)).toBeLessThan(0.00001)
    expect(before.max.distanceTo(after.max)).toBeLessThan(0.00001)
    expect(fly.head.parent).toBe(fly.body)
    for (const leg of fly.forelegs) expect(leg.parent).toBe(fly.root)
    disposeObjects(fly.root)
  })
})
