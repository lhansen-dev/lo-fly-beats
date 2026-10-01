VERDICT: approve

## What I verified

This is a re-review after a prior `revise` (the two `TS6133` unused-import errors). The
loop's fix commit (`fb14e14`) removed `vi` from `src/app/controller.test.ts`'s vitest
import and the unused `import type { PendingChange } from '../audio/sequencer'` from
`src/app/controller.ts`. I re-ran every command in the acceptance criteria myself from
a clean working tree (no reliance on the loop's claims):

- **Build gates**: `npm run typecheck` → exit 0. `npm run build` → exit 0 (`tsc -b` then
  `vite build` completes, 1070 modules, emits `dist/`). The four import-shape greps all
  resolve as required (vitest import has no `vi`; `PendingChange`/sequencer import are
  gone from `controller.ts`).
- **Regression**: `npx vitest run --project unit src/app/controller.test.ts` → 8/8 pass.
  `npx vitest run --project unit src/audio/sequencer.test.ts` → 11/11 pass (tempo-at-next-bar,
  variation/preset/New-beat-at-next-phrase, duplicate-request replacement, pre-first-phrase
  immediate apply, `applyTempoNow` position-stable — all five listed cases present as
  distinct tests). `state.test.ts`/`store.test.ts`/`persistence.test.ts`/`timing.test.ts`
  → 26/26 pass, unchanged. `npm run lint` → exit 0 (1 warning, 0 errors; the warning is the
  `react/only-export-components` rule on `ControllerContext.tsx`, which is configured as
  `warn` in `.oxlintrc.json`, not an error). `npm run data:validate` → exit 0. All 21
  structural greps (sequencer/engine/controller/ControllerContext/main.tsx/App.tsx test ids/
  boundaries.spec.ts/decision-log row) pass exactly as specified.
- Ran the full `npm run check` too (not just the pieces): it actually passes end-to-end in
  this sandbox (119/119 unit tests, lint, build) — only `npx playwright test --project=chromium`
  is blocked here, and I reproduced the exact failure myself: `Error: listen EPERM: operation
  not permitted 127.0.0.1:4173` from the Playwright preview `webServer`, matching the
  documented Phase 16/18 sandbox limitation. `docs/03-IMPLEMENT.md` leaves Phase 20's final
  "All verification steps pass" box unchecked for this same reason, consistent with precedent
  — I left it as-is since that's accurate, not stale.
- Read R9 (sequencer/engine) and R12 (control behavior table) and traced the actual
  `PlaybackSequencer.advance()`/`request()`, the engine's `onStep`/`request`/`applyTempoNow`,
  and `SessionController.setTempo/setVariation/newBeat/selectPreset` against them line by
  line. The "while playing" vs "while paused, or before the first start" split is correct,
  including the nuance that a pending preset's bundled tempo must be shown/applied at the
  *next phrase* rather than the *next bar* (`App.tsx`'s `getPendingChanges` correctly prefers
  `pending.presetId` over a bare `pending.tempoBpm`).
- Diff scope check: only the 10 files the card describes changed
  (`docs/03-IMPLEMENT.md`, `src/app/{App.tsx,ControllerContext.tsx,controller.ts,controller.test.ts}`,
  `src/audio/{engine.ts,sequencer.ts,sequencer.test.ts}`, `src/main.tsx`,
  `tests/browser/boundaries.spec.ts`). No unrelated files, no lockfile/package.json drift.
- To stress-test beyond the grep/unit checks, I wrote a throwaway scratch vitest file
  (created, run, then deleted — confirmed via `git status` that the tree is clean again)
  exercising `selectPreset()` followed by `setTempo()` while playing. This surfaced a real,
  narrow edge case: the store's flat `pending.tempoBpm` can go stale (never clears) if a
  plain tempo request is made after a preset request but before the next phrase boundary,
  because the sequencer correctly discards the superseded tempo value in favor of the
  preset's bundled tempo, but the store's value-equality-based `changesApplied` reconciliation
  (owned by Phase 19's unmodified `state.ts`) has no way to know the two pending values were
  linked. Actual audio/tempo application is correct; only the optional "pending-changes" text
  can show a stale BPM after this specific sequence. None of the required tests or acceptance
  criteria exercise this combination, and fixing it well would mean touching the Phase-19
  `pending` shape or its reconciliation rule, which is out of this card's stated scope. I'm
  flagging it for the human reviewer/next card rather than treating it as disqualifying.

## For the human reviewer to look at

- The "important" finding above (stale pending-tempo text after preset-then-tempo while
  playing) — worth a follow-up card/phase, not a blocker for this one.
- `ControllerContext.tsx` triggers an oxlint `only-export-components` warning (fast-refresh
  advice for files exporting both a provider and a hook); it's configured as non-fatal and is
  a completely standard React context pattern, but flag if the project wants a stricter style
  later.
- `tests/browser/boundaries.spec.ts` and the rest of Playwright could not actually be executed
  in this sandbox (confirmed `EPERM` on the preview server bind); that step still needs to run
  in CI or locally before this is fully proven end-to-end, same as Phases 16/18.

```findings
[
  { "severity": "important", "file": "src/app/state.ts", "issue": "After selectPreset() then setTempo() while playing (both pending before the next phrase boundary), the store's pending.tempoBpm never clears: PlaybackSequencer correctly discards the superseded tempo in favor of the preset's bundled tempo, but changesApplied's value-equality reconciliation in state.ts can't match the stale pending.tempoBpm to the eventually-applied active.tempoBpm, so the pending-changes text can get stuck showing an obsolete BPM. Reproduced with an ad-hoc test; not covered by any required test." },
  { "severity": "suggestion", "file": "src/app/ControllerContext.tsx", "issue": "oxlint's react/only-export-components warns because the file exports both ControllerProvider and useController; harmless (configured as warn, standard context+hook pattern) but worth a separate hooks file later if the project wants zero warnings." },
  { "severity": "suggestion", "issue": "The loop made many fine-grained 'ralph: task N' commits across two plan iterations rather than the single 'phase 20' commit the card's Process line and docs/03-IMPLEMENT.md point 6 describe; functionally harmless and outside the acceptance criteria, but note for pipeline consistency." }
]
```
