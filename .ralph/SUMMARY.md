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

Evaluator verdict: **revise**. Everything checked out — all regression gates (`npm run
typecheck`/`lint`/`build`/`check`, the `src/app` and `src/components` unit suites) pass, and
every acceptance-criteria grep passes except one: the "no audition page references remain"
check fails because two negative test assertions in `controls.test.ts` embed the literal
strings `data-testid="chords"` and `data-testid="trace"` (the file dodged this correctly for
`start-restart` via string concatenation but missed doing the same for these two). A one-line-
style fix to those two assertions should clear it.
