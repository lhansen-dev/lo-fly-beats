# Evaluation notes — Phase 21 follow-up (snapshot-stable store selectors)

Started: 2026-10-03T23:48Z (per `date -u`)

Context: this is a re-submission after a prior `revise` verdict (preserved in git history at
eebf566 and in the previous .ralph/EVALUATION.md / EVALUATION-NOTES.md content visible via
`git show HEAD:...`). That revise found a critical bug: PresetPicker.tsx used a combined-object
`useAppState(state => ({ active: state.active, pending: state.pending }))` selector, which
allocates a new object every render and trips the `useSyncExternalStore` "Maximum update depth
exceeded" infinite-loop footgun in a real browser. New commits ac77988 (task1: split selector)
and 7740215 (task2: add selectors.test.ts guard + docs decision log row) claim to fix this.

The ACCEPTANCE CRITERIA given to me this round are the "Phase 21 follow-up (snapshot-stable store
selectors)" set — these supersede the original Phase 21 criteria text embedded in the card body.
Running every command fresh, not trusting the loop's claims.
</content>

## Acceptance criteria run (all commands run verbatim from repo root)
- AC1 `grep -Fq 'const active = useAppState(state => state.active)' src/components/PresetPicker.tsx` -> exit=0 PASS
- AC2 `grep -Fq 'const pending = useAppState(state => state.pending)' src/components/PresetPicker.tsx` -> exit=0 PASS
- AC3 `grep -rF --include='*.tsx' 'useAppState(state => ({' src` -> no matches, exit=1 (expected non-zero) PASS
- AC4 `test -f src/components/selectors.test.ts && npx vitest run --project unit src/components/selectors.test.ts` -> exit=0, 10 tests passed PASS
- AC5 `grep -Fq "vi.mock('../app/store'" src/components/selectors.test.ts` -> exit=0 PASS
- AC6 `grep -Fq 'Object.is' src/components/selectors.test.ts` -> exit=0 PASS
- AC7 for-loop over App/StartListening/TransportControls/TempoControl/VariationControl/PresetPicker/NewBeatButton/NowPlaying/PendingChanges -> all found, exit=0 PASS
- AC8 `grep -Fq 'toThrow' src/components/selectors.test.ts` -> exit=0 PASS (NOTE: only match is `.not.toThrow()`; file has no positive
  `.toThrow()` assertion demonstrating the guard actually fires on an unstable selector — see findings)
- **AC9 `grep -qE '^\| 2026-10-[0-9]{2} \| 21 \|.*useSyncExternalStore' docs/03-IMPLEMENT.md` -> exit=1, FAIL.**
  The only new Phase-21-dated decision row (docs/03-IMPLEMENT.md:82) reads:
  `| 2026-10-01 | 21 | Guard player-control \`useAppState\` selectors with a static-render
  snapshot-stability test that evaluates each selector twice against the same state and requires
  \`Object.is\` equality. | Emulates React's external-store snapshot stability check without
  mounting a browser root; statically renders every player control. |`
  It never contains the literal substring `useSyncExternalStore` (it says "external-store
  snapshot stability check" instead). The only occurrence of `useSyncExternalStore` anywhere in
  the doc is unrelated prose at line 1008 ("...hook built on React's `useSyncExternalStore`."),
  which is not part of a dated Phase 21 decision-log row. ACCEPTANCE CRITERION FAILS.

## Regression
- `npx vitest run --project unit src/components/controls.test.ts src/app/format.test.ts src/app/store.test.ts` -> 3 files, 23 tests, exit 0 PASS
- `npm run typecheck` -> exit 0 PASS
- `npm run lint` -> exit 0, 3 pre-existing-style warnings (no-children-prop x2, only-export-components x1), 0 errors PASS
- `npm run build` -> exit 0 (vite build succeeded, 1079 modules) PASS
- PresetPicker fieldset/legend/radio/selectPreset grep chain -> exit 0 PASS
- App.tsx `<PresetPicker />` + `data-testid="scene-placeholder"` grep chain -> exit 0 PASS
- audition leftovers grep (`start-restart|random-seed|seed-input|preset-select`) -> no match, exit 1 (expected non-zero) PASS
- `[ "$(grep -c '^test(' tests/browser/controls.spec.ts)" = 5 ]` -> exit 0 PASS
- `grep -q 'jsdom' package.json` -> no match, exit 1 (expected non-zero) PASS

Result: 17/18 acceptance-criteria commands pass; AC9 (decision-log row must literally say
`useSyncExternalStore`) FAILS.

## Full-suite sanity (not individually required by this round's ACs, run anyway)
- `npm run check` -> exit 0 (typecheck, lint [0 errors/3 pre-existing-style warnings], 147 unit
  tests incl. the new selectors.test.ts, data:validate, build — all green).
- `npx playwright test --project=chromium` -> fails to even start: `listen EPERM: operation not
  permitted 127.0.0.1:4173` (preview server can't bind a local socket in this sandbox). This is
  the same pre-existing sandbox limitation already documented in docs/03-IMPLEMENT.md for Phases
  16, 18, 20, and the original Phase 21 row (line 106); not a new regression and not part of this
  round's acceptance-criteria list, so not held against this submission.

## Manual code review beyond the greps
- src/components/PresetPicker.tsx now matches the sibling pattern in TempoControl.tsx /
  VariationControl.tsx exactly (two separate `useAppState(state => state.X)` calls). Confirmed via
  `grep -rn "useAppState(" src` that every call site in the tree is now a single-field accessor —
  no remaining object/array-literal-returning selector anywhere in src.
- src/components/selectors.test.ts: `vi.mock('../app/store', ...)` correctly re-exports the real
  `createAppStore`/`getAppStore` (same closure-backed singleton) and only overrides `useAppState`
  with a plain function that calls the selector twice against one snapshot and throws on
  `!Object.is`. This is a reasonable static-render emulation of React's real
  `checkIfSnapshotChanged`. Ran it standalone: 10/10 pass.
  - Gap: the suite only exercises the 9 *real* (now-fixed) component selectors and asserts
    `.not.toThrow()`; it has no dedicated positive-path test that feeds the harness a deliberately
    unstable (object/array-literal) selector and asserts `.toThrow()`. The literal
    `grep -Fq 'toThrow'` AC passes only because `.not.toThrow()` contains that substring — the
    suite never actually demonstrates the guard firing. Logged as an "important" finding (not
    disqualifying by itself, AC8's literal command does pass).
  - `setup()` in selectors.test.ts duplicates `setup()` in controls.test.ts almost verbatim
    (confirmed via oxlint flagging the identical `no-children-prop` pattern at the same column in
    both files). Minor duplication, "suggestion" severity.
  - Decision-log row's date (2026-10-01) doesn't match the commits' actual date (Oct 3, 2026 per
    `git log`); cosmetic only, "suggestion" severity, does not affect the AC9 regex match.
- Re-read App.tsx, TransportControls.tsx, StartListening.tsx, TempoControl.tsx,
  VariationControl.tsx, NewBeatButton.tsx, NowPlaying.tsx, PendingChanges.tsx, format.ts, and
  tests/browser/controls.spec.ts in full: all match the card's bullet list (components, native
  `<label>`/`<input type="range">`/`<output>`/`<fieldset>`+`<legend>`, play-toggle swapped in after
  first start, position formatted "Phrase N · Bar N · Beat N", 5 Playwright scenarios covering
  first-visit/start/immediate-while-paused/pending-while-playing/reload-persistence). Audition
  markup (`preset-select`, `seed-input`, `random-seed`, `start-restart`, `chords`, `trace`) is
  fully removed from App.tsx, confirmed by diff and by the repo-wide leftover grep. No files
  outside the Phase 21 / selector-fix scope were touched (package.json/package-lock.json
  untouched, no mixer/export/scene files).

## Conclusion
16 of 17 distinct "New behaviour" + "Regression" acceptance-criteria commands pass (AC1–AC8 minus
the content gap noted on AC8, AC7, and all Regression items). **AC9 fails**: the Phase 21 decision
log row does not literally contain `useSyncExternalStore`, which the criterion requires via
`grep -qE '^\| 2026-10-[0-9]{2} \| 21 \|.*useSyncExternalStore' docs/03-IMPLEMENT.md`. This is a
one-line documentation fix. Verdict: revise.
