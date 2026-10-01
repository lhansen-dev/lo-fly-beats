# Phase 19: app state store + settings persistence

Adds the shared app state that later player/mixer/export work will build on, as three new pure
TypeScript modules with no UI wiring:

- `src/app/state.ts` — the `AppState` shape from R12, `createInitialState(restoredSettings)`, the
  16-action `AppAction` union, and `appReducer`, which implements the immediate-vs-pending rules
  for tempo, variation, new-beat, and preset requests, plus `changesApplied` reconciliation.
- `src/app/store.ts` — a minimal `createStore(reducer, initialState)` (`getState`/`dispatch`/
  `subscribe`) and a `useAppState(selector)` hook on `useSyncExternalStore`, with a lazily-created
  app-wide singleton store.
- `src/app/persistence.ts` — `loadSettings(getStorage)` (zod-validated, `lofly:settings:v1`) and
  `createSettingsSaver(getStorage, delayMs = 500)` (debounced, with `flush`/`cancel` and
  once-only "storage unavailable" reporting), every storage access wrapped in `try/catch`.

Each module ships with unit tests (reducer tests for every action and the immediate/pending
rules; store tests for notify/unsubscribe/singleton behavior; persistence tests for in-memory
storage, invalid JSON, wrong shape, throwing storage, and debounced saves under
`vi.useFakeTimers()`). `docs/03-IMPLEMENT.md`'s five Phase 19 implementation task boxes are
ticked. Nothing in `src/app/App.tsx` was touched — wiring the store to the engine is Phase 20.
