VERDICT: revise

## Summary

This is a re-submission after a prior `revise` (the one blocking issue from that round — literal
`data-testid="chords"`/`data-testid="trace"` substrings embedded in `controls.test.ts`'s negative
assertions — is fixed correctly: both now use the same split-string trick already used for
`start-restart`). I re-ran every command in the acceptance criteria myself, from a clean checkout,
and **every single one passes**: the two forbidden-literal greps now correctly fail (exit non-zero,
zero matches), all eight components exist with the right markup/testids, `App.tsx` is the permanent
player page with the scene placeholder and all seven controls wired in, `controls.spec.ts` has the
five required scenarios, the three older browser specs target `start-listening`, the docs checklist
and decision-log row are present, and `npm run typecheck`, `npm run lint`, and the full `npm run check`
(137 unit tests, data:validate, build) all exit 0.

However, going beyond the literal criteria as instructed (step 3: "look for problems criteria can't
catch: bugs or unhandled edge cases in the changed code"), I found a **critical, confirmed-by-repro
runtime bug** that crashes the real app on first load. This blocks approval even though every
acceptance-criteria command passes, because criteria here are checked by content/grep (Playwright
can't run in this sandbox), so a real-browser-only crash like this has no way to show up in any of
the automated gates — only in a careful read of the component code, which is exactly what this review
step exists for.

## What's wrong

`src/components/PresetPicker.tsx` line 7:
```tsx
const { active, pending } = useAppState(state => ({ active: state.active, pending: state.pending }))
```

`useAppState` (`src/app/store.ts`) is a thin, **unmemoized** wrapper around React's
`useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()))`.
Every time React calls `getSnapshot()` — which it does on mount, after every commit (via a passive
effect), and again whenever the store notifies — it re-invokes `selector(store.getState())`. Because
this particular selector returns a **brand-new object literal** every call, two consecutive calls
never satisfy `Object.is` equality even when nothing in the store changed. This is React's own
documented `useSyncExternalStore` pitfall ("The result of getSnapshot should be cached to avoid an
infinite loop"): React sees a "changed" snapshot after every single render, forces another re-render,
which produces another new object, forces another re-render, … until React's nested-update safety
limit (50) trips and it throws `Maximum update depth exceeded`.

Every sibling component that needs the same `active` + `pending` pair does it correctly, with two
separate single-field selector calls — e.g. `TempoControl.tsx` and `VariationControl.tsx`:
```tsx
const active = useAppState(state => state.active)
const pending = useAppState(state => state.pending)
```
`PresetPicker.tsx` is the *only* file in the whole `src` tree using the combined-object form (verified
with `grep -rn "useAppState(state => ({" src`), which strongly suggests this was simply missed rather
than intentional.

Because `PresetPicker` is unconditionally rendered inside `App.tsx` (`<PresetPicker />` in the controls
section), and `App.tsx` is the entire page, and there is no `ErrorBoundary` anywhere in `src` (confirmed
by grep), this crash happens **on every page load**, not just on interaction — it would make the "real
player control UI" this card is building completely unusable in a real browser.

### How I confirmed this (not just theory)

1. Traced the exact mechanism in the *installed* `node_modules/react-dom` 19.2.8 client reconciler
   (`mountSyncExternalStore` → `updateStoreInstance` → `checkIfSnapshotChanged` → `forceStoreRerender`
   in `react-dom-client.development.js`), and confirmed the same `NESTED_UPDATE_LIMIT = 50` safety-throw
   exists in the production bundle too (`react-dom-client.production.js`), so this isn't a dev-only
   warning — it crashes in `npm run build` output as well.
2. Empirically reproduced it: installed `jsdom` with `npm install --no-save` (verified `package.json`/
   `package-lock.json` untouched afterward), wrote a throwaway script under `.ralph/scratch/` (removed
   before finishing) that mounts the *exact* `PresetPicker` selector shape via `react-dom/client`'s
   `createRoot` — the same API `src/main.tsx` uses — using this repo's own installed `react`/`react-dom`.
   Result: it throws `Maximum update depth exceeded. This can happen when a component repeatedly calls
   setState inside componentWillUpdate or componentDidUpdate...` within under a second of mounting. The
   `TempoControl`/`VariationControl`-style two-call pattern, mounted the same way, does not throw.
3. Cleaned up fully afterward: `.ralph/scratch` removed, `package-lock.json` restored to `HEAD`'s content
   (via `git show HEAD:package-lock.json`, since `git checkout` was denied by this sandbox's index-lock
   permissions), `node_modules` reconciled with a plain `npm install`, confirmed `npx vitest run --project
   unit src/components/controls.test.ts src/app/format.test.ts` still passes (18/18) and `git status
   --porcelain` is clean except `.ralph/EVALUATION-NOTES.md`.

This is precisely why it slipped through: `controls.test.ts` renders everything with
`renderToStaticMarkup` (`react-dom/server`), which never runs effects or the snapshot-consistency check
at all, so the bug is invisible to the unit suite; the acceptance criteria check markup/text by `grep`,
which can't see it either; and Playwright (which would very likely hang/fail on the "preset and New beat
apply immediately while paused" scenario, since the whole page becomes non-functional once `PresetPicker`
mounts) cannot run in this sandbox.

## Fix needed

In `src/components/PresetPicker.tsx`, replace the combined-object selector with two single-field calls,
matching the pattern already used correctly in `TempoControl.tsx`/`VariationControl.tsx`:
```tsx
const active = useAppState(state => state.active)
const pending = useAppState(state => state.pending)
```
(`const selected = pending.presetId ?? active.presetId` and the rest of the component stay the same.)
After the fix, please re-verify by mounting the component in a real `react-dom/client` root (not just
`renderToStaticMarkup`) if at all possible, since that's the only way this class of bug shows up — the
existing `controls.test.ts` assertions alone won't catch a regression here.

This is the only change needed; I did not find any other functional bugs, and the rest of the diff
(all eight components' markup, `App.tsx`'s structure, the five `controls.spec.ts` scenarios, the docs
checklist/decision-log row, and the scope of the diff) is correct and tightly scoped to Phase 21.

## What I verified myself (commands run from repo root)

- Both previously-failing acceptance greps now correctly fail (no matches): `grep -rqE
  'start-restart|data-testid="chords"|data-testid="trace"|random-seed|seed-input|preset-select' src
  tests` → exit 1; `grep -qE 'data-testid="(chords|trace)"' src/components/controls.test.ts` → exit 1.
- `npx vitest run --project unit src/components/controls.test.ts` → 10/10 pass; `npx vitest run
  --project unit src/app/format.test.ts` → 8/8 pass.
- `grep -c 'not\.toContain' src/components/controls.test.ts` → 6 (≥3); `grep -q 'chords'` and `grep -q
  'trace'` on the same file both exit 0 (split-string form still contains the substrings, just not
  contiguously).
- All eight `src/components/*.tsx` files exist; every markup/testid grep in the acceptance criteria
  (StartListening disabled, TransportControls play-toggle/engine-status/position, Tempo/Variation
  range+output+testid, PresetPicker fieldset/legend/radio, NewBeatButton/NowPlaying/seed-hex/
  PendingChanges testids, App.tsx scene-placeholder/circuit-status + all 7 `<Component />` wirings) →
  all pass.
- `controls.spec.ts`: 5 `test(` blocks; all six required substrings (`start-listening`, `play-toggle`,
  `new-beat`, `seed-hex`, `preset-fruit-bowl-finals`, `reload()`) present.
- `engine.spec.ts`/`boundaries.spec.ts`/`soak.spec.ts` all reference `start-listening`.
- Phase 21 checklist: 5 of 5 task boxes ticked between `## Phase 21:` and `## Phase 22:`; decision-log
  row `| 2026-10-03 | 21 | ...` present.
- `npm run typecheck` → exit 0. `npm run lint` → exit 0 (2 pre-existing style warnings, 0 errors,
  neither introduced by this diff — one is in untouched `ControllerContext.tsx`, the other is a
  `no-children-prop` note in the new `controls.test.ts` test helper, harmless). `npm run check` (full:
  typecheck + lint + 137 unit tests + data:validate + build) → exit 0.
- `git diff main...HEAD --name-only -- . ':!.ralph'` → 18 files, all Phase-21-scoped (App.tsx, new
  format.ts/.test.ts, the 8 new components + controls.test.ts, app.css, 4 browser specs,
  docs/03-IMPLEMENT.md). No mixer/export/scene files touched, matching the card's out-of-scope list.
- Cross-read R12/R14 against the new components: `NowPlaying`'s track title text, the three
  `preset-*` testids, `TransportControls`' play-toggle disabled-on-starting/exporting logic, and
  `App.tsx`'s header/tagline/placeholder/control layout all match.
- The critical `PresetPicker` bug described above, including an empirical repro against this repo's
  own installed React.

## For the human reviewer, once re-submitted

Nothing else stood out. Once the `PresetPicker` fix lands, worth a close look at whether a quick
smoke test of the real page (even just `npm run dev` and clicking a preset radio, since Playwright
can't run here) is feasible before merge, since this class of bug is specifically invisible to every
automated check available in this sandbox.

```findings
[
  { "severity": "critical", "file": "src/components/PresetPicker.tsx", "line": 7, "issue": "`useAppState(state => ({ active: state.active, pending: state.pending }))` allocates a new object on every getSnapshot() call; useAppState has no memoization, so React's useSyncExternalStore detects a \"changed\" snapshot on every render and force-rerenders forever, throwing \"Maximum update depth exceeded\" within under a second of mounting in a real react-dom/client root (confirmed by source-tracing node_modules/react-dom 19.2.8 and an empirical jsdom+createRoot repro). PresetPicker is unconditionally rendered in App.tsx with no ErrorBoundary anywhere in src, so this crashes the whole page on first load. Fix: split into two single-field `useAppState` calls, matching the correct pattern already used in TempoControl.tsx/VariationControl.tsx (`const active = useAppState(state => state.active)` / `const pending = useAppState(state => state.pending)`)." }
]
```
