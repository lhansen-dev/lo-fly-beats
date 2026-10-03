VERDICT: revise

## What I checked

This is a re-submission after a prior `revise` (which found PresetPicker.tsx's combined-object
`useAppState` selector could trip a `useSyncExternalStore` infinite-render-loop). This round's
acceptance criteria are the "Phase 21 follow-up (snapshot-stable store selectors)" set given in
the prompt. I re-ran every command in that list from a clean shell at the repo root (see
`.ralph/EVALUATION-NOTES.md` for the full transcript), plus `npm run check` and
`npx playwright test --project=chromium`, plus a manual read of every changed/relevant file.

Result: 17 of 18 criteria commands pass. **One fails**, and per the rules an acceptance-criterion
failure is never auto-approved:

### AC9 fails — decision log row doesn't say `useSyncExternalStore`

```
$ grep -qE '^\| 2026-10-[0-9]{2} \| 21 \|.*useSyncExternalStore' docs/03-IMPLEMENT.md
exit 1   (expected 0)
```

The only new Phase-21-dated row the loop added (`docs/03-IMPLEMENT.md:82`) is:

> `| 2026-10-01 | 21 | Guard player-control \`useAppState\` selectors with a static-render
> snapshot-stability test that evaluates each selector twice against the same state and requires
> \`Object.is\` equality. | Emulates React's external-store snapshot stability check without
> mounting a browser root; statically renders every player control. |`

It paraphrases as "external-store snapshot stability check" instead of using the literal hook
name. The only occurrence of the substring `useSyncExternalStore` anywhere in the file is
unrelated pre-existing architecture prose at line 1008 ("`useAppState(selector)` hook built on
React's `useSyncExternalStore`"), which is not a dated decision-log row and doesn't match the
regex.

**Fix:** edit the Phase 21 row at `docs/03-IMPLEMENT.md:82` so it contains the literal substring
`useSyncExternalStore`, e.g. change "Emulates React's external-store snapshot stability check" to
"Emulates React's `useSyncExternalStore` snapshot-stability check". No other content in that row
needs to change. This is a one-line text edit; nothing else in this round needs rework for AC9.

## Everything else that passed

- AC1–AC2: `src/components/PresetPicker.tsx` now reads `active`/`pending` via two separate
  `useAppState(state => state.X)` calls, matching `TempoControl.tsx`/`VariationControl.tsx`.
- AC3: repo-wide `grep` confirms no `.tsx` file anywhere passes an object-literal selector to
  `useAppState` any more (`grep -rn "useAppState(" src` shows every call site is single-field).
- AC4–AC7: `src/components/selectors.test.ts` exists, passes (`npx vitest run --project unit
  src/components/selectors.test.ts` → 10/10), mocks `../app/store`, compares with `Object.is`, and
  covers `App` plus all eight Phase 21 controls.
- AC8: `toThrow` appears (see caveat below).
- Regression: `npx vitest run --project unit src/components/controls.test.ts src/app/format.test.ts
  src/app/store.test.ts` → 23/23 pass; `npm run typecheck`, `npm run lint` (0 errors, 3
  pre-existing-style warnings), `npm run build`, and `npm run check` (147 unit tests) all exit 0;
  `PresetPicker.tsx` still renders a `<fieldset>`/`<legend>Preset</legend>`/radio
  inputs/`controller.selectPreset`; `App.tsx` still wires in `<PresetPicker />` and
  `data-testid="scene-placeholder"`; no audition-era test IDs (`start-restart`, `random-seed`,
  `seed-input`, `preset-select`) remain anywhere in `src`/`tests`; `tests/browser/controls.spec.ts`
  still has exactly 5 `test(` scenarios matching the card's five required cases; no `jsdom`
  dependency was added.
- `npx playwright test --project=chromium` cannot start in this sandbox (`listen EPERM: operation
  not permitted 127.0.0.1:4173`) — this is the same pre-existing local-socket-bind restriction
  already recorded in `docs/03-IMPLEMENT.md` for Phases 16, 18, 20, and the original Phase 21 row;
  it is not a new regression and this round's acceptance criteria don't require running it.

## One more thing worth fixing in the same pass (not independently disqualifying)

`src/components/selectors.test.ts` only ever renders the 9 *already-fixed* components and asserts
`.not.toThrow()`. The literal `grep -Fq 'toThrow'` check (AC8) passes only because `.not.toThrow()`
contains that substring, but the suite has no positive-path test that feeds the harness a
deliberately unstable (object/array-literal) selector and asserts it `.toThrow()`. As written, the
suite can't actually prove its own detection logic works — if the `Object.is` check were ever
accidentally inverted or dropped, every existing test would keep passing. Please add one small
test, e.g. directly exercising the mocked `useAppState` (or a copy of its comparison logic) with
`() => ({})`-style selector and asserting it throws. This directly fulfils the acceptance
criterion's stated intent ("the guard proves it really detects an unstable selector (it is not
vacuous)") rather than just the literal grep.

## Minor, non-blocking nits

- `selectors.test.ts`'s `setup()` helper duplicates `controls.test.ts`'s `setup()` almost verbatim
  (oxlint flags the identical `no-children-prop` pattern in both). Not disqualifying; could share a
  helper module later.
- The new decision-log row is dated 2026-10-01, but the two commits that add it were made on
  2026-10-03 (per `git log`); cosmetic only and doesn't affect any grep.

## Scope check

The diff for this round touches exactly `src/components/PresetPicker.tsx` (2 lines),
`src/components/selectors.test.ts` (new file), and `docs/03-IMPLEMENT.md` (+1 row) — tightly
scoped to the follow-up fix, nothing unrelated. The broader whole-card diff (`git diff
main...HEAD`, 19 files) stays within Phase 21's stated scope: 8 new components, `App.tsx`
rewritten, `tests/browser/controls.spec.ts` added, 3 existing browser specs retargeted to
`start-listening`, `docs/03-IMPLEMENT.md` updated. No mixer/export/scene files were touched,
matching the card's out-of-scope list. `package.json`/`package-lock.json` are untouched.

```findings
[
  { "severity": "critical", "file": "docs/03-IMPLEMENT.md", "line": 82, "issue": "the new Phase 21 decision-log row never contains the literal substring 'useSyncExternalStore' (it paraphrases as 'external-store snapshot stability check'), so `grep -qE '^\\| 2026-10-[0-9]{2} \\| 21 \\|.*useSyncExternalStore' docs/03-IMPLEMENT.md` exits 1 instead of the required 0." },
  { "severity": "important", "file": "src/components/selectors.test.ts", "issue": "the guard suite only renders already-fixed components with `.not.toThrow()`; it has no positive-path test proving the Object.is check actually throws for a deliberately unstable selector, so a broken comparison would silently pass." },
  { "severity": "suggestion", "file": "src/components/selectors.test.ts", "issue": "the setup() render harness duplicates controls.test.ts's setup() almost verbatim; could be extracted to a shared test helper." },
  { "severity": "suggestion", "file": "docs/03-IMPLEMENT.md", "line": 82, "issue": "the new decision-log row is dated 2026-10-01 but the commits that add it are dated 2026-10-03 per git log." }
]
```
