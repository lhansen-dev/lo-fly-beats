VERDICT: approve

## What I verified

I re-ran every command in the acceptance criteria myself (not the loop's claims) from a clean
shell in the repo root:

- **New behaviour**: `tests/browser/soak.spec.ts` exists and is gated correctly
  (`process.env.SOAK`, `test.skip(`, `30_000` ms sampling, asserts `repeatEvents`,
  `scoresHeld`, `keysActiveVoices`, and `'playing'`). `src/app/App.tsx` contains
  `instance.pause()` ahead of `engine.reset` in the Start/Restart handler and disables the
  button with `disabled={!graph || engineStatus === 'starting'}`. `playwright.config.ts` uses
  `http://127.0.0.1:4173` for both `webServer.url` and `use.baseURL`, and passes
  `--host 127.0.0.1` to the preview server. The Decision log has exactly 3 phase-16 rows
  (≥ 3 required) and mentions `EPERM`. The sequencer/diagnostics-panel/spike-deletion/
  engine-spec checklist boxes are checked.
- **Regression**: `npm run typecheck`, `npm run lint`, `npx vitest run --project unit
  src/audio/sequencer.test.ts`, `npx vitest run --project unit src/audio/timing.test.ts`, the
  full `npm run test` (80 tests across 15 files), and `npm run build` all pass. The Phase 7
  spike is fully gone (`src/audio/spike.ts`, `tests/browser/spike.spec.ts`,
  `tests/unit/audio/spike.test.ts`) with zero remaining "spike" references anywhere in `src/`
  or `tests/`. All required test IDs are present in `App.tsx` and `DiagnosticsPanel.tsx`. The
  soak box, Phase 16's final-verification box, and Phase 17's first box are correctly left
  unchecked/untouched for the operator.
- One acceptance-criterion mechanic needs a note: the literal `grep -qF '- [x] ...'` /
  `'- [ ] ...'` commands as written in the criteria fail on *any* grep (BSD and GNU alike, I
  checked both) with `invalid option -- ' '`, because the pattern starts with `-` and neither
  `-e` nor `--` precedes it — a shell/getopt quoting issue in the criteria text itself, not
  something this implementation could avoid (every phase's checklist in this doc starts with
  `- [ ]`/`- [x]`). I verified the semantic intent of each such line both with
  `grep -qF -- '...'` and independently via a Python substring check; all pass. This is an
  acceptance-criteria authoring artifact, not an implementation defect.
- I actually ran `npx playwright test --project=chromium tests/browser/engine.spec.ts` here to
  confirm the sandbox truly cannot run it: it fails with `Error: listen EPERM: operation not
  permitted 127.0.0.1:4173`, corroborating the Decision log's claim rather than just trusting
  it.
- Code review against R9/R1/R12 (required reading for this phase): `PlaybackSequencer.advance()`
  matches the documented algorithm (phrase/bar boundary handling, per-step event indexing,
  `scoresHeld` ≤ 2). `engine.ts` matches R9 rules 1–6 (`start` guarded by status + a single
  `startPromise` so only one `scheduleRepeat` is ever registered; `onStep` orders tempo →
  phraseStarted → triggers, always scheduling from the given `time`; `pause` does the
  0.08 s/0.09 s/0.12 s gain-ramp/release sequence; `reset` stops the transport, resets the
  sequencer, and sets tempo; `document.hidden` only suppresses `step`/`position` emission, not
  audio). The small `rig.ts` addition (`rampMasterGain`) is minimal, necessary plumbing for
  rule 3. No forbidden `Tone.getTransport/getDraw/Frequency/now()` calls, no `Math.random` in
  `src/`, `tone` is only imported under `src/audio/`. The diff touches exactly the 13 files the
  card describes — no unrelated changes.

## What the human reviewer should look at closely

- **Eager Tone.js bundling (important, not blocking).** `src/app/App.tsx` statically imports
  `DEFAULT_MIX` from `../audio/rig` (`import { DEFAULT_MIX } from '../audio/rig'`), and
  `rig.ts` does `import * as Tone from 'tone'` at module scope. `git show main:src/app/App.tsx`
  confirms the old spike-based `App.tsx` never imported `rig.ts` at all — this is new. I
  confirmed with `npm run build` that this pulls Tone into the eagerly-loaded entry chunk
  (`dist/assets/index-*.js`, 574.78 kB, contains Tone's console-banner string) instead of the
  lazily-loaded `engine-*.js` chunk (10.76 kB, zero Tone references), which defeats the
  `await import('../audio/engine')` dynamic import used later in the same file and reverses
  the Phase 7 Decision log's explicit, deliberate choice to dynamically import Tone only
  inside button actions. I traced Tone's actual `esm/core/Global.js`: merely importing `tone`
  does not construct a real `AudioContext` (it uses a lazy `DummyContext`, upgraded only
  inside `getContext()`), so this does not literally create an audio object before
  interaction and no acceptance criterion catches it — but it does load ~400 KB of extra JS
  and print Tone's version banner to the console on every page load, before any click. Worth
  a quick follow-up: move `DEFAULT_MIX`/`MixSettings` into a Tone-free module (or source it via
  a dynamic import alongside `getEngine`) so the main bundle stays Tone-free until Start is
  clicked.
- **No start-failure recovery path (suggestion).** If `PlaybackEngine.start()`'s internal
  `Tone.start()`/setup throws, `status` stays stuck at `'starting'` forever and
  `startPromise` keeps returning the same rejected promise, permanently disabling
  Start/Restart until reload. This is a narrow edge case the card's R9 excerpt doesn't cover
  (failure/interruption handling is explicitly out of scope for this phase and deferred to
  R12's permanent-controls work), so I'm not treating it as blocking, but it's worth a note.
- The soak spec (`tests/browser/soak.spec.ts`) and `engine.spec.ts` could not actually be
  executed here (sandbox EPERM, confirmed above) — the operator still needs to run
  `npx playwright test --project=chromium` and
  `SOAK=1 npx playwright test tests/browser/soak.spec.ts --project=chromium` per the card's
  own Verify list and record the soak result, exactly as the Decision log already says.

## Documentation

Nothing needed updating. `docs/03-IMPLEMENT.md` is already in the exact state the acceptance
criteria require (the soak box, Phase 16's final-verification box, and Phase 17's first box
are intentionally left unchecked for the operator, and I must not touch them). `docs/01-IDEAS.md`
and `docs/02-PLAN.md` are off-limits per the project's own rule (R1.8) and don't reference
per-phase completion status anyway. `README.md` is an unrelated one-line stub. No file changes
made outside `.ralph/`.

```findings
[
  { "severity": "important", "file": "src/app/App.tsx", "line": 10, "issue": "Static `import { DEFAULT_MIX } from '../audio/rig'` pulls Tone.js into the eagerly-loaded main bundle (verified via `npm run build`: 574.78 kB main chunk contains Tone's banner string, the 10.76 kB lazy engine chunk has none), reversing the Phase 7 Decision log's deliberate 'dynamically import Tone only inside button actions' rule and defeating the `await import('../audio/engine')` pattern used later in the same file; move `DEFAULT_MIX`/`MixSettings` to a Tone-free module or load it dynamically." },
  { "severity": "suggestion", "file": "src/audio/engine.ts", "line": 66, "issue": "PlaybackEngine.start() has no failure path: if the async setup throws, status stays stuck at 'starting' forever and startPromise keeps resolving to the same rejection, permanently disabling Start/Restart until page reload — narrow edge case, outside this phase's stated R9 scope." }
]
```
