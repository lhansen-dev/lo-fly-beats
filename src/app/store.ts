import { useSyncExternalStore } from 'react'
import type { AppAction, AppState } from './state'
import { appReducer, createInitialState } from './state'

export interface Store<S, A> {
  getState(): S
  dispatch(action: A): void
  subscribe(listener: () => void): () => void
}

export function createStore<S, A>(reducer: (state: S, action: A) => S, initialState: S): Store<S, A> {
  let current = initialState
  const listeners = new Set<() => void>()

  return {
    getState: () => current,
    dispatch: (action) => {
      const next = reducer(current, action)
      if (next === current) return
      current = next
      for (const listener of Array.from(listeners)) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type AppStore = Store<AppState, AppAction>

let appStore: AppStore | undefined

export function createAppStore(initialState: AppState = createInitialState(null)): AppStore {
  appStore = createStore(appReducer, initialState)
  return appStore
}

export function getAppStore(): AppStore {
  return appStore ?? createAppStore()
}

export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = getAppStore()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()))
}
