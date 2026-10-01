import { describe, expect, it } from 'vitest'
import { createAppStore, createStore, getAppStore } from './store'
import { createInitialState } from './state'

describe('createStore', () => {
  it('keeps and updates its state', () => {
    const store = createStore((state: number, amount: number) => state + amount, 2)
    expect(store.getState()).toBe(2)
    store.dispatch(3)
    expect(store.getState()).toBe(5)
  })

  it('notifies subscribers on changes and stops after unsubscribe', () => {
    const store = createStore((state: number) => state + 1, 0)
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    store.dispatch(undefined)
    expect(calls).toBe(1)
    unsubscribe()
    unsubscribe()
    store.dispatch(undefined)
    expect(calls).toBe(1)
  })

  it('does not notify when the reducer returns the same state', () => {
    const state = { count: 0 }
    const store = createStore((current: typeof state) => current, state)
    let calls = 0
    store.subscribe(() => calls++)
    store.dispatch(undefined)
    expect(calls).toBe(0)
  })

  it('does not notify a listener added during notification until the next dispatch', () => {
    const store = createStore((state: number) => state + 1, 0)
    let lateCalls = 0
    store.subscribe(() => {
      store.subscribe(() => lateCalls++)
    })
    store.dispatch(undefined)
    expect(lateCalls).toBe(0)
  })
})

describe('app store', () => {
  it('installs the created store as the app singleton', () => {
    const store = createAppStore(createInitialState(null))
    expect(getAppStore()).toBe(store)
    expect(store.getState().engineStatus).toBe('idle')
    store.dispatch({ type: 'engineStatusChanged', status: 'playing' })
    expect(store.getState().engineStatus).toBe('playing')
  })
})
