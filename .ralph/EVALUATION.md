VERDICT: revise

## Summary

Every whole-card acceptance criterion that is checkable by `grep`/`test -f` passes
(16/16), and every targeted `vitest` run named in the acceptance criteria passes
(sequencer: 11/11, controller: 8/8, state/store/persistence/timing regression:
26/26). The feature implementation itself — `PlaybackSequencer.request`/
`applyTempoNow`, `EngineLike`/engine `request`/`applyTempoNow`, `SessionController`,
`ControllerContext`, the rewired `App.tsx` audition page, and
`tests/browser/boundaries.spec.ts` — looks complete, in-scope, and matches R9/R12
as described in the card.

However, the regression gate fails outright:

```
$ npm run typecheck
src/app/controller.test.ts(1,32): error TS6133: 'vi' is declared but its value is never read.
src/app/controller.ts(2,1): error TS6133: 'PendingChange' is declared but its value is never read.
```
Exit code: 2 (not 0).

```
$ npm run build
> tsc -b && vite build
src/app/controller.test.ts(1,32): error TS6133: 'vi' is declared but its value is never read.
src/app/controller.ts(2,1): error TS6133: 'PendingChange' is declared but its value is never read.
```
Exit code: 2 (not 0). `vite build` never even runs.

```
$ npm run check
> npm run typecheck && npm run lint && npm run test && npm run data:validate && npm run build
...same two TS6133 errors...
```
Exit code: 2. **`npm run check` is literally the card's own stated Verify step 1**
("Verify: `npm run check` and `npx playwright test --project=chromium` pass"),
so the card's own acceptance bar is not met, independent of the separate
regression-criteria list.

Root cause, confirmed by reading both files in full: two genuinely dead imports,
not a sandbox/environment limitation (unlike the known Phase 16/18 Playwright
socket-bind issue, which is unrelated to this failure):

- `src/app/controller.test.ts:1` — `import { describe, expect, it, vi } from 'vitest'`.
  `vi` is never referenced anywhere else in the file (no `vi.fn()`, `vi.spyOn()`,
  `vi.useFakeTimers()`, etc.).
- `src/app/controller.ts:2` — `import type { PendingChange } from '../audio/sequencer'`.
  Never used as a type anywhere in the file; the actual request payload type is
  derived inline via `Parameters<EngineLike['request']>[0]`.

## What to change

1. In `src/app/controller.test.ts`, change the first import line to
   `import { describe, expect, it } from 'vitest'` (drop `vi`), unless a test in
   that file was meant to use `vi` (e.g. to fake timers or spy on something) and
   is currently missing that assertion — re-check the file's test list against
   the card's intent before just deleting the import, in case this points to an
   incomplete test rather than a stray import.
2. In `src/app/controller.ts`, delete the unused
   `import type { PendingChange } from '../audio/sequencer'` line (line 2).
3. Re-run `npm run typecheck`, `npm run build`, and `npm run check` and confirm
   all three exit 0 before resubmitting.
4. Also run `npm run lint` again afterward — it already exits 0 today (oxlint
   only warns on unused vars, it doesn't error), but the same two warnings will
   disappear once the imports are removed, along with one unrelated pre-existing
   `react-refresh/only-export-components` warning on `useController` in
   `ControllerContext.tsx` that is not caused by this change and does not need
   to be touched.

Nothing else needs to change — scope, file list, and the rest of the diff are fine.

## Non-blocking note for the planner (optional, not required for approval)

`src/audio/sequencer.ts`'s `request()`/`pending` getter: if a `preset` request
(which carries its own `tempoBpm`) is pending and then a plain `tempo` request
arrives before the next phrase boundary, the `pending` getter's
`pendingPreset?.tempoBpm ?? pendingTempo` precedence shows the preset's tempo
(masking the newer explicit tempo request), and at apply time the preset block
runs after the tempo block and overwrites the recipe's tempo back to the
preset's value — so the user's later plain tempo request is silently dropped
with no `'tempo'` entry in `applied`. This is not covered by any of the card's
five required test cases and is not an acceptance-criterion failure, so it does
not block approval, but it's a real edge case worth a look (or at least a
comment) in a follow-up.

## Verified in this session (fresh, not just inherited from the stalled attempt)

- All 16 grep/`test -f` acceptance criteria: PASS (re-ran every one individually).
- `npx vitest run --project unit src/audio/sequencer.test.ts`: 11/11 PASS.
- `npx vitest run --project unit src/app/controller.test.ts`: 8/8 PASS.
- `npx vitest run --project unit src/app/state.test.ts src/app/store.test.ts src/app/persistence.test.ts src/audio/timing.test.ts`: 26/26 PASS.
- `npm run lint`: exit 0 (3 warnings, none fatal).
- `npm run typecheck`: **exit 2** — blocking.
- `npm run build`: **exit 2** — blocking.
- `npm run check`: **exit 2** (fails at the typecheck stage) — blocking, and this is the card's own Verify step 1.
- `data-testid` survival greps, `neurons` grep, and the "no static `./audio/engine` import in `main.tsx`" regression check: all PASS.
- Read the full diffs for `sequencer.ts`, `sequencer.test.ts`, `engine.ts`, `controller.ts`, `controller.test.ts`, `App.tsx`, `main.tsx`, `ControllerContext.tsx`, and `tests/browser/boundaries.spec.ts`: scope matches the card, Decision log row and Phase 20 task checkboxes in `docs/03-IMPLEMENT.md` are present and correctly formatted, no unrelated changes found.

## For the human reviewer, once typecheck/build are fixed

- Double-check the `pending`-getter tempo-vs-preset precedence edge case noted
  above still behaves sensibly after the fix, since it wasn't exercised by any
  test.
- `npx playwright test --project=chromium` still has not been run (sandbox
  cannot bind local sockets, as recorded for Phases 16/18) — that remains the
  operator's job per the acceptance criteria instructions.

```findings
[
  { "severity": "critical", "file": "src/app/controller.test.ts", "line": 1, "issue": "unused `vi` import (TS6133) makes `npm run typecheck`, `npm run build`, and `npm run check` all fail with exit 2 — fails the regression criteria and the card's own stated Verify step 1." },
  { "severity": "critical", "file": "src/app/controller.ts", "line": 2, "issue": "unused `import type { PendingChange }` (TS6133) is the second cause of the same typecheck/build/check failure as above." },
  { "severity": "important", "file": "src/audio/sequencer.ts", "issue": "when a pending preset (with its own tempoBpm) and a subsequently-requested plain tempo change are both pending at once, the preset's tempo silently wins at apply time and the pending getter never surfaces the newer tempo request; not covered by any required test case." },
  { "severity": "suggestion", "file": "src/app/ControllerContext.tsx", "line": 11, "issue": "oxlint's react-refresh/only-export-components warns because useController() is exported alongside the ControllerProvider component from the same file; pre-existing style nit, not introduced correctness issue." }
]
```
