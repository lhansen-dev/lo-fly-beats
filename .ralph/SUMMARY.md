# Phase 21: the real player control UI

Replaces the throwaway audition page with the permanent player UI: eight new components
(`StartListening`, `TransportControls`, `TempoControl`, `VariationControl`, `NewBeatButton`,
`PresetPicker`, `NowPlaying`, `PendingChanges`) built from native `<label>`/`<input
type="range">`/`<output>`/`<fieldset>` controls, wired into a rebuilt `src/app/App.tsx` (header,
scene placeholder box, and the controls) with the old audition markup and handlers deleted. Adds
pure formatting helpers (`src/app/format.ts`), node-render tests for every component
(`src/components/controls.test.ts`), and `tests/browser/controls.spec.ts` covering first visit,
reaching `playing`, immediate preset/seed changes while paused, pending New beat while playing,
and settings surviving a reload.

This is a second re-submission, responding to a prior `revise` that found a critical runtime bug:
`PresetPicker.tsx`'s `useAppState` selector returned a brand-new object on every call, which trips
React's `useSyncExternalStore` "Maximum update depth exceeded" infinite-loop footgun as soon as the
component mounts in a real browser. This round splits that selector into two stable single-field
calls (matching the sibling `TempoControl`/`VariationControl` pattern already in the diff) and adds
`src/components/selectors.test.ts`, a static-render guard that mocks `useAppState` to compare two
consecutive selector results with `Object.is` across `App` and all eight controls.

**Evaluator verdict: revise, again — for a new, much smaller reason.** The selector fix itself is
correct and verified (repo-wide grep confirms no component anywhere still passes an
object-literal-returning selector to `useAppState`), and 17 of the 18 follow-up acceptance-criteria
commands pass, including the new guard test, the full regression suite, `npm run check`,
typecheck, lint, and build. The one failure is purely a documentation-content gap: the required
Phase 21 decision-log row in `docs/03-IMPLEMENT.md` describes the fix in prose ("external-store
snapshot stability check") but never uses the literal word `useSyncExternalStore` that the
acceptance grep requires — a one-line text fix. See `.ralph/EVALUATION.md` for the exact row,
command, and fix, plus a secondary (non-blocking) note that the new guard test never positively
demonstrates it can catch an unstable selector, only that the now-fixed components don't trip it.
