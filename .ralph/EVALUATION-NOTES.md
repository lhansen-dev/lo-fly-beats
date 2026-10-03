# Evaluation notes — Phase 21 (re-submission after prior revise)

Started: 2026-10-03T23:23:41Z (per `date -u`)

Context: This is a re-submission. Prior evaluation (commit 96ac4c5) returned `revise` for exactly
one issue: literal `data-testid="chords"` / `data-testid="trace"` substrings embedded in negative
assertions in `src/components/controls.test.ts`, which made the audition-era-identifier grep match
instead of fail. Plan v2 task 1 (commit 40e8107) split those two strings using the same
`'start-' + 'restart'` trick already used nearby. Diff confirmed: only the two lines changed as
expected, matching exactly what the prior evaluation asked for.

Now re-running the full acceptance criteria set myself from the top, not trusting the loop's claim.
AC1 pass (grep found nothing, exit=1)
AC2 pass (grep found nothing, exit=1)
6 checks done
Ran: vitest controls.test.ts -> 10 passed; vitest format.test.ts -> 8 passed.
Negative-assertion count check (>=3 not.toContain) -> 6 occurrences, pass. 'chords' and 'trace' substrings present (split form) -> pass.
Eight components exist -> pass. Transport/slider/preset/remaining-control markup greps -> all pass.
App.tsx scene-placeholder/circuit-status/7-component-wiring greps -> all pass (no MISSING printed).
controls.spec.ts: 5 test( found (>=5); all six required substrings present -> pass.
engine/boundaries/soak specs reference start-listening -> pass.
Docs: Phase 21 checklist >=5 [x] (actual 5); decision log row 2026-10-03 | 21 present -> pass.
npm run typecheck -> exit 0.
npm run lint -> exit 0 (2 pre-existing-style warnings, 0 errors).

## Full regression
npm run check -> exit 0 (typecheck, lint [0 errors/2 pre-existing-style warnings], 137 unit tests, data:validate, build all green).
git diff main...HEAD --name-only -- . ':!.ralph' -> 18 files, all Phase-21-scoped (App.tsx, format.ts/.test.ts, 8 new components + controls.test.ts, app.css, 4 browser specs, docs/03-IMPLEMENT.md). No mixer/export/scene files touched — matches card's out-of-scope list.
R12/R14 cross-read: NowPlaying track title "No Thoughts, Only Fruit" matches R14; preset testids preset-rainy-windowsill/overripe-2am/fruit-bowl-finals match R12 table and src/presets/types.ts PresetId; TransportControls play-toggle disabled on starting/exporting matches R12's control table; App.tsx header+tagline+scene-placeholder+controls matches card bullet list; getPendingChanges logic moved verbatim into src/app/format.ts (describePendingChanges) with no duplication left behind in App.tsx (grep confirms getPendingChanges only exists in format.ts now).

## Bug hunt beyond the acceptance-criteria greps (per instructions, step 3)
Found a CRITICAL runtime bug not caught by any criterion, grep, typecheck, lint, or the renderToStaticMarkup-based unit tests:

src/components/PresetPicker.tsx:7
  const { active, pending } = useAppState(state => ({ active: state.active, pending: state.pending }))

This selector allocates a brand-new object on every call. src/app/store.ts's useAppState has zero memoization
(`useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()))`), so
every getSnapshot() call returns a new reference even when nothing changed. This is React's documented
"getSnapshot should be cached to avoid an infinite loop" footgun. Every sibling component in this SAME diff
(TempoControl.tsx, VariationControl.tsx) reads the identical active+pending data correctly via two separate
single-field `useAppState(state => state.active)` / `useAppState(state => state.pending)` calls — PresetPicker is
the only file in the whole src tree using the combined-object form (confirmed via repo-wide grep).

Traced the exact mechanism in the installed node_modules/react-dom (19.2.8) client reconciler
(mountSyncExternalStore / updateStoreInstance / checkIfSnapshotChanged / forceStoreRerender in both
react-dom-client.development.js and the production bundle, which both have the same 50-update
NESTED_UPDATE_LIMIT safety throw). Confirmed empirically: installed jsdom + the repo's own react@19.2.8/
react-dom@19.2.8 via `npm install --no-save` (package.json/package-lock.json verified untouched after,
scratch files removed, repo re-`npm install`ed back to clean — `git status --porcelain` clean except
EVALUATION-NOTES.md before writing this note), wrote a minimal repro mounting the exact PresetPicker
selector shape with react-dom/client's createRoot (matching src/main.tsx's real mount path exactly) — it
throws "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside
componentWillUpdate or componentDidUpdate..." within <1s of mounting. The sibling single-field-selector
pattern, mounted the same way, does not throw. Since PresetPicker is unconditionally rendered in App.tsx
and App.tsx is the whole app (main.tsx has no ErrorBoundary anywhere in src), this would crash the entire
page on first load in a real browser. This is exactly the class of bug Playwright's controls.spec.ts would
have caught (e.g. "preset and New beat apply immediately while paused" clicking preset-fruit-bowl-finals)
had this sandbox been able to run it — it cannot (confirmed socket-bind EPERM, consistent with Phases 16/18/20),
which is why the acceptance criteria deliberately check content instead of execution, and why this slipped
through all automated gates.

Verdict: revise. Fix: src/components/PresetPicker.tsx line 7 — split into two useAppState calls like
TempoControl.tsx/VariationControl.tsx already do, e.g.:
  const active = useAppState(state => state.active)
  const pending = useAppState(state => state.pending)

All cleanup done: .ralph/scratch removed, package-lock.json restored to HEAD content (git checkout was denied
by sandbox index-lock permissions, so restored via `git show HEAD:package-lock.json` -> file overwrite instead),
node_modules reconciled with plain `npm install`. Final `git status --porcelain` shows only .ralph/EVALUATION-NOTES.md
modified prior to writing EVALUATION.md/SUMMARY.md.
