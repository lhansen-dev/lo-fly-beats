# Phase 21: the real player control UI

Replaces the throwaway audition page with the permanent player UI: eight new components
(`StartListening`, `TransportControls`, `TempoControl`, `VariationControl`, `NewBeatButton`,
`PresetPicker`, `NowPlaying`, `PendingChanges`) built from native `<label>`/`<input
type="range">`/`<output>`/`<fieldset>` controls, wired into a rebuilt `src/app/App.tsx` (header,
a scene placeholder box, and the controls) with the old audition markup and handlers deleted.
Adds pure formatting helpers (`src/app/format.ts`) with unit tests, node-render tests for every
new component and the page (`src/components/controls.test.ts`), a new
`tests/browser/controls.spec.ts` covering first visit, reaching `playing`, immediate
preset/seed changes while paused, pending New beat while playing, and settings surviving a
reload, and retargets the three existing browser specs to the new `start-listening` button id.
This is a re-submission: the prior `revise` round's one issue (two audition-era test-id literals
left un-obfuscated in a negative assertion) is now fixed correctly.

Evaluator verdict: **revise**, again — for a different, new reason. Every acceptance-criteria
command now passes (greps, component/markup checks, the five browser-spec scenarios, docs
checklist/decision-log, `npm run typecheck`/`lint`/`check`). But a careful read of the new
`PresetPicker.tsx` found a critical runtime bug invisible to all of those checks: its
`useAppState` selector returns a brand-new object on every call, which trips a classic
`useSyncExternalStore` infinite-render-loop footgun and throws "Maximum update depth exceeded"
as soon as the component mounts in a real browser — confirmed by tracing the installed React
source and by an empirical repro against this repo's own React/ReactDOM. Since `PresetPicker` is
unconditionally rendered on the one page this app has, this would crash the whole app on load.
Sibling components (`TempoControl`, `VariationControl`) already use the correct two-call pattern;
`PresetPicker` just needs to match it. See `.ralph/EVALUATION.md` for the exact fix.
