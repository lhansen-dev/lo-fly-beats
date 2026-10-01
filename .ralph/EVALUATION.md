VERDICT: approve

## What I verified

Ran every acceptance-criteria command myself from the repo root (not trusting `.ralph/DONE`):

- `src/app/state.ts` exports `createInitialState`, `appReducer`, `AppState` — pass.
- All 16 action-type string literals (`circuitLoading` … `storageUnavailable`) present in
  `src/app/state.ts` — pass.
- `src/app/store.ts` exports `createStore`, `useAppState`, and uses `useSyncExternalStore` — pass.
- `src/app/persistence.ts` uses key `lofly:settings:v1`, exports `loadSettings` and
  `createSettingsSaver`, imports from `'zod'`, and contains `catch` — pass.
- `npx vitest run --project unit src/app/state.test.ts` — 10/10 tests pass.
- `src/app/state.test.ts` contains `immediate`, `pending`, and `changesApplied` — pass.
- `npx vitest run --project unit src/app/store.test.ts` — 5/5 tests pass.
- `npx vitest run --project unit src/app/persistence.test.ts` — 9/9 tests pass.
- `src/app/persistence.test.ts` contains `useFakeTimers` and `SETTINGS_KEY` — pass.
- `docs/03-IMPLEMENT.md` has the Phase 19 `Create src/app/persistence.ts` box ticked — pass.
- Regression: `npx tsc -b` — exit 0. `npx oxlint` — 0 warnings/errors on 56 files. `App.tsx` does
  not reference `useAppState` (no UI wiring this phase) — confirmed. `src/audio/sequencer.test.ts`
  — 4/4 tests pass.
- Also ran the full `npm run check` (typecheck + lint + unit tests + data:validate + build) as the
  card's own Verify step: all green, 18 test files / 104 tests pass, build succeeds.

Beyond the scripted criteria I read `state.ts`/`store.ts`/`persistence.ts` in full against the R12
spec block in `docs/03-IMPLEMENT.md` (`AppState`, `RestoredSettings`-equivalent persistence value
shape, and the control-behavior table) — the `AppState` interface and action union match the spec
verbatim, and the reducer's immediate/pending/`changesApplied` logic matches the documented rules
field-for-field (tempo, variation, new-beat with position/score reset, preset with its tempo).
Cross-checked the zod schema's numeric ranges and the `mix` shape against `SessionRecipe`,
`MixSettings` (`src/audio/rig.ts`), and the three preset tempos (`src/presets/presets.ts`) — all
consistent. Confirmed `persistence.ts` never touches the global `localStorage` directly; every
access goes through the `getStorage()` accessor and every call site is inside `try/catch`, matching
"wrap every `localStorage` call" and leaving the real browser storage binding for Phase 20.
Diffed `main...HEAD` (excluding `.ralph/`) and found only the 7 expected files touched; the
`docs/03-IMPLEMENT.md` diff is exactly the five Phase 19 checkboxes flipping from `[ ]` to `[x]`
(the final "All verification steps pass" box is left unchecked, consistent with how Phases 17/18
were handled and left unchecked by the evaluator too — not part of this card's acceptance
criteria). No stray use of `useAppState`/`getAppStore`/`createAppStore` outside `store.ts` and its
tests, no leftover `console.log`/`debugger`/TODO markers, no changes outside the card's scope.

## Notes for the human reviewer

- `useAppState`'s `getSnapshot` calls `selector(store.getState())` fresh on every render with no
  memoization. That's harmless today because nothing consumes the hook yet, but once Phase 20
  wires it up, any selector that returns a new object/array each call (rather than a primitive or
  a stable reference) will trip React's "getSnapshot should be cached" warning or an infinite
  render loop under `useSyncExternalStore`'s consistency check. Worth a second look when the
  controller/components start calling `useAppState` with non-primitive selectors.
- `RestoredSettings`/the persisted value carries `mappingVersion`/`presetVersion`, but
  `createInitialState` never compares them against the app's current `MAPPING_VERSION` to decide
  whether to discard stale settings from an older mapping version — it only range/shape-validates
  via zod. The card's bullet list and R12's persistence text don't explicitly call for a version
  check in this phase, so I'm not treating it as a gap, but it's worth confirming Phase 20 (the
  session controller, which actually calls `loadSettings`) is expected to handle that, or that it's
  intentionally not needed.

## findings
```findings
[
  { "severity": "suggestion", "file": "src/app/store.ts", "line": 44, "issue": "useAppState's getSnapshot is not memoized across renders; fine while unused, but will need a stable-reference discipline (or memoized selector) once Phase 20 wires real components to it with non-primitive selectors." },
  { "severity": "suggestion", "file": "src/app/state.ts", "line": 55, "issue": "createInitialState ignores restored.mappingVersion/presetVersion — stored settings from an older musical mapping version are reused as-is rather than discarded, though this isn't explicitly required by the card." },
  { "severity": "suggestion", "file": "src/app/state.ts", "line": 150, "issue": "appReducer's switch has a `default: return state` fallback, so TypeScript's exhaustiveness checking won't flag a future AppAction variant that forgets a case." }
]
```
