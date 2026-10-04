# Lo-fly beats: implementation checklist

Created September 12, 2026. Implements [02-PLAN.md](./02-PLAN.md), which is based on [idea 21](./01-IDEAS.md#21-lofly---beats-to-buzz-to).

This checklist divides the plan into 39 small phases. Each phase is sized for one focused session by an implementation agent that has no memory of earlier sessions. It names the files to create, the behavior to implement, and the commands that show the work is correct. The **Reference** section holds the contracts, algorithms, and starting values that several phases share, so every phase builds on the same definitions.

A few facts were established while preparing this document: the MaleCNS source files and schemas were inspected, three candidate circuits were measured, and the composition rules were simulated on the real graph. The Decision log records that evidence. Everything else is implementation work that has not been done yet.

## How to work through this checklist

1. Work on the lowest-numbered phase that still has unchecked boxes. Complete phases in order.
2. Read the whole phase and every Reference section listed under **Read** before changing anything. Inspect the files earlier phases created instead of assuming their contents.
3. Implement the tasks and stay within the phase's scope. If you find a problem outside that scope, add it to the Decision log rather than fixing it quietly.
4. Run the phase's **Verify** steps. Check a box only when that task is complete and verified.
5. Add a Decision log row for every choice the phase asks you to record and for any deviation from this document.
6. Commit once per phase on the current branch with a conventional commit message that includes the phase number, including this file's updated checkboxes. Do not push.
7. **Stop and report** instead of guessing when a verification fails and you cannot fix it within the phase, when observed results differ from values stated here, or when the phase needs a decision this document does not make.
8. Phases titled **Human gate** belong to the user. Agents never check their boxes. If the next unchecked phase is a human gate, stop and report that it is waiting for the user.

## Phase overview

| Phase | Title | Milestone | Done by |
| --- | --- | --- | --- |
| 1 | Scaffold the app and tooling | 1. Scaffold and validate the inputs | Agent |
| 2 | Prepare the data environment and download the sources | 1 | Agent |
| 3 | Extract the MBON circuit | 1 | Agent |
| 4 | Verify the export and write the extraction report | 1 | Agent |
| 5 | Load and validate the circuit in TypeScript | 1 | Agent |
| 6 | Encode WAV files | 1 | Agent |
| 7 | Build the audio spike with a real traversal | 1 | Agent |
| 8 | Human gate — review the data and the audio spike | 1 | User |
| 9 | Add seeded randomness, versions, and score types | 2. Build the musical core | Agent |
| 10 | Implement seeded graph traversal | 2 | Agent |
| 11 | Define presets and harmony | 2 | Agent |
| 12 | Compose chords, bass, and keys | 2 | Agent |
| 13 | Compose drums, variation, and humanization | 2 | Agent |
| 14 | Add the timing adapter and seeded audio buffers | 2 | Agent |
| 15 | Build the instrument and effects rig | 2 | Agent |
| 16 | Build the live engine and audition page | 2 | Agent |
| 17 | Human gate — listening review | 2 | User |
| 18 | Apply the listening review | 2 | Agent |
| 19 | Add the session store and persistence | 3. Complete the player and export | Agent |
| 20 | Apply pending changes at musical boundaries | 3 | Agent |
| 21 | Build the player controls | 3 | Agent |
| 22 | Build the mixer | 3 | Agent |
| 23 | Render a phrase offline | 3 | Agent |
| 24 | Build the export flow | 3 | Agent |
| 25 | Handle loading, errors, and interruptions | 3 | Agent |
| 26 | Build the layout shell and visual tokens | 4. Build the scene and explanation | Agent |
| 27 | Draw the room, window, desk, and banana | 4 | Agent |
| 28 | Draw the fly | 4 | Agent |
| 29 | Human gate — scene art review | 4 | User |
| 30 | Apply the scene art review | 4 | Agent |
| 31 | Animate the scene from musical cues | 4 | Agent |
| 32 | Build the "How the beat is made" panel | 4 | Agent |
| 33 | Add credits, copy, and the asset manifest | 4 | Agent |
| 34 | Complete keyboard and accessibility support | 4 | Agent |
| 35 | Cover the acceptance criteria with tests | 5. Validate and prepare release | Agent |
| 36 | Check performance budgets and the production preview | 5 | Agent |
| 37 | Write the README and data regeneration guide | 5 | Agent |
| 38 | Human gate — release validation | 5 | User |
| 39 | Apply release fixes and produce the final build | 5 | Agent |

## Decision log

Rows dated September 12, 2026 with phase "Prep" were decided while writing this checklist. Agents append new rows at the end of the table.

| Date | Phase | Decision | Reason or evidence |
| --- | --- | --- | --- |
| 2026-09-12 | Prep | Use all 97 MaleCNS neurons annotated `class == "MBON"` (mushroom body output neurons), keep connections with at least 3 synapses, and remove self-connections. | User's choice after measuring three candidates. This subset has 936 connections, a 92-neuron strongly connected core, and 5 dead ends, meeting the plan's 32–128 neuron and 2,000-edge targets. The compass circuit (EPG/PEN/PEG, 106 neurons) needs at least 15 synapses per connection to fit under 2,000 edges. The clock network (52 neurons) splits into 7 components at 3 synapses. |
| 2026-09-12 | Prep | Chords change every two bars. The neuron at each two-bar slot chooses a chord by cell type, and an immediate repeat moves one position around an authored six-chord ring (`MAPPING_VERSION` 1). | Simulated on the real graph with the plan's `alpha = 2 - 1.5 * variation`. Choosing one chord per bar by type held a single chord for 7 of 8 bars in 129 of 300 seeds at variation 0. The two-bar ring rule averaged 3.0 distinct chords per phrase at variation 0 and 3.4 at variation 1, with no chord lasting longer than two bars. |
| 2026-09-12 | Prep | Agents draw the scene as layered inline SVG; the user approves it at Phase 29. | User's choice. |
| 2026-09-12 | Prep | Use four human gates: Phases 8, 17, 29, and 38. | User's choice to stop at each gate, plus the scene art approval that goes with SVG art. |
| 2026-09-12 | Prep | Export renders with `new Tone.OfflineContext(2, seconds, 44100)` and passes that context explicitly to every node. It does not use `Tone.Offline`. | In Tone 15.1.22, `Tone.Offline` replaces the global context while its callback runs, which could affect the live engine. Phase 7 confirms explicit contexts work. |
| 2026-09-12 | Prep | Drum hits, rain, vinyl crackle, and the reverb impulse response are generated as seeded buffers in TypeScript. | Tone's `Noise`, `NoiseSynth`, and `Reverb` call `Math.random`; the plan requires seeded noise so exports are repeatable. |
| 2026-09-12 | Prep | Follow the `create-vite@9.2.1` `react-ts` template (Vite 8, React 19, TypeScript ~6.0, oxlint), plus `tone@15.1.22`, Vitest 5 with browser mode, Playwright 1.63, and Python 3.12 managed by uv. | Current stable releases on npm on 2026-09-12. Node 22.22, uv 0.11, and Python 3.12 are installed locally. |
| 2026-09-12 | Prep | Serve the app with Vite `base: './'` so the same build works at a domain root or in a subdirectory. | The plan requires deployment-base-aware paths, and no host has been chosen. |
| 2026-09-19 | 1 | Use conventional commit messages with phase numbers, one commit per phase. | The user explicitly requested conventional commits; this supersedes the original `Phase N:` message format. |
| 2026-09-19 | 1 | Resolved `react@19.3.0`, `vite@8.3.0`, `@vitejs/plugin-react@6.1.1`, `typescript@6.0.3`, `oxlint@1.83.0`, `vitest@5.0.1`, and `zod@4.6.5`; preserve the template TypeScript range `~6.0.2`. | Versions read from `package-lock.json`. Clean `npm ci`, `npm run check`, and the production preview title check passed on Node 22.22.3. |
| 2026-09-19 | 2 | Read connection row counts directly from IPC message metadata and skip data bodies; add three focused Python source-tool tests and ignore Python bytecode. | Both source sizes and MD5 checksums match R3. The second download run skips both files and leaves retrieval metadata byte-identical. The schema report reproduces all R3 row, batch, type, and side counts. Tests cover corrupt caches, failed-download cleanup, and compressed/dictionary/empty-batch metadata. Python 3.12.14, pyarrow 25.0.1, pandas 3.0.6, and networkx 3.6.1 are locked. |
| 2026-09-19 | 3 | Extract all configured MBON neurons, scan connections in Arrow batches, and serialize both outputs deterministically. The manifest retrieval date is the latest input retrieval date if they differ. | Counts, threshold comparisons, self-connection removal, all eight starts, and both example records match R3. Two extractions produced identical SHA-256 hashes for both files. The output has 97 neurons, 936 connections, and 25,379 synapses. |
| 2026-10-01 | 21 | Guard player-control `useAppState` selectors with a static-render snapshot-stability test that evaluates each selector twice against the same state and requires `Object.is` equality. | Emulates React's external-store snapshot stability check without mounting a browser root; statically renders every player control. |
| 2026-09-19 | 4 | Independently verify all retained weights as well as the required 20 samples, annotation records, checksums, and complete connection set. | `npm run data:verify` passes: 20/20 samples, 97/97 annotation records, all 936 retained weights, manifest counts, threshold comparisons, and starts agree with upstream data. The report identifies four MBON10 dead ends and one MBON15 dead end, with out-degree median 7, p90 22, and maximum 41. |
| 2026-09-19 | 5 | Validate both JSON schemas, graph invariants, verified checksums, and circuit byte length before exposing the graph. Deduplicate the temporary app load across React StrictMode effects. | `npm run check` passes with 31 unit/data tests. Loader tests cover root, relative, and subdirectory bases plus network/schema/checksum failures. Deliberately changing one committed synapse count makes `data:validate` fail with a checksum mismatch; the original file was restored. No React or Tone imports occur in `src/connectome/`. |
| 2026-09-19 | 6 | Encode and inspect canonical 44-byte, 16-bit PCM WAV files, with explicit invalid-input and header-size checks. | `npm run check` passes with 43 tests, including exact stereo header values, signed sample conversion/clamping, interleaving, mono round trips, peak detection, invalid channel/rate/sample rejection, and truncated-file rejection. |
| 2026-09-19 | 7 | Render the spike with `new Tone.OfflineContext(2, 3, 44100)` and explicit contexts on the synth and destination. No fallback to `Tone.Offline` was needed. | All three browser tests render successfully with no page errors and can restart live playback afterward. Each WAV has 132,300 frames, 2 channels, 44,100 Hz, 16-bit PCM, and 529,200 data bytes. Offline synth, buffer, and context are disposed. |
| 2026-09-19 | 7 | Dynamically import Tone only inside button actions; keep the temporary MIDI-to-Hz conversion in the spike until the shared timing adapter is introduced. | Tone 15.1.22's entry point initializes its global context on import, so an eager import would create audio before interaction. The app owns one start operation and revokes replaced/unmounted download URLs. `npm run check` passes with 45 unit/data tests, including strongest-edge, tie-order, and dead-end traversal checks. |
| 2026-09-19 | 7 | Chromium 153.0.8010.12 (Playwright 1.63.0, headless): pass. | Live context becomes running after Play, Stop works, WAV download is 3 seconds with peak 5,102, and playback works again after export. Human listening and the two-minute background-tab check remain Phase 8. |
| 2026-09-19 | 7 | Firefox 155.0 (Playwright 1.63.0, headless): pass. | Live context becomes running after Play, Stop works, WAV download is 3 seconds with peak 5,103, and playback works again after export. Human listening and the two-minute background-tab check remain Phase 8. |
| 2026-09-19 | 7 | WebKit 26.6 (Playwright 1.63.0, headless): pass. | Live context becomes running after Play, Stop works, WAV download is 3 seconds with peak 5,103, and playback works again after export. This does not replace the Phase 8 review in desktop Safari. |
| 2026-09-30 | 8 | User approved continuing to Phase 9: "ah yeah it's good. continue". | Approval was given in conversation after the Phase 8 review request. A fresh Luna baseline audit passed `npm run check` (45 unit/data tests) and all three Playwright browser projects. Detailed manual browser versions and results were not supplied; the human checklist remains available for the user to record them. |
| 2026-09-30 | 12 | Keep per-bar reuse and embellishment decisions in a local rhythm plan during phrase composition. | This consumes the R7 rhythm draws in the required order while keeping `PhraseScore` limited to its documented fields; Phase 13 can add embellishment notes while processing that local plan. |
| 2026-09-30 | 13 | Advance `MAPPING_VERSION` from 1 to 2 when drums, embellishments, and humanization begin changing composed events. | R1 rule 4 requires a mapping version bump whenever composition output changes. Historical traversal vectors and the Phase 10 traversal test retain their explicit version-1 seed text; current composition streams use version 2. |
| 2026-09-30 | 13 | Complete the delayed Phase 13 verification. | `npm run check` passes: typecheck, lint, 78 unit tests, 5 data validation tests, and the production build. |
| 2026-09-30 | 14 | Use one named seeded stream per buffer and consume successive draws for stereo channels; place rain drips and crackle clicks at deterministic random sample positions. Smooth the final 1 ms of looped ambience toward its first sample after the prescribed equal-power overlap. | R5 pins each stream to `buffer|${name}|${sampleRate}`. The 44.1 kHz rain seam measured 0.172 after the required overlap and peak scaling; smoothing the final 1 ms brought it below the specified 0.1 threshold. The six 48 kHz buffers generated in 48.1 ms. |
| 2026-09-30 | 15 | Ramp bass cutoff changes through a Tone `Multiply` node on the filter-envelope signal. | Tone's `FrequencyEnvelope.baseFrequency` setter changes immediately and has no automation API. Scaling its output preserves the configured envelope and applies the required 0.5 s ramp using the supplied audio context. |
| 2026-09-30 | 15 | Pin `@vitest/browser-playwright` to 5.0.1 to match the repository's `vitest` 5.0.1. | The `@5` install range resolved 5.0.3, whose exact Vitest peer conflicts with 5.0.1. Using 5.0.1 keeps the peer graph aligned and `npm ls` clean. |
| 2026-09-30 | 16 | Phase 16 Verify steps 3 and 4 could not be run because the sandbox denies the local server bind (`listen EPERM ... ::1:4173`); the soak box and final verification box stay unchecked for the user to complete. | Playwright Chromium and the 5-minute soak require the blocked local server. |
| 2026-09-30 | 16 | Change the Playwright `webServer` command, `url`, and `baseURL` to `127.0.0.1:4173` instead of `localhost:4173`. | Node resolved `localhost` to the blocked IPv6 loopback. |
| 2026-09-30 | 16 | Audition page Start / Restart pauses a playing engine before `engine.reset(recipe)` so `engine.play()` can resume. | R9 defines `reset` for the paused state and `play()` only resumes from `paused`. |
| 2026-10-01 | 17 | User closed the Phase 17 listening gate with a blanket approval and no concrete requests: "lgtm, do your best to continue without my feedback". Phase 18 therefore changes no code. | Approval was given in conversation while Phase 17's Listening notes were still empty, matching the Phase 8 precedent ("ah yeah it's good. continue"). Phase 17's seven checkboxes and its Listening notes line stay user-owned records; no agent listened to the audio. |
| 2026-10-01 | 20 | Apply pending tempo at the next bar and pending variation, New beat, and preset at the next phrase through `PlaybackSequencer.request`/`applyTempoNow`, the engine's `request`/`applyTempoNow`/`EngineLike`, and the new `SessionController`. | `npx playwright test --project=chromium` (Verify step 2) could not be run because this sandbox denies local socket binds, the same limitation recorded for Phases 16 and 18; Phase 20's final verification box stays unchecked for the operator. |
| 2026-10-01 | 18 | Phase 18 verification: npm run check passed, npm run test:audio failed, and npx playwright test --project=chromium failed, which failed with: listen EPERM: operation not permitted ::1:63315; preview server listen EPERM: operation not permitted 127.0.0.1:4173. The final verification box stays unchecked. | Reporting the failure instead of checking the box, as Phase 16's Decision log row did for the same sandbox limitation when the local preview server could not be bound. |
| 2026-10-01 | 18 | No code changed in Phase 18: MAPPING_VERSION stays at 2 and DEFAULT_SESSION_SEED stays at 1 in src/music/versions.ts, the three presets in src/presets/presets.ts keep their tempo and swing values, and R5, R7, R8, and R10 are unchanged, because the Phase 17 listening approval contained no concrete requests. | The Phase 17 gate closed with a blanket approval ("lgtm, do your best to continue without my feedback") that named no sound parameter, no preset change, no composition rule, no default seed, and no sample-based voice, so every conditional Phase 18 task resolved to no change and tests/data/compose-snapshot.test.ts needed no new snapshot. |
| 2026-10-01 | 18 | Re-ran Phase 18 Verify steps 2 and 3 after the review: npm run test:audio and npx playwright test --project=chromium both still fail with listen EPERM: operation not permitted (vitest browser mode binds ::1 and the Playwright preview server binds 127.0.0.1:4173), so Phase 18's final verification box stays unchecked and both steps still need to be run outside the sandbox by the operator or CI before it can be ticked. | This sandbox denies every local socket bind, the same limitation recorded for Phase 16 on 2026-09-30; Verify step 1 npm run check passes and Phase 18's only diff is in docs/03-IMPLEMENT.md, so nothing in this phase can cause or fix the bind failure. Checklist rule 7 says to stop and report rather than guess. |
| 2026-10-03 | 21 | Replaced the audition page with `StartListening`, `TransportControls`, `TempoControl`, `VariationControl`, `NewBeatButton`, `PresetPicker`, `NowPlaying`, and `PendingChanges`. `circuit-status` stays in `App.tsx` until Phase 25 adds `CircuitStatus.tsx`; extra `now-playing`, `seed-hex`, and `scene-placeholder` test IDs were added alongside the R12 table. `npx playwright test --project=chromium` could not run because this sandbox denies local socket binds; the final verification box stays unchecked for the operator. | Same local socket-bind limitation recorded for Phases 16, 18, and 20. |
| 2026-10-04 | 22 | Mixer sliders use percentage UI values; `TransportControls` mounts the only `MasterVolume`. Ambience players start during playback when `ambienceOn` is true and stop when disabled or paused. Real audio and Chromium verification remain operator-owned. | Scoped strict audio-test compilation, `npm run build`, `npm run check`, and all mixer correction/regression checks pass. `npm run test:audio` and `npx playwright test --project=chromium` fail before assertions with socket-bind `EPERM` on `::1:63315` and `127.0.0.1:4173`, respectively; the Phase 22 final verification box stays unchecked until both runtime suites pass on an allowed runner. |
| 2026-10-04 | 23 | Fade copied export PCM linearly over its final 0.5 seconds; add deterministic mocked fade tests and real Tone render coverage. | Browser/loopback audio verification is unavailable in this sandbox. Node-based targeted mocked tests are the development check; the authored real-audio tests, including onset, ambience, repeatability, and final RMS, remain for operator verification. |
| 2026-10-04 | 24 | The controller injects `renderPhrase`/`createObjectUrl`/`revokeObjectUrl` for tests, revokes the previous URL at the start of each export and on Done, and reports `objectUrlsHeld` in diagnostics. | Evaluator verification: `npm run check` passes (174 Node unit tests), and targeted controller, panel/controls, and engine/state/WAV unit checks pass. `npm run test:audio` and `npm run test:browser` (Chromium, Firefox, WebKit) were not run — Firefox and WebKit results: not run, sandbox — because the sandbox denies local socket binds and the operator dropped browser checks from this card's verification; `tests/browser/export.spec.ts` is authored and typechecked only, and Verify steps 2–3 remain for the operator. |

| 2026-10-04 | 25 | Draw callbacks and transport steps are invalidated with a `playbackGeneration` counter on interruption; extra test IDs `audio-notice` and `storage-note` were added beside the R12 table. | `npx tsc -b` and `npx oxlint tests/browser/failures.spec.ts` pass. `npx vitest` and `npx playwright test --project=chromium` could not run because this sandbox denies local socket binds, so the final verification box stays unchecked for the operator. |
| 2026-10-04 | 26 | Below 700 px, the bottom bar uses `position: fixed` because a sticky bar inside TransportControls would scroll away with its parent; `data-testid="scene-frame"` replaces `scene-placeholder`; the 1.5 s custom-property transition is deferred to Phase 31's lighting-transition task. | Token contrast and layout rules are checked by `tests/unit/styles/*.test.ts`. Playwright could not run in the sandbox, so the verification box stays unchecked for the operator. |

## Reference

### R1. Stack, layout, and code rules

**Tools and versions**

| Tool | Policy |
| --- | --- |
| Node.js | Node 22 LTS. Commit `.nvmrc` containing `22`, and set `"engines": { "node": ">=22.12.0" }`. |
| Package manager | npm, with `package-lock.json` committed. Install new packages with `npm install --save-exact`. |
| Application | `create-vite@9.2.1` `react-ts` template: React 19, Vite 8, `@vitejs/plugin-react` 6, TypeScript `~6.0`, and oxlint. Keep the template's TypeScript range. |
| Audio | `tone@15.1.22` exactly. Do not use Tone's `next` dist-tag. |
| Validation | `zod` 4. |
| Unit tests | `vitest` 5 in the Node environment. |
| Audio tests | Vitest browser mode with `@vitest/browser-playwright` 5 and headless Chromium. |
| End-to-end tests | `@playwright/test` 1.63 against the production preview. `@axe-core/playwright` 4 is added in Phase 34. |
| Data preparation | Python 3.12 managed by uv in `scripts/data/`, with `pyarrow`, `pandas`, and `networkx` locked in `scripts/data/uv.lock`. |

**Directory layout**

```text
src/
  app/          App shell, store, persistence, session controller
  components/   Player controls, mixer, export, explanation, credits, diagnostics
  scene/        Inline SVG scene, fly character, animation cues
  connectome/   Circuit types, schema, loading, graph building
  music/        RNG, traversal, harmony, patterns, composer
  audio/        Timing, buffers, WAV, instrument rig, sequencer, engine, export
  presets/      Preset definitions
  styles/       CSS tokens and layout
public/data/circuits/mbon-v1/
  circuit.json
  manifest.json
scripts/data/   uv project, config/, reports/, Python scripts, .cache/ (ignored)
tests/
  fixtures/     Small hand-checkable graphs
  data/         Node checks of the committed circuit
  audio/        Vitest browser-mode tests that need Web Audio
  browser/      Playwright end-to-end specs
docs/           01-IDEAS.md, 02-PLAN.md, 03-IMPLEMENT.md
```

Unit tests that use no Node built-in modules sit beside their module as `*.test.ts`. Tests that import `node:*` modules live under `tests/`.

**Code rules**

1. `src/music/` and `src/connectome/` never import `react` or `tone`. `src/music/` uses no DOM or browser APIs. `src/connectome/load.ts` may use `fetch`, `TextDecoder`, and `crypto.subtle`.
2. Only files in `src/audio/` import `tone`. Engine and rig code always uses the context it was given (`context.transport`, `context.draw`, `context.destination`). It never calls `Tone.getTransport()`, `Tone.getDraw()`, `Tone.Frequency()`, or `Tone.now()`, because those read the global context. Convert MIDI notes with `midiToHz` from R9.
3. `Math.random` is not allowed anywhere in `src/`. Composition, animation, jokes, and buffers use the seeded streams in R5. The New beat seed comes from `crypto.getRandomValues`.
4. Composition is deterministic. Any change that alters a composed event or trace increments `MAPPING_VERSION` in the same commit and updates the affected snapshot tests.
5. React render functions and mount effects never create audio objects. The first **Start listening** click creates the engine (R9).
6. The committed MBON circuit is the application's only data source. The app never falls back to a fixture graph; it shows an error (R12).
7. The template enables `erasableSyntaxOnly`, so do not use `enum`, `namespace`, or constructor parameter properties. Declare class fields explicitly.
8. Do not edit `docs/01-IDEAS.md` or `docs/02-PLAN.md`. Record deviations in this file's Decision log.
9. Skipping or deleting a test requires a Decision log row explaining why.
10. When a phase replaces temporary code, such as the audio spike or the audition page, delete the old code in that phase.

### R2. Commands

Create each script in the phase shown. Use these names exactly.

| Script | Command | Phase |
| --- | --- | --- |
| `dev` | `vite` | 1 |
| `build` | `tsc -b && vite build` | 1 |
| `preview` | `vite preview --port 4173 --strictPort` | 1 |
| `typecheck` | `tsc -b` | 1 |
| `lint` | `oxlint` | 1 |
| `test` | `vitest run --project unit` | 1 |
| `check` | `npm run typecheck && npm run lint && npm run test && npm run build` | 1; Phase 5 inserts `npm run data:validate` before `npm run build` |
| `data:download` | `uv run --project scripts/data python scripts/data/download_sources.py` | 2 |
| `data:extract` | `uv run --project scripts/data python scripts/data/extract_circuit.py` | 3 |
| `data:verify` | `uv run --project scripts/data python scripts/data/verify_circuit.py` | 4 |
| `data:validate` | `vitest run --project unit tests/data` | 5 |
| `test:browser` | `playwright test` | 7 |
| `test:audio` | `vitest run --project audio` | 15 |
| `budget` | `node scripts/measure-budgets.mjs` | 36 |

Install the test browsers once per machine with `npx playwright install chromium firefox webkit`. Playwright and Vitest browser mode share them.

### R3. Source data facts

These facts were verified on September 12, 2026, against the [MaleCNS download page](https://male-cns.janelia.org/download/) and the files themselves.

| Role | File | Bytes | MD5, base64 |
| --- | --- | --- | --- |
| Annotations | `body-annotations-male-cns-v1.0-minconf-0.5.feather` | 14,483,314 | `UKdxh3DFciDxYLpPQxq4ng==` |
| Connections | `connectome-weights-male-cns-v1.0-minconf-0.5.feather` | 1,051,241,946 | `8w6dzKJc/QIb8eez2XVZng==` |

Both files are at `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/<file name>` and need no account or token. Google Cloud Storage reports the MD5 values above in its `x-goog-hash` header. The connections file took about 90 seconds to download during preparation.

- **Annotations:** 211,577 rows, one per body. The extraction uses `bodyId` (int64) and the string columns `type`, `instance`, `class`, `superclass`, `somaSide`, and `status`. Missing values are null.
- **Connections:** an Arrow IPC (Feather v2) file with 2,318 record batches and 151,856,684 rows. Columns are `body_pre` (int64), `body_post` (int64), and `weight` (int64 synapse count). Each row is one ordered pair of bodies; the table has no per-region rows. Read it one record batch at a time with `pyarrow.memory_map`, `pyarrow.ipc.open_file`, and `pyarrow.compute.is_in` on both body columns. A full scan took about 3 seconds. Do not load the whole table into pandas, which needs roughly 3.6 GB of memory.

**Expected MBON results.** These values were computed during preparation. The extraction must reproduce them exactly. If it does not, stop and report the difference instead of changing code to match.

| Measure | Value |
| --- | --- |
| Neurons with `class == "MBON"` | 97 neurons of 37 types: 48 with `somaSide` L and 49 with R. All have `status == "Traced"` and non-null `type`, `instance`, `class`, `superclass`, and `somaSide`. |
| Connected ordered pairs among them | 1,606 at any weight, including 1 self-connection with weight 1 |
| Connections without self-connections | 1,605 at ≥1 synapse; 936 at ≥3; 682 at ≥5 |
| Largest strongly connected component | 97 neurons at ≥1; 92 at ≥3; 82 at ≥5 |
| Dead ends (no outgoing connection) | 0 at ≥1; 5 at ≥3; 11 at ≥5 |
| Chosen threshold, ≥3 synapses | 936 connections totaling 25,379 synapses; 1 weakly connected component; no isolated neurons; dead ends are 4 MBON10 neurons and 1 MBON15 neuron; out-degree median 7, 90th percentile 22, maximum 41 |
| Start neurons (rule in R4) | `10704` (MBON11), `519373` (MBON03), `10013` (MBON01), `13768` (MBON12), `10495` (MBON05), `522749` (MBON02), `21242` (MBON09), `513174` (MBON30) |
| Example records | Neuron `10013`: type `MBON01`, instance `MBON01(y5B'2a)_R`, class `MBON`, superclass `cb_intrinsic`, somaSide `R`. Connection `10013` → `10495` with 16 synapses. |

**Attribution.** The dataset is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit the MaleCNS collaboration: FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research. Cite the preprint:

> Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the *Drosophila* male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999

Also link the published paper listed on the [MaleCNS site](https://male-cns.janelia.org/): https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6. Do not add citation details that are not given here.

### R4. Circuit files and graph contract

The circuit is two files: `public/data/circuits/mbon-v1/circuit.json` and `public/data/circuits/mbon-v1/manifest.json`. The app loads them from `` `${import.meta.env.BASE_URL}data/circuits/mbon-v1/` ``.

**Serialization rules for the Python writer**

- IDs are decimal strings matching `^[1-9][0-9]*$`.
- Sort neurons by numeric ID. Sort connections by numeric `source`, then numeric `target`.
- Write object keys in exactly the order shown in the examples.
- Write UTF-8 text with `json.dumps(obj, indent=2, ensure_ascii=False)` followed by one newline.
- Write unknown annotation values as `null`; never omit the key.
- `synapseCount` is the upstream `weight` value, unchanged.
- `manifest.output.sha256` is the lowercase hexadecimal SHA-256 of the exact `circuit.json` bytes.

**`circuit.json`** (one real neuron and connection shown)

```json
{
  "schemaVersion": 1,
  "circuitId": "mbon-v1",
  "neurons": [
    {
      "id": "10013",
      "type": "MBON01",
      "instance": "MBON01(y5B'2a)_R",
      "class": "MBON",
      "superclass": "cb_intrinsic",
      "somaSide": "R"
    }
  ],
  "connections": [
    { "source": "10013", "target": "10495", "synapseCount": 16 }
  ]
}
```

**`manifest.json`** (values in angle brackets are computed by the script; all other values are fixed)

```json
{
  "schemaVersion": 1,
  "circuitId": "mbon-v1",
  "title": "Mushroom body output neurons",
  "description": "All MaleCNS v1.0 neurons annotated as mushroom body output neurons (class MBON), with the directed connections among them that have at least 3 synapses.",
  "source": {
    "dataset": "MaleCNS",
    "release": "male-cns:v1.0",
    "homepage": "https://male-cns.janelia.org/",
    "downloadPage": "https://male-cns.janelia.org/download/",
    "citation": "Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999",
    "paperUrl": "https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6",
    "retrievedOn": "<YYYY-MM-DD when the files were downloaded>",
    "files": [
      {
        "role": "annotations",
        "name": "body-annotations-male-cns-v1.0-minconf-0.5.feather",
        "url": "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather",
        "bytes": 14483314,
        "md5Base64": "UKdxh3DFciDxYLpPQxq4ng==",
        "sha256": "<hex>"
      },
      {
        "role": "connections",
        "name": "connectome-weights-male-cns-v1.0-minconf-0.5.feather",
        "url": "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather",
        "bytes": 1051241946,
        "md5Base64": "8w6dzKJc/QIb8eez2XVZng==",
        "sha256": "<hex>"
      }
    ]
  },
  "license": {
    "name": "CC BY 4.0",
    "url": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Connectome data from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Filtered to mushroom body output neurons and connections with at least 3 synapses."
  },
  "extraction": {
    "script": "scripts/data/extract_circuit.py",
    "scriptVersion": 1,
    "config": "scripts/data/config/mbon-v1.json",
    "configSha256": "<hex>",
    "neuronSelection": "annotations.class == \"MBON\"",
    "minSynapseCount": 3,
    "selfConnectionsRemoved": 1,
    "rules": [
      "Selected every body whose annotation class is MBON.",
      "Kept connections whose source and target are both selected bodies.",
      "Removed self-connections before applying the synapse threshold.",
      "Kept connections with at least 3 synapses; synapseCount is the upstream weight value, unchanged.",
      "Rejected duplicate pairs, missing endpoints, and non-positive counts.",
      "Recorded missing annotation values as null."
    ],
    "thresholdComparison": [
      { "minSynapseCount": 1, "connections": 1605, "largestStronglyConnected": 97, "deadEnds": 0 },
      { "minSynapseCount": 3, "connections": 936, "largestStronglyConnected": 92, "deadEnds": 5 },
      { "minSynapseCount": 5, "connections": 682, "largestStronglyConnected": 82, "deadEnds": 11 }
    ],
    "startNeuronRule": "Within the largest strongly connected component, order neurons by out-degree (descending), total outgoing synapses (descending), and numeric ID (ascending); take the first neuron of each type until 8 are chosen."
  },
  "counts": {
    "neurons": 97,
    "cellTypes": 37,
    "connections": 936,
    "synapses": 25379,
    "largestStronglyConnected": 92,
    "weaklyConnectedComponents": 1,
    "deadEnds": 5
  },
  "startNeuronIds": ["10704", "519373", "10013", "13768", "10495", "522749", "21242", "513174"],
  "output": { "file": "circuit.json", "bytes": "<integer>", "sha256": "<hex>" }
}
```

`output.bytes` is a JSON integer, not a string.

**TypeScript contract.** Put types in `src/connectome/types.ts` and zod schemas in `src/connectome/schema.ts`. Define `CircuitManifest` and `CircuitFile` as the zod-inferred types of the two JSON files.

```ts
export interface Neuron {
  id: string;
  type: string | null;
  instance: string | null;
  class: string | null;
  superclass: string | null;
  somaSide: string | null;
}

export interface Connection {
  source: string;
  target: string;
  synapseCount: number;
}

export interface OutEdge {
  target: string;
  synapseCount: number;
}

export interface CircuitGraph {
  manifest: CircuitManifest;
  checksum: string; // manifest.output.sha256, verified by the loader
  neurons: ReadonlyMap<string, Neuron>; // iteration order is sorted ID order
  outgoing: ReadonlyMap<string, readonly OutEdge[]>; // every neuron has an entry, sorted by target ID
  startNeuronIds: readonly string[]; // manifest order
}

export type CircuitErrorCode = 'network' | 'checksum' | 'schema' | 'integrity';

export class CircuitError extends Error {
  readonly code: CircuitErrorCode;
  constructor(code: CircuitErrorCode, message: string) {
    super(message);
    this.name = 'CircuitError';
    this.code = code;
  }
}
```

`compareIds(a, b)` orders numeric ID strings: `a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)`.

`buildGraph(manifest, circuit, checksum)` validates in this order. Zod failures throw `CircuitError('schema', …)`; every other failure throws `CircuitError('integrity', …)` with a message naming the offending ID or pair.

1. Both files parse with their schemas, both have `schemaVersion` 1, and their `circuitId` values match.
2. Neuron IDs are unique and sorted by `compareIds`.
3. Connections are sorted by source, then target. There are no duplicate pairs and no self-connections, both endpoints exist, and each `synapseCount` is an integer of at least `manifest.extraction.minSynapseCount`.
4. The neuron count, connection count, and synapse total equal `manifest.counts.neurons`, `.connections`, and `.synapses`.
5. `startNeuronIds` is non-empty and unique, and every ID exists and has at least one outgoing connection.

`loadCircuit(baseUrl: string, fetchImpl = fetch): Promise<CircuitGraph>` fetches the manifest, then fetches `circuit.json` as an `ArrayBuffer`. It computes SHA-256 with `crypto.subtle.digest` and compares it with `manifest.output.sha256`, throwing `checksum` on mismatch. It decodes the bytes as UTF-8, parses JSON (a parse failure is `schema`), and calls `buildGraph`. Rejected fetches and non-OK responses throw `network`.

### R5. Deterministic randomness and versions

`src/music/versions.ts`:

```ts
export const ENGINE_VERSION = '1.0.0';
export const MAPPING_VERSION = 2;
export const SCORE_VERSION = 1;
export const DEFAULT_SESSION_SEED = 1; // Phase 18 may replace this with a seed chosen at the listening review
```

`src/music/rng.ts` must match these implementations exactly:

```ts
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  float(): number; // [0, 1)
  int(maxExclusive: number): number; // Math.floor(float() * maxExclusive)
  pick<T>(items: readonly T[]): T; // items[int(items.length)]; throws on an empty array
}

export function createRng(seedText: string): Rng; // wraps mulberry32(fnv1a32(seedText))
```

**Test vectors**

| Call | Result |
| --- | --- |
| `fnv1a32('')` | `2166136261` |
| `fnv1a32('a')` | `3826002220` |
| `fnv1a32('lofly')` | `1946705213` |
| `fnv1a32('MBON11')` | `3910212617` |
| `fnv1a32('1\|0\|1\|traversal')` | `488098365` |
| First three values from `mulberry32(1)` | `0.6270739405881613`, `0.002735721180215478`, `0.5274470399599522` |
| First three values from `mulberry32(0xdeadbeef)` | `0.9413696140982211`, `0.26719574979506433`, `0.772033357527107` |

**Streams.** Each purpose has its own stream, so draws for one purpose never shift another's. Pass these seed texts to `createRng`:

```text
traversal   `${sessionSeed}|${compositionPhraseIndex}|${MAPPING_VERSION}|traversal`   graph walk (R6)
rhythm      `${sessionSeed}|${compositionPhraseIndex}|${MAPPING_VERSION}|rhythm`      motif reuse, embellishments, fills (R7)
humanize    `${sessionSeed}|${compositionPhraseIndex}|${MAPPING_VERSION}|humanize`    velocity and timing variation (R7)
animation   `${sessionSeed}|animation`                                                 blinks, hand-rub choices, rain layout (R13)
jokes       `${sessionSeed}|jokes`                                                     status joke selection (R14)
buffers     `buffer|${name}|${sampleRate}`                                             drum, ambience, and impulse-response buffers (R10)
```

The current mapping version is 2, advanced in Phase 13 when drums, embellishments, and humanization began changing composed events. The explicit version-1 seed strings in the R5 vectors and historical traversal test remain fixed regression vectors.

- `sessionSeed` is an unsigned 32-bit integer. **New beat** creates one with `crypto.getRandomValues(new Uint32Array(1))[0]`. Display it, and use it in file names, as 8 lowercase hexadecimal digits (`seedHex`).
- `compositionPhraseIndex` is `0` when `variation === 0` and `phraseIndex` otherwise, so at variation 0 every phrase repeats phrase 0.
- A first visit with no saved settings uses `DEFAULT_SESSION_SEED`.

### R6. Graph traversal

`src/music/traversal.ts` exports:

```ts
export type WalkStep =
  | { beat: number; kind: 'start' | 'restart'; neuronId: string }
  | { beat: number; kind: 'edge'; neuronId: string; from: string; synapseCount: number; probability: number }
  | { beat: number; kind: 'rest'; neuronId: null };

export function walkPhrase(graph: CircuitGraph, rng: Rng, variation: number): WalkStep[]; // always 32 steps
```

A phrase is 8 bars of 4 beats. The walk takes one step per beat:

1. `alpha = 2 - 1.5 * clamp(variation, 0, 1)`.
2. Beat 0: `{ kind: 'start', neuronId: rng.pick(graph.startNeuronIds) }`.
3. For beats 1 to 31, let `prev` be the previous step.
   - If `prev.kind === 'rest'`, or `prev`'s neuron has no outgoing edges: on a bar boundary (`beat % 4 === 0`) emit `{ kind: 'restart', neuronId: rng.pick(graph.startNeuronIds) }`; otherwise emit `{ kind: 'rest', neuronId: null }`.
   - Otherwise take `edges = graph.outgoing.get(prev.neuronId)`, which is already sorted by target. Let `weights[i] = edges[i].synapseCount ** alpha` and `total` be their sum. Draw `r = rng.float() * total` and choose the first index whose running sum exceeds `r`, or the last index if none does. Emit `{ kind: 'edge', neuronId: target, from: prev.neuronId, synapseCount, probability: weights[i] / total }`.
4. The RNG is consumed in exactly this order: one `pick` for the start, one `float` per `edge` step, and one `pick` per `restart`. `rest` steps consume nothing.

Every bar therefore begins with a neuron: a start, a restart, or an edge. A dead end at beat `b` produces rests until the next bar boundary, then a restart. Restarts and phrase starts are authored resets, not biological connections, and the explanation panel labels them that way.

### R7. Composition, mapping version 2

These rules are the authored musical system. The graph chooses among authored options; it does not produce pitches directly. Listening review may change the values, and any change that alters output increments `MAPPING_VERSION`.

**Types** (`src/music/types.ts`)

```ts
export type Layer = 'drums' | 'bass' | 'keys';
export type DrumVoice = 'kick' | 'snare' | 'hat';

export interface SessionRecipe {
  recipeVersion: 1;
  presetId: PresetId;
  sessionSeed: number; // unsigned 32-bit integer
  variation: number; // 0..1; the UI shows 0..100
  tempoBpm: number; // integer 60..100; composition ignores it
}

export interface NoteEvent {
  layer: Layer;
  step: number; // 0..127, the sixteenth-note index within the phrase
  microOffset: number; // 0 <= value < 0.25, in sixteenth-note steps (humanized lateness)
  durationSteps: number; // > 0, and step + durationSteps <= 128
  midi: number | null; // null for drums
  drum: DrumVoice | null; // null for bass and keys
  velocity: number; // 0 < value <= 1
  traceBeat: number | null; // trace index of the neuron that chose the note; null for authored drums
}

export interface ChordSlot {
  bar: 0 | 2 | 4 | 6;
  traceBeat: number; // bar * 4
  ringIndex: number; // 0..5, after the repeat rule
  ringStepped: boolean; // true when the repeat rule moved the index
  symbol: string; // for example "Dm9"
  rootMidi: number; // bass root, 36..47
  voicing: number[]; // four ascending MIDI notes
}

export type TraceStep = WalkStep & {
  bar: number; // Math.floor(beat / 4)
  beatInBar: number; // beat % 4
  neuronType: string | null;
  uses: string[]; // readable choices, for example "chord Dm9", "bass root-push", "keys push (reused from bar 1)"
};

export interface PhraseScore {
  scoreVersion: 1;
  mappingVersion: number;
  presetId: PresetId;
  presetVersion: number;
  sessionSeed: number;
  phraseIndex: number;
  compositionPhraseIndex: number;
  variation: number;
  graphChecksum: string;
  bars: 8;
  stepsPerBar: 16;
  chords: ChordSlot[]; // 4 slots
  events: NoteEvent[]; // canonical order
  trace: TraceStep[]; // 32 steps
  fill: boolean;
}
```

`composePhrase(graph: CircuitGraph, recipe: SessionRecipe, phraseIndex: number): PhraseScore` in `src/music/compose.ts` runs these steps in order:

1. Compute `compositionPhraseIndex` and create the traversal, rhythm, and humanize streams (R5).
2. Run `walkPhrase` with the traversal stream.
3. Choose the four chord slots.
4. For bars 0 to 7, make the rhythm-stream draws for that bar, then choose the keys pattern, bass cells, and any embellishment.
5. Draw the fill decision.
6. Add drums.
7. Sort events into canonical order, then apply humanization.

**Chord qualities**

| Quality ID | Symbol suffix | Voicing intervals above the root | Third | Seventh |
| --- | --- | --- | --- | --- |
| `m9` | `m9` | 3, 7, 10, 14 | 3 | 10 |
| `m7add11` | `m7(11)` | 3, 7, 10, 17 | 3 | 10 |
| `maj9` | `maj9` | 4, 7, 11, 14 | 4 | 11 |
| `maj7sharp11` | `maj7#11` | 4, 7, 11, 18 | 4 | 11 |
| `dom9` | `9` | 4, 7, 10, 14 | 4 | 10 |
| `dom7sus4` | `7sus4` | 5, 7, 10, 14 | 5 | 10 |

Keys voicings omit the root, which the bass plays.

**Harmony**

- Chord slots start at bars 0, 2, 4, and 6 (beats 0, 8, 16, and 24), and each lasts two bars. Every bar starts with a neuron (R6), so every slot has one.
- `ringIndex = fnv1a32(neuron.type ?? `id:${neuron.id}`) % 6`. The `id:` form is the fallback for a missing type.
- If a slot after the first has the same `ringIndex` as the previous slot, use `(ringIndex + 1) % 6` and set `ringStepped`.
- The chord is `preset.chordRing[ringIndex]`. `rootMidi` is the MIDI note from 36 to 47 with the chord root's pitch class.
- Choose the voicing:
  1. Compute the pitch classes `(root + interval) % 12` in interval order.
  2. For each of the four rotations, and each starting MIDI note from `keysRange.low` to `keysRange.high` with the rotation's first pitch class, build a candidate by stacking upward: each next note is the lowest MIDI note above the previous note with the next pitch class. Keep candidates whose top note is at most `keysRange.high`.
  3. For slot 0, choose the candidate whose mean pitch is closest to `keysRange.center`.
  4. For later slots, choose the candidate with the smallest sum of absolute note-by-note differences from the previous slot's voicing, comparing both in ascending order.
  5. Break ties by mean pitch closest to the center, then by the lower first note.
- Voicing test vectors: Rainy Windowsill Dm9 in slot 0 gives `[57, 60, 64, 65]`; Gm9 after it gives `[57, 58, 62, 65]`; Bbmaj9 after that gives `[57, 60, 62, 65]`. Overripe at 2 AM Cm9 in slot 0 gives `[55, 58, 62, 63]`. Fruit Bowl Finals Am9 in slot 0 gives `[60, 64, 67, 71]`.

**Bass.** Each beat uses one cell of four sixteenths. Beats 0 and 2 of a bar use the strong list; beats 1 and 3 use the weak list. Each note is `(offset, durationSteps, degree, velocity)`.

| List | Cell | Notes |
| --- | --- | --- |
| Strong | `root-hold` | (0, 4, root, 0.95) |
| Strong | `root-push` | (0, 3, root, 0.95), (3, 1, fifth, 0.6) |
| Strong | `root-octave` | (0, 2, root, 0.9), (2, 2, octave, 0.65) |
| Strong | `root-short` | (0, 2, root, 0.9) |
| Weak | `rest` | no notes |
| Weak | `fifth` | (0, 2, fifth, 0.7) |
| Weak | `and-root` | (2, 2, root, 0.75) |
| Weak | `seventh-fifth` | (0, 2, seventh, 0.65), (2, 2, fifth, 0.6) |
| Weak | `approach` | (2, 2, approach, 0.7) |

- Choose a cell with `list[fnv1a32(`bass|${neuronId}`) % list.length]`. A trace `rest` step produces no bass notes for that beat.
- Degrees: root is the slot's `rootMidi`; fifth adds 7; octave adds 12; third and seventh add the quality's values. On beat 3 of bars 1, 3, and 5, `approach` is the next slot's `rootMidi - 1`; everywhere else it becomes the fifth.
- A note's step is `bar * 16 + beatInBar * 4 + offset`.
- The bass is monophonic: shorten a note so it ends no later than the next bass note's step, keeping a duration of at least 1.

**Keys comping patterns.** Steps are relative to the bar. `all` plays the whole voicing; `top2` plays its two highest notes.

| Pattern | Hits: (step, durationSteps, velocity, notes) |
| --- | --- |
| `whole` | (0, 15, 0.70, all) |
| `halves` | (0, 7, 0.70, all), (8, 7, 0.60, all) |
| `push` | (0, 5, 0.72, all), (6, 9, 0.62, all) |
| `dotted` | (0, 5, 0.70, all), (6, 2, 0.55, top2), (10, 5, 0.60, all) |
| `late` | (2, 13, 0.66, all) |

The neuron at the start of each bar chooses `patterns[fnv1a32(`keys|${neuronId}`) % 5]`. Hits use the voicing of the slot that contains the bar.

**Rhythm stream.** For each bar from 0 to 7, draw in this order:

1. For bars 4 to 7 only: `reuse = rhythm.float() < 1 - variation`.
2. If beat 3 of the bar holds a neuron: `embellish = rhythm.float() < variation * preset.embellishChance`.

After bar 7, draw `fill = rhythm.float() < preset.fillChance * (0.5 + 0.5 * variation)`.

- **Motif reuse:** a reused bar copies bar `bar - 4`'s keys pattern. For each beat, it copies that bar's bass cell for the same beat when that beat had one; otherwise the current neuron chooses. Pitches always follow the current slot, and rests in the current bar still silence the bass. Record "(reused from bar N)" in `uses`, counting bars from 1 in text.
- **Embellishment:** add one keys note at bar step 14 with duration 2 and velocity 0.45. Its pitch is `voicing[fnv1a32(`emb|${neuronId}`) % 4] + 12`, where the neuron is on beat 3.
- **Drums:** bars 3 and 7 use the preset's `turn` pattern; other bars use `main`. Each drum event has `durationSteps` 1, `midi` null, and `traceBeat` null. If `fill` is true, remove bar 7's drum hits at steps 12 to 15 and add the preset's `fill` hits.

**Canonical order and humanization.** Sort events by step; then layer (drums, bass, keys); then drum voice (kick, snare, hat); then MIDI note ascending. Then, for each event in that order, draw `a = humanize.float()` and `b = humanize.float()`, always two draws per event:

- `velocity = clamp(round4(velocity * (1 + (a * 2 - 1) * 0.06)), 0.05, 1)`
- `microOffset = round4(b * maxOffset)`, where `maxOffset` is 0 for kick, 0.04 for snare, 0.06 for hat, 0.03 for bass, and 0.08 for keys
- `round4(x) = Math.round(x * 10000) / 10000`

**Invariants to test**

- The trace has 32 steps; there are 4 chord slots at bars 0, 2, 4, and 6.
- Every event has a step from 0 to 127, `step + durationSteps <= 128`, and `0 <= microOffset < 0.25`.
- Keys voicing notes lie within the preset's range; embellishments are at most `keysRange.high + 12`; every keys pitch class belongs to its slot's voicing.
- Bass notes lie between 35 and 59. A bass note at offset 0 on beat 0 or 2 is the slot root. Every bass note other than an approach note is the root, third, fifth, seventh, or octave. Approach notes are one semitone below the next slot's root. Bass notes never overlap.
- Each bar has at most 24 drum events, 8 bass notes, and 17 keys notes, and at most 8 keys notes sound at any step.
- Every trace `edge` exists in the graph with the same synapse count. Every `start` and `restart` neuron is a start neuron.
- The same inputs produce deeply equal scores. At variation 0, phrases 0 and 5 are equal except for `phraseIndex`.

### R8. Presets, version 1

`src/presets/types.ts` and `src/presets/presets.ts`:

```ts
export type PresetId = 'rainy-windowsill' | 'overripe-2am' | 'fruit-bowl-finals';
export type ChordQualityId = 'm9' | 'm7add11' | 'maj9' | 'maj7sharp11' | 'dom9' | 'dom7sus4';

export interface ChordDef {
  symbol: string;
  root: number; // pitch class: C = 0, C#/Db = 1, … B = 11
  quality: ChordQualityId;
}

export type DrumHits = Record<DrumVoice, ReadonlyArray<readonly [step: number, velocity: number]>>;

export interface PresetDefinition {
  id: PresetId;
  version: number;
  name: string;
  keyName: string;
  tempoBpm: number;
  swing: number; // sixteenth-note swing ratio; 0.5 is straight
  chordRing: readonly ChordDef[]; // exactly 6
  keysRange: { low: number; center: number; high: number };
  embellishChance: number;
  fillChance: number;
  drums: { main: DrumHits; turn: DrumHits; fill: DrumHits };
  sound: SoundParams; // R10, added in Phase 15
  visual: VisualParams; // R13, added in Phase 26
}
```

Every chord in a ring is diatonic to the preset's key. Neighboring ring positions make good two-chord vamps, which is what the repeat rule produces when the walk circles one cell type. The default preset is Rainy Windowsill.

```ts
export const PRESETS: Record<PresetId, Omit<PresetDefinition, 'sound' | 'visual'>> = {
  'rainy-windowsill': {
    id: 'rainy-windowsill', version: 1, name: 'Rainy Windowsill', keyName: 'D minor', tempoBpm: 72, swing: 0.56,
    chordRing: [
      { symbol: 'Dm9', root: 2, quality: 'm9' },
      { symbol: 'Bbmaj9', root: 10, quality: 'maj9' },
      { symbol: 'Gm9', root: 7, quality: 'm9' },
      { symbol: 'C9', root: 0, quality: 'dom9' },
      { symbol: 'Fmaj9', root: 5, quality: 'maj9' },
      { symbol: 'Am7(11)', root: 9, quality: 'm7add11' },
    ],
    keysRange: { low: 50, center: 62, high: 76 }, embellishChance: 0.35, fillChance: 0.25,
    drums: {
      main: {
        kick: [[0, 0.9], [10, 0.75]],
        snare: [[4, 0.8], [12, 0.8]],
        hat: [[0, 0.5], [2, 0.3], [4, 0.45], [6, 0.3], [8, 0.5], [10, 0.3], [12, 0.45], [14, 0.35], [15, 0.18]],
      },
      turn: {
        kick: [[0, 0.9], [7, 0.55], [10, 0.75]],
        snare: [[4, 0.8], [12, 0.8], [15, 0.25]],
        hat: [[0, 0.5], [2, 0.3], [4, 0.45], [6, 0.3], [8, 0.5], [10, 0.3], [12, 0.45], [14, 0.35]],
      },
      fill: { kick: [[12, 0.6]], snare: [[12, 0.55], [13, 0.35], [14, 0.6], [15, 0.7]], hat: [[12, 0.3]] },
    },
  },
  'overripe-2am': {
    id: 'overripe-2am', version: 1, name: 'Overripe at 2 AM', keyName: 'C minor', tempoBpm: 64, swing: 0.6,
    chordRing: [
      { symbol: 'Cm9', root: 0, quality: 'm9' },
      { symbol: 'Abmaj7#11', root: 8, quality: 'maj7sharp11' },
      { symbol: 'Fm9', root: 5, quality: 'm9' },
      { symbol: 'Bb7sus4', root: 10, quality: 'dom7sus4' },
      { symbol: 'Ebmaj9', root: 3, quality: 'maj9' },
      { symbol: 'Gm7(11)', root: 7, quality: 'm7add11' },
    ],
    keysRange: { low: 48, center: 59, high: 72 }, embellishChance: 0.2, fillChance: 0.1,
    drums: {
      main: {
        kick: [[0, 0.85], [11, 0.55]],
        snare: [[4, 0.7], [12, 0.7]],
        hat: [[0, 0.35], [4, 0.3], [8, 0.35], [12, 0.3], [14, 0.2]],
      },
      turn: {
        kick: [[0, 0.85], [11, 0.55]],
        snare: [[4, 0.7], [12, 0.7]],
        hat: [[0, 0.35], [4, 0.3], [8, 0.35], [10, 0.18], [12, 0.3]],
      },
      fill: { kick: [], snare: [[12, 0.5], [14, 0.45], [15, 0.3]], hat: [] },
    },
  },
  'fruit-bowl-finals': {
    id: 'fruit-bowl-finals', version: 1, name: 'Fruit Bowl Finals', keyName: 'A Dorian', tempoBpm: 86, swing: 0.55,
    chordRing: [
      { symbol: 'Am9', root: 9, quality: 'm9' },
      { symbol: 'Cmaj9', root: 0, quality: 'maj9' },
      { symbol: 'D9', root: 2, quality: 'dom9' },
      { symbol: 'Gmaj9', root: 7, quality: 'maj9' },
      { symbol: 'Em9', root: 4, quality: 'm9' },
      { symbol: 'Bm7(11)', root: 11, quality: 'm7add11' },
    ],
    keysRange: { low: 52, center: 65, high: 79 }, embellishChance: 0.5, fillChance: 0.5,
    drums: {
      main: {
        kick: [[0, 0.95], [6, 0.6], [10, 0.8]],
        snare: [[4, 0.85], [12, 0.85], [15, 0.22]],
        hat: [[0, 0.55], [2, 0.35], [3, 0.2], [4, 0.5], [6, 0.35], [8, 0.55], [10, 0.35], [11, 0.2], [12, 0.5], [14, 0.4]],
      },
      turn: {
        kick: [[0, 0.95], [6, 0.6], [9, 0.5], [10, 0.8]],
        snare: [[4, 0.85], [12, 0.85], [14, 0.3], [15, 0.4]],
        hat: [[0, 0.55], [2, 0.35], [3, 0.2], [4, 0.5], [6, 0.35], [8, 0.55], [10, 0.35], [11, 0.2], [12, 0.5], [14, 0.4]],
      },
      fill: { kick: [[12, 0.7]], snare: [[12, 0.6], [13, 0.45], [14, 0.65], [15, 0.8]], hat: [[14, 0.3]] },
    },
  },
};
```

The `PRESETS` literal omits `sound` and `visual` until Phases 15 and 26 add them. Those phases change the exported type to the full `PresetDefinition`.

### R9. Timing, sequencing, and the live engine

**Timing adapter** (`src/audio/timing.ts`, pure, no Tone import). Live playback and export both use these functions, so swing and humanized timing agree.

```ts
export const PHRASE_STEPS = 128;
export const EXPORT_TAIL_SECONDS = 2;
export const EXPORT_FADE_SECONDS = 0.5;

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const secondsPerStep = (bpm: number) => 60 / bpm / 4;
export const swingOffsetSteps = (step: number, swing: number) => (step % 2 === 1 ? 2 * swing - 1 : 0);
export const eventOffsetSeconds = (event: NoteEvent, bpm: number, swing: number) =>
  (swingOffsetSteps(event.step, swing) + event.microOffset) * secondsPerStep(bpm);
export const eventTimeSeconds = (event: NoteEvent, bpm: number, swing: number) =>
  event.step * secondsPerStep(bpm) + eventOffsetSeconds(event, bpm, swing);
export const eventDurationSeconds = (event: NoteEvent, bpm: number) => event.durationSteps * secondsPerStep(bpm);
export const phraseSeconds = (bpm: number) => PHRASE_STEPS * secondsPerStep(bpm);
export const exportSeconds = (bpm: number) => phraseSeconds(bpm) + EXPORT_TAIL_SECONDS;
```

Test values: at 72 BPM a step lasts 0.2083 s, a phrase 26.667 s, and an export 28.667 s. At 60 BPM they are 0.25 s, 32 s, and 34 s; at 100 BPM, 0.15 s, 19.2 s, and 21.2 s. Swing 0.56 delays odd steps by 0.12 steps. `midiToHz(69)` is 440 and `midiToHz(57)` is 220.

**Sequencer** (`src/audio/sequencer.ts`, pure, no Tone import). It decides what happens on each sixteenth note, so boundary behavior can be tested without audio.

```ts
export type PendingChange =
  | { kind: 'tempo'; tempoBpm: number }
  | { kind: 'variation'; variation: number }
  | { kind: 'newBeat'; sessionSeed: number }
  | { kind: 'preset'; presetId: PresetId; tempoBpm: number };

export interface StepPlan {
  globalStep: number;
  phraseIndex: number;
  stepInPhrase: number; // 0..127
  bar: number; // 0..7
  beat: number; // 0..3
  tempoBpm: number;
  tempoChanged: boolean;
  phraseStarted: PhraseScore | null;
  applied: PendingChange['kind'][];
  events: readonly NoteEvent[];
}

export class PlaybackSequencer {
  constructor(compose: (recipe: SessionRecipe, phraseIndex: number) => PhraseScore, recipe: SessionRecipe);
  get active(): SessionRecipe;
  get pending(): Readonly<Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>>;
  get currentScore(): PhraseScore | null;
  reset(recipe: SessionRecipe): void; // position 0, phrase 0, no score, nothing pending
  request(change: PendingChange): void; // added in Phase 20
  applyTempoNow(tempoBpm: number): void; // added in Phase 20; used only while paused
  advance(): StepPlan; // call exactly once per sixteenth note
}
```

`advance()` works in this order:

1. Take `globalStep` from an internal counter and increment it. Compute the position relative to `recipeStartStep`: `stepInPhrase = rel % 128` and `phraseIndex = Math.floor(rel / 128)`.
2. At a bar boundary (`stepInPhrase % 16 === 0`), apply a pending tempo.
3. At a phrase boundary (`stepInPhrase === 0`), apply pending variation, preset (with its tempo), and New beat seed. Applying a New beat sets `recipeStartStep = globalStep`, so the phrase index restarts at 0. Then compose the phrase and index its events by step.
4. Return the events for `stepInPhrase` from the current score.

If `request()` is called before any phrase has been composed, the change applies to the active recipe immediately. The sequencer holds only the current score, and `scoresHeld` never exceeds 2.

**Engine** (`src/audio/engine.ts`). One module-level engine is returned by `getEngine()`.

```ts
export type EngineStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'interrupted' | 'exporting';

export interface EngineDiagnostics {
  contextState: string;
  status: EngineStatus;
  transportState: string;
  sampleRate: number;
  repeatEvents: number; // 0 before start, then exactly 1
  scoresHeld: number;
  keysActiveVoices: number;
  exportInProgress: boolean;
}
// The controller adds objectUrlsHeld when it reports diagnostics (Phase 24).
```

Events emitted with `engine.on(name, handler)`, which returns an unsubscribe function:

| Event | Payload | When |
| --- | --- | --- |
| `status` | `EngineStatus` | Every status change |
| `phraseStarted` | `{ score, recipe }` | Each phrase boundary |
| `applied` | `{ kinds, recipe }` | Pending changes become active |
| `position` | `{ phraseIndex, bar, beat }` | Each beat, only while the page is visible |
| `step` | `{ phraseIndex, stepInPhrase, bar, beat }` | Each sixteenth note, delivered through `context.draw`, only while the page is visible |

Rules:

1. `start(graph, recipe, mix)` runs from the Start listening click. It awaits `Tone.start()`, stores `Tone.getContext()` as `this.context`, builds the rig and sequencer, sets `transport.bpm.value` to the recipe tempo and `transport.swing` to 0, and schedules exactly one `transport.scheduleRepeat(onStep, '16n', 0)`. Calls made while a start is in progress return the same promise; later calls do nothing.
2. `onStep(time)` calls `sequencer.advance()` once. If the tempo changed, it calls `transport.bpm.setValueAtTime(plan.tempoBpm, time)`. At a phrase start it calls `rig.applySound(preset.sound, time)`. It triggers each event at `time + eventOffsetSeconds(event, plan.tempoBpm, preset.swing)` with `eventDurationSeconds(event, plan.tempoBpm)`. Always schedule from the supplied `time`, never from `Date`, `performance.now()`, or animation frames.
3. `pause()` ramps the master gain to 0 over 0.08 s, pauses the transport and releases all voices at `currentTime + 0.09`, then ramps the master gain back to the mix level from `currentTime + 0.12`. `play()` resumes the transport from the saved step.
4. `reset(recipe)` is for changes made while paused. It stops the transport (position 0), resets the sequencer, and sets the transport tempo.
5. There is only ever one engine, rig, and repeat event. Rapid clicks can never create more.
6. While `document.hidden` is true, audio continues but `step` and `position` events are not emitted or scheduled, so no drawing work accumulates.

### R10. Sound design, version 1

**Seeded buffers** (`src/audio/buffers.ts`, pure). Each function takes a sample rate and returns `{ sampleRate: number; channels: Float32Array[] }`. Noise comes from `createRng(`buffer|${name}|${sampleRate}`)` as `rng.float() * 2 - 1`. A one-pole low-pass filter is `y += a * (x - y)` with `a = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate)`; a high-pass filter is `x - lowpass(x)`. Scale each buffer so its absolute peak equals the value in the last column. `t` is time in seconds.

| Name | Length and channels | Recipe | Peak |
| --- | --- | --- | --- |
| `kick` | 0.5 s, mono | Sine whose frequency is `48 + 62 * exp(-t / 0.03)` Hz (accumulate the phase) times `exp(-t / 0.18)`, plus noise times `0.3 * exp(-t / 0.002)` | 0.9 |
| `snare` | 0.35 s, mono | Noise high-passed at 1,200 Hz times `0.7 * exp(-t / 0.09)`, plus a 185 Hz sine times `0.5 * exp(-t / 0.05)` | 0.8 |
| `hat` | 0.12 s, mono | Noise high-passed twice at 7,000 Hz, times `exp(-t / 0.03)` | 0.6 |
| `rain` | 8 s, stereo, looped | Independent noise per channel, low-passed at 2,500 Hz then high-passed at 400 Hz, times `0.85 + 0.15 * sin(2π * 0.13 * t + channel * π / 2)`; plus about 3 drips per second, each a 3,000–6,000 Hz sine with amplitude 0.05–0.15 times `exp(-t / 0.01)` | 0.5 |
| `crackle` | 6 s, stereo, looped | Noise low-passed at 6,000 Hz times 0.01, plus about 12 clicks per second at random positions with amplitude `0.05 + 0.35 * u * u` decaying over 3 samples | 0.5 |
| `impulse` | 2.2 s, stereo | 12 ms of silence, then noise times `exp(-t / 0.45)`, low-passed at 5,000 Hz | 0.7 |

Make `rain` and `crackle` loop without a click. With `F` samples in 0.25 s and `N` total samples, set `out[i] = x[i] * sqrt(i / F) + x[N - F + i] * sqrt(1 - i / F)` for `i < F`, then drop the last `F` samples. After this required overlap, linearly blend the final `max(2, round(0.001 * sampleRate))` samples toward `out[0]`, before peak normalization.

**Instrument rig** (`src/audio/rig.ts`)

```ts
export interface SoundParams {
  keysCutoffHz: number;
  bassCutoffHz: number;
  masterCutoffHz: number;
  reverbSend: number;
  saturationWet: number;
  rainLevel: number;
  crackleLevel: number;
}

export interface MixSettings {
  masterVolume: number; // 0..1
  layers: Record<Layer, { level: number; muted: boolean }>; // level 0..1
  ambienceOn: boolean;
}

export const DEFAULT_MIX: MixSettings = {
  masterVolume: 0.8,
  layers: { drums: { level: 0.8, muted: false }, bass: { level: 0.7, muted: false }, keys: { level: 0.6, muted: false } },
  ambienceOn: true,
};

export interface InstrumentRig {
  trigger(event: NoteEvent, time: number, durationSeconds: number): void;
  applySound(sound: SoundParams, time: number): void; // 0.5 s ramps
  setMix(mix: MixSettings, time: number): void; // 0.03 s ramps; muted means gain 0
  startAmbience(time: number): void;
  stopAmbience(time: number): void;
  releaseAll(time: number): void;
  readonly keysActiveVoices: number;
  dispose(): void;
}

export function createRig(context: BaseContext, sound: SoundParams, mix: MixSettings): InstrumentRig;
```

Signal flow. Pass `{ context }` to every node.

```text
drums Sampler ─► drums bus ─────────────┬─► master gain ─► saturation ─► master low-pass ─► limiter ─► context.destination
bass MonoSynth ─► bass bus ─────────────┤
keys PolySynth ─► keys low-pass ─► keys bus ─┤
rain Player + crackle Player ─► ambience bus ┘
keys bus ─► reverb send ─┐
drums bus ─► send 0.08 ──┴─► Convolver ─► master gain
```

| Node | Version 1 settings |
| --- | --- |
| Keys | `new Tone.PolySynth({ context, voice: Tone.FMSynth, maxPolyphony: 8, volume: -8, options: { harmonicity: 3, modulationIndex: 2.5, oscillator: { type: 'sine' }, modulation: { type: 'sine' }, envelope: { attack: 0.004, decay: 1.4, sustain: 0.2, release: 1.2 }, modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 } } })` |
| Keys low-pass | `new Tone.Filter({ context, type: 'lowpass', frequency: sound.keysCutoffHz, Q: 0.5 })` |
| Bass | `new Tone.MonoSynth({ context, volume: -6, oscillator: { type: 'triangle' }, envelope: { attack: 0.008, decay: 0.25, sustain: 0.7, release: 0.2 }, filter: { type: 'lowpass', Q: 0.8 }, filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2, baseFrequency: sound.bassCutoffHz, octaves: 2 } })`, triggered with `triggerAttackRelease(midiToHz(midi), duration, time, velocity)` |
| Drums | `new Tone.Sampler({ context, urls: { C2: kick, D2: snare, 'F#2': hat }, release: 0.05 })` using native `AudioBuffer` objects at `context.sampleRate`, triggered with `triggerAttack(note, time, velocity)` |
| Ambience | Two `new Tone.Player({ context, url, loop: true, fadeIn: 1.5, fadeOut: 1 })` players whose gains are `sound.rainLevel` and `sound.crackleLevel` |
| Reverb | `new Tone.Convolver({ context, url: impulse })`; the keys send gain is `sound.reverbSend` |
| Saturation | `new Tone.Distortion({ context, distortion: 0.1, oversample: '2x', wet: sound.saturationWet })` |
| Master | Gain `mix.masterVolume`, low-pass at `sound.masterCutoffHz`, and `new Tone.Limiter({ context, threshold: -1 })` |

Create native buffers with `new AudioBuffer({ length, numberOfChannels, sampleRate })` and `copyToChannel`.

**Preset sound parameters**

| Parameter | Rainy Windowsill | Overripe at 2 AM | Fruit Bowl Finals |
| --- | --- | --- | --- |
| `keysCutoffHz` | 2200 | 1400 | 3400 |
| `bassCutoffHz` | 140 | 110 | 180 |
| `masterCutoffHz` | 12000 | 9000 | 14000 |
| `reverbSend` | 0.25 | 0.3 | 0.18 |
| `saturationWet` | 0 | 0.35 | 0 |
| `rainLevel` | 0.5 | 0.3 | 0.2 |
| `crackleLevel` | 0.25 | 0.35 | 0.2 |

### R11. WAV export

**Snapshot.** When the listener presses Export, capture the active phrase and settings, excluding pending changes. Copy it with `structuredClone` and freeze it.

```ts
export interface ExportSnapshot {
  score: PhraseScore; // the phrase currently playing, rendered from its first step
  recipe: SessionRecipe; // active recipe; its tempo applies to the whole clip
  preset: PresetDefinition;
  mix: MixSettings;
}
```

**Rendering** (`renderPhrase(snapshot)` in `src/audio/export.ts`)

1. Compute `seconds = exportSeconds(recipe.tempoBpm)`.
2. Create `new Tone.OfflineContext(2, seconds, 44100)` and `createRig(offlineContext, preset.sound, mix)`.
3. If `mix.ambienceOn`, start ambience at time 0.
4. Trigger every event at `eventTimeSeconds(event, bpm, preset.swing)` with `eventDurationSeconds(event, bpm)`.
5. Await `offlineContext.render()`, copy both channels into new `Float32Array`s, and dispose the rig.
6. Fade linearly to silence over the final `EXPORT_FADE_SECONDS`.
7. Return `{ sampleRate: 44100, channels: [left, right] }`.

**Encoding** (`encodeWav16(data)` in `src/audio/wav.ts`) returns an `ArrayBuffer`. It writes a 44-byte little-endian header, then interleaved 16-bit PCM samples. Clamp each sample to [−1, 1] and store `Math.round(s < 0 ? s * 32768 : s * 32767)`.

| Offset | Field | Value |
| --- | --- | --- |
| 0 | ChunkID | `RIFF` |
| 4 | ChunkSize | `36 + dataBytes` |
| 8 | Format | `WAVE` |
| 12 | Subchunk1ID | `fmt ` |
| 16 | Subchunk1Size | 16 |
| 20 | AudioFormat | 1 (PCM) |
| 22 | NumChannels | channel count |
| 24 | SampleRate | sample rate |
| 28 | ByteRate | `sampleRate * channels * 2` |
| 32 | BlockAlign | `channels * 2` |
| 34 | BitsPerSample | 16 |
| 36 | Subchunk2ID | `data` |
| 40 | Subchunk2Size | `dataBytes = frames * channels * 2` |

**Flow**

- Before export, show: "About N seconds: 8 bars at X BPM plus a 2-second tail. Pending changes are not included." N is `Math.round(exportSeconds(bpm))`.
- States are `preparing` (pause playback and capture the snapshot), `rendering`, `encoding`, then `ready` with a Blob URL and file name, or `error` with a message. Show no percentage, because rendering reports no progress.
- Only one export runs at a time, and playback cannot start while it runs. Playback stays paused afterward.
- The file name is `lofly-${presetId}-seed-${seedHex}.wav`.
- Revoke the previous object URL before creating a new one and when the listener dismisses the result.

### R12. App state, controls, and failure behavior

**Store.** `src/app/store.ts` exports `createStore(reducer, initialState)` with `getState`, `dispatch`, and `subscribe`, plus a `useAppState(selector)` hook built on React's `useSyncExternalStore`. No state-management dependency is needed.

```ts
export interface AppState {
  circuit: {
    status: 'loading' | 'ready' | 'error';
    manifest: CircuitManifest | null;
    error: { code: CircuitErrorCode | 'unknown'; message: string } | null;
  };
  engineStatus: EngineStatus;
  audioNotice: string | null;
  active: SessionRecipe;
  pending: Partial<Pick<SessionRecipe, 'tempoBpm' | 'variation' | 'sessionSeed' | 'presetId'>>;
  position: { phraseIndex: number; bar: number; beat: number };
  mix: MixSettings;
  activeScore: PhraseScore | null;
  exportState: {
    status: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'ready' | 'error';
    fileName: string | null;
    url: string | null;
    message: string | null;
  };
  ui: { animationEnabled: boolean | null; storageAvailable: boolean }; // null follows prefers-reduced-motion
}
```

**Session controller.** `src/app/controller.ts` creates one `SessionController` in `main.tsx` and provides it through React context. Components call only controller methods and read state only through `useAppState`. The controller is the single place that connects the store to the engine.

Controller methods: `loadCircuit()`, `startListening()`, `togglePlay()`, `setTempo(bpm)`, `setVariation(value)`, `newBeat()`, `selectPreset(id)`, `setMix(partial)`, `exportPhrase()`, `dismissExport()`, and `setAnimationEnabled(enabled)`.

**Control behavior**

| Control | While playing | While paused, or before the first start |
| --- | --- | --- |
| Tempo, 60–100 BPM in steps of 1 | Pending; applies at the next bar | Applies immediately and keeps the position |
| Variation, 0–100 | Pending; applies at the next phrase | Before the first start, applies immediately. When paused mid-session, pending until the next phrase after resuming. |
| New beat | Pending new seed; applies at the next phrase, which becomes phrase 0 | New seed applies immediately and resets to phrase 0, step 0 |
| Preset | Pending preset and its tempo; applies at the next phrase; phrase numbering continues | Preset and its tempo apply immediately and reset to phrase 0, step 0 |
| Master volume, layer levels, layer mutes, ambience | Apply immediately with a 30 ms ramp | Stored, then applied when playback starts |
| Export | Pauses playback, then renders the active phrase | Renders the active phrase. Export is available only after the first Start listening. |

- Show every pending value next to its control, for example "80 BPM at the next bar" or "Fruit Bowl Finals at the next phrase", until the engine's `applied` event clears it.
- Play is disabled while the engine is `starting` or `exporting`. Repeated clicks never create another engine.

**Persistence** (`src/app/persistence.ts`)

- The key is `lofly:settings:v1`. The value is `{ mappingVersion, presetVersion, presetId, sessionSeed, tempoBpm, variation, mix, animationEnabled }`, validated with zod when read.
- Save active settings (never pending ones), the mix, and `animationEnabled`, debounced by 500 ms.
- Wrap every `localStorage` access in `try/catch`. If storage throws, set `ui.storageAvailable` to false, show "Settings won't be remembered in this browser," and keep working. Ignore invalid saved data.
- A reload always starts paused at phrase 0.

**Failure behavior**

| Failure | Behavior |
| --- | --- |
| Circuit missing, corrupt, or invalid | Show "The fly-brain data couldn't be loaded" with the error code and message, and a Retry button. Start listening stays disabled. Never fall back to fixture data. |
| Audio context suspended or interrupted while playing | Pause the transport and release voices immediately, set status `interrupted`, and show "Audio was interrupted by the browser. Press Play to resume." Play resumes from the saved step without playing missed notes. |
| Export fails | Set the export status to `error` with a message. Playback stays paused and usable, and Export can be tried again. |
| Storage unavailable | See Persistence. |

**Debug mode.** With `?debug=1` in the URL, render a diagnostics panel that shows the diagnostics as JSON every 500 ms (the engine's `getDiagnostics()`, plus the controller's `objectUrlsHeld` from Phase 24) in `<pre data-testid="diagnostics">`, plus a **Simulate interruption** button (Phase 25). Without the parameter, render neither.

**Test IDs.** Playwright specs use these `data-testid` values. Keep them stable.

| `data-testid` | Element |
| --- | --- |
| `circuit-status`, `circuit-retry` | Loading or error message, and Retry |
| `start-listening` | Start listening button |
| `play-toggle` | Play or Pause button |
| `engine-status` | Visually hidden or visible text with the engine status |
| `position` | "Phrase N · Bar B · Beat b" text |
| `tempo`, `variation` | Range inputs |
| `new-beat` | New beat button |
| `preset-rainy-windowsill`, `preset-overripe-2am`, `preset-fruit-bowl-finals` | Preset radio inputs |
| `pending-changes` | Pending change text |
| `master-volume` | Range input |
| `layer-drums-level`, `layer-bass-level`, `layer-keys-level` | Range inputs |
| `layer-drums-mute`, `layer-bass-mute`, `layer-keys-mute` | Mute checkboxes |
| `ambience-toggle` | Checkbox |
| `export-button`, `export-status`, `export-download` | Export controls |
| `explanation` | "How the beat is made" `<details>` element |
| `animation-toggle` | Checkbox |
| `diagnostics`, `simulate-interruption` | Debug panel elements |

### R13. Scene

**Files:** `src/scene/Scene.tsx`, `src/scene/layers/` (`Wall.tsx`, `Window.tsx`, `Rain.tsx`, `Lighting.tsx`, `Desk.tsx`, `Banana.tsx`), `src/scene/fly/Fly.tsx`, and `src/scene/scene.css`.

The root is `<svg viewBox="0 0 1600 900" role="img" aria-labelledby="scene-title scene-desc">` with a `<title id="scene-title">` of "A fruit fly studying beside a banana" and a `<desc id="scene-desc">` that describes the scene in one or two sentences. Draw layers in this order: wall, window with rain, lamp, lighting overlay, desk and homework, fly, banana.

**Composition** (viewBox coordinates)

| Element | Area | Notes |
| --- | --- | --- |
| Wall | Whole canvas | Muted wall with faint wallpaper stripes |
| Window | x 110–700, y 70–540 | Four panes, a sill at y 540, and a sky color from the preset |
| Rain | Inside the glass | 18 streaks and 10 drops, clipped to the panes |
| Lamp | x 1300–1500, y 120–520 | Arm and shade; its light cone belongs to the lighting layer |
| Desk | x 0–1600, y 600–900 | Wood surface with a darker front edge |
| Homework | x 700–1050, y 640–780 | Papers with scribble lines, an "HW" heading, and a pencil |
| Fly | x 820–1260, y 250–720 | Seated behind the homework, turned slightly left |
| Banana | x 1180–1540, y 640–800 | Curved and yellow, with brown overripe spots and a dark stem |

**The fly.** Each item is a `<g>` with the given class so animation can target it.

| Class | Content |
| --- | --- |
| `fly` | Root group |
| `fly-body` | Hoodie torso with drawstrings and **six sleeves**: two front arms at the homework, two middle arms resting on the desk, and two back arms folded. All six sleeves are visible. |
| `fly-wings` | Two translucent veined wings poking out of the hoodie's back |
| `fly-head` | Round head with `transform-origin` at the neck; two large red compound eyes with a highlight arc; two short antennae with feathery tips; a small proboscis |
| `fly-eye-shine` | Eye highlights, squashed to show a blink |
| `fly-headphones` | Oversized band and ear cups, with a cable running to the desk |
| `fly-hands-front` | The two front hands, used for hand rubbing |

The fly and banana must remain recognizable at a 390 px viewport width. The only text inside the SVG is the "HW" heading.

**Visual parameters** (`VisualParams` on each preset). Apply them as CSS custom properties from a `data-preset` attribute on the app root, and transition them over 1.5 s.

```ts
export interface VisualParams {
  wall: string;
  windowSky: string;
  glassTint: string;
  desk: string;
  deskEdge: string;
  lightColor: string;
  lightOpacity: number;
  shadowOpacity: number;
  uiAccent: string;
}
```

| Property | Rainy Windowsill | Overripe at 2 AM | Fruit Bowl Finals |
| --- | --- | --- | --- |
| `wall` | `#3b4a5a` | `#2a2320` | `#e9d8b8` |
| `windowSky` | `#6f8ba3` | `#151b2b` | `#bcd9ea` |
| `glassTint` | `rgba(180, 205, 230, 0.25)` | `rgba(90, 110, 150, 0.2)` | `rgba(255, 255, 255, 0.18)` |
| `desk` | `#6b4f3a` | `#4a3426` | `#a47449` |
| `deskEdge` | `#4f3a2b` | `#33241a` | `#7d5634` |
| `lightColor` | `#9fc3e6` | `#ffb35c` | `#ffe7a8` |
| `lightOpacity` | 0.18 | 0.35 | 0.22 |
| `shadowOpacity` | 0.35 | 0.55 | 0.2 |
| `uiAccent` | `#9fc3e6` | `#ffb35c` | `#e8a33d` |

**Responsive crop.** At 700 px and wider, the scene box has `aspect-ratio: 16 / 9` and the SVG uses `preserveAspectRatio="xMidYMid slice"`. Below 700 px, the box is `aspect-ratio: 4 / 3` and the SVG uses `xMaxYMid slice`, which keeps the fly and banana in view. Choose the attribute with a `matchMedia` hook.

**Animation cues** (Phase 31)

| Cue | Trigger | Behavior |
| --- | --- | --- |
| Head bob | `step` events where `stepInPhrase % 4 === 0` | Restart a 0.35 s bob on `.fly-head`, stronger on beats 0 and 2 |
| Blink | Timer every 3–7 s, with each delay drawn from the animation stream | 0.15 s squash of `.fly-eye-shine` |
| Hand rub | `phraseStarted` with `phraseIndex > 0`, when `animation.float() < 0.2` and no rub happened in the previous two phrases | 2.4 s rub of `.fly-hands-front` |
| Rain | CSS keyframes; each streak's delay and duration drawn once per session from the animation stream | Runs continuously |
| Lighting | Preset change becomes active | 1.5 s CSS custom property transition |

- Animate only `transform` and `opacity`. Do not put SVG filters on animated groups.
- Animation starts enabled unless `prefers-reduced-motion: reduce` matches. The animation toggle overrides that preference and is saved.
- When animation is off, add `.scene--still`: no bob, blink, rub, or rain movement, and the scene remains a complete still picture.
- While the page is hidden, add `.scene--paused` (`animation-play-state: paused`) and stop cue timers.
- Composition never reads animation state. Animation uses only its own RNG stream.

### R14. Copy and credits

| Location | Text |
| --- | --- |
| Page title and heading | Lo-fly beats |
| Tagline | Beats to relax / repeatedly fly into the same window to |
| Track title | No Thoughts, Only Fruit |
| Loading | Loading the fly-brain wiring… |
| Start button | Start listening |
| About line | Music shaped by real fly-brain wiring. The connections come from a real fruit fly; the scale, rhythm, instruments, and probability rules are authored choices. |

**Status jokes.** Show at most one joke at a phrase boundary, no more than once every three phrases, chosen with the jokes stream. Keep each under 60 characters, and keep jokes out of live regions. Agents may add up to six more in the same style, but jokes must make no scientific claims.

- All systems operational. Banana unavailable.
- Homework progress: still on question one.
- Banana status: structurally concerning.
- Six sleeves. Zero pockets.
- Studying the window. For science.
- Now reviewing: the same window, again.

**Credits** include the dataset name and release, the collaboration, the citation and paper link from R3, the CC BY 4.0 link, the manifest's `license.attribution` string, the manifest's filtering rules, and this sentence: "The musical mapping (version N) is authored and does not simulate neural activity."

**Explanation labels.** Mark each trace row **Real connection** (a graph edge with its synapse count and chance) or **Authored rule** (phrase start, restart, rest after a dead end, chord ring, bass and keys patterns, reuse, embellishment, and fill).

## Milestone 1: Scaffold and validate the inputs

Exit criteria from the plan: a clean install and build succeed; the real graph validates; original IDs and sample connection counts are checked against the source; a short sound plays and exports in the target desktop browsers; desktop tab switching is tested; and the circuit choice and any compatibility issues are recorded.

## Phase 1: Scaffold the app and tooling

**Agent** · **Read:** R1, R2

Create the Vite React TypeScript app in the repository root without disturbing `docs/` or `.git/`, and add the scripts later phases rely on. This is the repository's first commit.

- [x] Scaffold into a temporary directory outside the repository, because the root is not empty: `npm create vite@9.2.1 <temp-dir>/lofly -- --template react-ts --no-interactive`. Copy every generated file into the repository root, including `.gitignore` and `.oxlintrc.json`. Replace the template `README.md` with a stub containing the title and tagline.
- [x] In `package.json`, set `"name": "lo-fly-beats"` and `"engines": { "node": ">=22.12.0" }`. Create `.nvmrc` containing `22`.
- [x] Run `npm install`, then `npm install --save-exact zod@4` and `npm install --save-dev --save-exact vitest@5`.
- [x] Remove the template demo. Move `src/App.tsx` to `src/app/App.tsx` and make it render an `<h1>` "Lo-fly beats" and the tagline from R14. Update `src/main.tsx` to import `./app/App.tsx` and `./styles/app.css`. Delete `src/App.css`, `src/index.css`, `src/assets/`, `public/favicon.svg`, and `public/icons.svg`.
- [x] Create `src/styles/app.css` with `box-sizing: border-box` on all elements, `margin: 0` on `body`, and a system font stack.
- [x] In `index.html`, set `<title>Lo-fly beats</title>` and remove the favicon link.
- [x] Add `base: './'` to `vite.config.ts`.
- [x] Create `vitest.config.ts` using `defineConfig` from `vitest/config` with `test.passWithNoTests: true` and one project named `unit` (`environment: 'node'`, include `src/**/*.test.ts`, `tests/unit/**/*.test.ts`, and `tests/data/**/*.test.ts`). Add `vitest.config.ts` to the `include` list in `tsconfig.node.json`.
- [x] Add `"strict": true` to `tsconfig.app.json`.
- [x] Append these lines to `.gitignore`: `scripts/data/.cache/`, `scripts/data/.venv/`, `.venv/`, `test-results/`, `playwright-report/`, `blob-report/`, `__screenshots__/`.
- [x] Add the Phase 1 scripts from R2.
- [x] Add a Decision log row listing the resolved versions of `react`, `vite`, `@vitejs/plugin-react`, `typescript`, `oxlint`, `vitest`, and `zod` from `package-lock.json`.

**Verify**

1. `rm -rf node_modules && npm ci` succeeds.
2. `npm run check` exits with status 0.
3. `npm run preview` serves the build; `curl -s http://localhost:4173/ | grep '<title>Lo-fly beats</title>'` prints the title. Stop the server afterward.
4. `git status --short` lists `docs/` and the app files, and no template demo assets.

- [x] All verification steps pass. The commit includes `docs/`.

## Phase 2: Prepare the data environment and download the sources

**Agent** · **Read:** R2, R3

Create a reproducible Python environment and download the two MaleCNS files with checksum verification.

- [x] Create the uv project: `uv init --bare --name lofly-data --python 3.12 scripts/data`, then `uv add --project scripts/data pyarrow pandas networkx`. Commit `scripts/data/pyproject.toml`, `scripts/data/uv.lock`, and `scripts/data/.python-version` (create it containing `3.12` if uv did not).
- [x] Create `scripts/data/config/mbon-v1.json`:

  ```json
  {
    "circuitId": "mbon-v1",
    "release": "male-cns:v1.0",
    "baseUrl": "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/",
    "files": {
      "annotations": { "name": "body-annotations-male-cns-v1.0-minconf-0.5.feather", "bytes": 14483314, "md5Base64": "UKdxh3DFciDxYLpPQxq4ng==" },
      "connections": { "name": "connectome-weights-male-cns-v1.0-minconf-0.5.feather", "bytes": 1051241946, "md5Base64": "8w6dzKJc/QIb8eez2XVZng==" }
    },
    "selection": { "column": "class", "equals": "MBON" },
    "minSynapseCount": 3,
    "compareThresholds": [1, 3, 5],
    "removeSelfConnections": true,
    "limits": { "minNeurons": 32, "maxNeurons": 128, "maxConnections": 2000 },
    "startNeurons": { "count": 8, "onePerType": true },
    "outputDir": "public/data/circuits/mbon-v1"
  }
  ```

- [x] Write `scripts/data/download_sources.py`. For each configured file, skip the download if `scripts/data/.cache/<name>` already has the expected size and MD5. Otherwise stream it to `<name>.part` in 8 MiB chunks, check the byte count and base64 MD5, and rename it. On a mismatch, delete the partial file and exit with a nonzero status and a clear message. After verification, compute SHA-256 and write `scripts/data/.cache/retrieval.json` as `{ "<name>": { "retrievedOn": "YYYY-MM-DD", "sha256": "<hex>" } }`, keeping the existing date for files that were skipped.
- [x] Write `scripts/data/inspect_sources.py`, which writes `scripts/data/reports/source-schema.md` containing: the annotation row count, column names, and types; the connections schema, record batch count, and total row count (from batch metadata, without loading the table); and a table of MBON neuron counts by type and by `somaSide`.
- [x] Add the `data:download` script from R2.

**Verify**

1. `npm run data:download` downloads and verifies both files. Running it a second time skips both.
2. `uv run --project scripts/data python scripts/data/inspect_sources.py` produces a report showing 211,577 annotation rows, 151,856,684 connection rows in 2,318 batches, and 97 MBON neurons (48 L, 49 R) of 37 types.
3. `git status --short` shows nothing from `scripts/data/.cache/`.

- [x] All verification steps pass and the report matches R3.

## Phase 3: Extract the MBON circuit

**Agent** · **Read:** R3, R4

Write the script that produces the committed circuit and manifest.

- [x] Write `scripts/data/extract_circuit.py`, driven by `scripts/data/config/mbon-v1.json`. It fails with a clear message if `scripts/data/.cache/retrieval.json` or either source file is missing.
  1. Load the annotations and select rows where `class == "MBON"`. Assert the body IDs are unique and the count is within `limits`.
  2. Stream the connections file batch by batch (R3) and keep rows whose `body_pre` and `body_post` are both selected.
  3. Assert there are no null values and no duplicate `(body_pre, body_post)` pairs, and that every weight is a positive integer. Count and remove self-connections.
  4. For each comparison threshold, build a networkx `DiGraph` containing every selected neuron and compute the connection count, largest strongly connected component size, and dead-end count.
  5. Apply `minSynapseCount` and assert the connection count is at most `limits.maxConnections`.
  6. Compute the manifest `counts` and choose start neurons with the R4 rule.
  7. Write `circuit.json` using the R4 serialization rules, converting pandas missing values to `null`.
  8. Write `manifest.json` exactly as shown in R4. Take `retrievedOn` and input SHA-256 values from `retrieval.json`, compute `configSha256` from the config file bytes, and compute `output.bytes` and `output.sha256` from the written `circuit.json`.
  9. Print a summary of every count and the start neurons.
- [x] The only date in the output is `retrievedOn`, so two runs produce byte-identical files.
- [x] Add the `data:extract` script from R2.

**Verify**

1. `npm run data:extract` reports 97 neurons, 936 connections, 25,379 synapses, a largest strongly connected component of 92, 5 dead ends, threshold comparison values of 1,605, 936, and 682, and the eight start neurons from R3 in order.
2. Record `shasum -a 256 public/data/circuits/mbon-v1/*.json`, run `npm run data:extract` again, and confirm both hashes are unchanged.
3. `node -e "const c=require('./public/data/circuits/mbon-v1/circuit.json'); console.log(c.neurons.length, c.connections.length)"` prints `97 936`.
4. `circuit.json` contains the neuron and connection records given as examples in R3.

- [x] All verification steps pass and every value matches R3 exactly.

## Phase 4: Verify the export and write the extraction report

**Agent** · **Read:** R3, R4

Check the export against the upstream files with code that does not reuse the extraction script, then document the result.

- [x] Write `scripts/data/verify_circuit.py`. Do not import `extract_circuit.py`. It must:
  1. Recompute the SHA-256 of `circuit.json` and compare it with `manifest.output.sha256`.
  2. Recompute the SHA-256 of both cached source files and compare them with the manifest.
  3. Read the annotation rows for all 97 exported IDs and assert that `type`, `instance`, `class`, `superclass`, and `somaSide` equal the exported values, treating missing as `null`.
  4. Choose 20 sample connections: the 5 with the highest synapse counts, the 5 with the lowest (ties broken by source, then target), and the connections at positions 0, 100, 200, and so on through 900 in file order. Remove duplicates and fill any gap from the next position. Stream the upstream connections file and assert each sample's `weight` equals its exported `synapseCount`.
  5. Assert that the set of upstream pairs among the selected neurons with weight at least 3, excluding self-connections, exactly equals the exported set.
  6. Write `scripts/data/reports/mbon-v1-extraction.md` with sections for: source files and checksums; selection criteria and filtering rules; counts; the threshold comparison; in-degree and out-degree distributions (minimum, median, 90th percentile, maximum); dead ends with type and side; connected components; start neurons (ID, type, side, out-degree, and total outgoing synapses); the 20 samples showing upstream and exported counts; and regeneration commands.
- [x] Add the `data:verify` script from R2.

**Verify**

1. `npm run data:verify` exits with status 0 and reports 20 of 20 matching samples, 97 of 97 matching annotation records, and matching connection sets.
2. The report lists the dead ends as four MBON10 neurons and one MBON15 neuron.

- [x] All verification steps pass.

## Phase 5: Load and validate the circuit in TypeScript

**Agent** · **Read:** R1, R4

Implement the browser data path and the checks that protect it.

- [x] Create `src/connectome/types.ts`, `src/connectome/schema.ts`, `src/connectome/graph.ts` (`compareIds`, `buildGraph`), and `src/connectome/load.ts` (`loadCircuit` and `sha256Hex(bytes: ArrayBuffer): Promise<string>`), following R4.
- [x] Create the fixture `tests/fixtures/graphs/branching/circuit.json` and `manifest.json` in the R4 formats. Neurons: `"1"` type Alpha, `"2"` Beta, `"3"` Gamma, `"4"` Delta, and `"5"` with type `null`; other annotation fields `null`. Connections: 1→2 (9), 1→3 (1), 2→1 (4), 2→4 (4), 3→1 (2), 4→5 (3). Neuron 5 is a dead end. Set `startNeuronIds` to `["1", "2"]`, `minSynapseCount` to 1, and counts to 5 neurons, 6 connections, and 23 synapses. Set `output.sha256` to the output of `shasum -a 256` on the fixture `circuit.json`.
- [x] Create `tsconfig.test.json` covering `tests/**/*.ts` (with `"types": ["node", "vite/client"]`, strict mode, bundler module resolution, and `noEmit`), and add it to the references in `tsconfig.json`.
- [x] Write `tests/unit/connectome/graph.test.ts`. The fixture must build; the outgoing list for `"1"` must be `[{ target: "2", synapseCount: 9 }, { target: "3", synapseCount: 1 }]`; and `"5"` must have an empty list. Add one failing case for each rule in R4: schema failure, `circuitId` mismatch, duplicate neuron ID, unsorted neurons, duplicate pair, self-connection, missing endpoint, non-integer count, count below the minimum, count mismatch with the manifest, and a start neuron that is unknown or a dead end. Assert each error's `code`.
- [x] Write `tests/unit/connectome/load.test.ts` with a fake `fetchImpl` covering success, a 404 response (`network`), a rejected fetch (`network`), altered bytes (`checksum`), and invalid JSON with a matching checksum (`schema`).
- [x] Write `tests/data/real-circuit.test.ts`. Read the committed files with `node:fs`, hash with `node:crypto`, and compare against the manifest. Assert that `buildGraph` succeeds, the counts equal 97, 936, and 25,379, `startNeuronIds` equals the R3 list, and every neuron's `class` is `MBON`.
- [x] Add `data:validate` and update `check` as described in R2.
- [x] Temporarily make `App.tsx` call `loadCircuit(import.meta.env.BASE_URL)` once and show `data-testid="circuit-status"` with "Circuit ready: 97 neurons, 936 connections" or the error code and message.

**Verify**

1. `npm run check` passes.
2. Change one `synapseCount` in `public/data/circuits/mbon-v1/circuit.json`, confirm `npm run data:validate` fails with a checksum mismatch, then restore the file with `git checkout -- public/data`.
3. `grep -rnE "from '(react|tone)'" src/connectome` prints nothing.

- [x] All verification steps pass.

## Phase 6: Encode WAV files

**Agent** · **Read:** R11

Build and test the WAV encoder before any audio code depends on it.

- [x] Implement `encodeWav16` in `src/audio/wav.ts` as specified in R11. Throw if there are no channels or if channel lengths differ.
- [x] Implement `parseWavHeader(buffer: ArrayBuffer)` in `src/audio/wavInfo.ts`, returning `{ channels, sampleRate, bitsPerSample, dataBytes, frames, durationSeconds, peak }`, where `peak` is the largest absolute 16-bit sample value.
- [x] Write `src/audio/wav.test.ts`:
  - A stereo, 44,100 Hz, 441-frame input produces a total length of 1,808 bytes, a ChunkSize of 1,800, a ByteRate of 176,400, a BlockAlign of 4, and a data size of 1,764.
  - Sample conversion: 1 → 32767, −1 → −32768, 0.5 → 16384, −0.25 → −8192, 2 → 32767, and −3 → −32768.
  - Samples are interleaved as left 0, right 0, left 1, right 1.
  - Mono input works.
  - `parseWavHeader(encodeWav16(x))` reports the original channels, sample rate, frame count, duration, and peak.

**Verify**

1. `npm run check` passes.

- [x] All verification steps pass.

## Phase 7: Build the audio spike with a real traversal

**Agent** · **Read:** R1 (rule 2), R11

Prove, before building the real engine, that a real traversal can play live, keep playing in a background tab, and render to WAV through an explicitly supplied offline context.

- [x] Run `npm install --save-exact tone@15.1.22`.
- [x] Create temporary `src/audio/spike.ts` (Phase 16 deletes it):
  - `spikeNotes(graph)` starts at `graph.startNeuronIds[0]` and repeatedly follows the outgoing connection with the most synapses (the first in sorted order on a tie), collecting up to 8 neurons and stopping at a dead end. It maps each ID to `[62, 65, 67, 69, 72][Number(BigInt(id) % 5n)]` and returns `{ neuronId, type, midi }[]`.
  - `startSpike(graph)` awaits `Tone.start()`, takes `const context = Tone.getContext()`, creates `new Tone.PolySynth({ context, voice: Tone.FMSynth, volume: -10 })` connected to `context.destination`, sets `context.transport.bpm.value = 90`, and schedules one `context.transport.scheduleRepeat` callback every `'8n'` that plays the next note at the supplied `time` for 0.3 s, looping through the notes. Then it starts the transport.
  - `stopSpike()` stops the transport, cancels its events, and disposes the synth.
  - `renderSpikeWav(graph)` creates `new Tone.OfflineContext(2, 3, 44100)` and a synth with `{ context: offlineContext }` connected to `offlineContext.destination`. It triggers the notes at `i / 3` seconds for 0.3 s each, awaits `offlineContext.render()`, reads both channels with `getChannelData`, and returns a `Blob` of `encodeWav16` output with type `audio/wav`.
- [x] Add a temporary spike section to `App.tsx` showing the circuit status, the traversal (ID, type, note), **Play spike**, **Stop spike**, and **Render spike WAV** buttons, `data-testid="audio-state"` with the live context state (updated on `statechange`), and a download link `data-testid="spike-download"` with `download="lofly-spike.wav"`. Revoke the previous object URL before rendering again.
- [x] If rendering with an explicit context throws (for example, a cross-context connection error), try `Tone.Offline` with the live transport stopped. Keep only the approach that works, and record the result and any error text in the Decision log.
- [x] Run `npm install --save-dev --save-exact @playwright/test@1.63` and `npx playwright install chromium firefox webkit`. Create `playwright.config.ts` with `testDir: 'tests/browser'`; `webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 }`; `use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' }`; and projects `chromium`, `firefox`, and `webkit` using `devices['Desktop Chrome']`, `devices['Desktop Firefox']`, and `devices['Desktop Safari']`. Add the config to `tsconfig.node.json` and add the `test:browser` script.
- [x] Write `tests/browser/spike.spec.ts`: wait for `circuit-status` to contain "97 neurons"; click Play spike and expect `audio-state` to read `running` within 5 s; wait 1.5 s and click Stop spike; click Render spike WAV; click `spike-download` and capture the `download` event; read the file and assert with `parseWavHeader` that it has 2 channels, 44,100 Hz, 16 bits, a duration within 0.01 s of 3 s, and a peak above 1,000.
- [x] Add Decision log rows for the offline rendering approach and each browser's result, including error text for failures.

**Verify**

1. `npm run check` passes.
2. `npm run test:browser` passes in Chromium. For Firefox and WebKit, the spec passes or the failure is recorded in the Decision log with its error text.

- [x] All verification steps pass.

## Phase 8: Human gate — review the data and the audio spike

**User** · **Read:** R3, the extraction report

**Gate status:** Approved to continue by the user on 2026-09-30 (see Decision log). Proceed to Phase 9. The checkboxes below remain user-owned records of the individual manual checks.

- [ ] Run `npm run build && npm run preview` and open http://localhost:4173 in current desktop Chrome, Firefox, and Safari. In each, press **Play spike** and confirm the phrase sounds clean. Record the browser versions in the Decision log.
- [ ] In each browser, start the spike, switch to another tab for 2 minutes, and return. Confirm the audio kept playing without stuttering and without a burst of catch-up notes. Record the results.
- [ ] In each browser, render and download the spike WAV and play it in QuickTime Player or VLC. Record the results.
- [ ] Read `scripts/data/reports/mbon-v1-extraction.md`. Optionally compare three sample connections in neuPrint Explorer (free login, dataset `male-cns:v1.0`). neuPrint may apply a different confidence threshold, so note any difference instead of treating it as an error.
- [ ] Approve the MBON circuit at 3 or more synapses, or write the requested change in the Decision log.
- [ ] Record any unresolved compatibility issues in the Decision log.

## Milestone 2: Build the musical core

Exit criteria from the plan: a real-graph arrangement plays for five minutes; the same recipe reproduces its events; every non-restart transition is valid; and candidate presets pass an initial listening review.

## Phase 9: Add seeded randomness, versions, and score types

**Agent** · **Read:** R1, R5, R6 (types), R7 (types), R8 (types)

- [x] Create `src/music/versions.ts` exactly as in R5.
- [x] Create `src/music/rng.ts` with the exact `fnv1a32`, `mulberry32`, `Rng`, and `createRng` from R5, and `clamp(value, min, max)` in `src/music/math.ts`.
- [x] Create `src/music/streams.ts` with `compositionPhraseIndex(variation, phraseIndex)`, `compositionStreams(sessionSeed, compositionPhraseIndex)` returning `{ traversal, rhythm, humanize }`, `animationRng(sessionSeed)`, `jokesRng(sessionSeed)`, `bufferRng(name, sampleRate)`, and `seedHex(seed)`, all using the seed texts in R5.
- [x] Create `src/app/seed.ts` with `randomSessionSeed()` using `crypto.getRandomValues`.
- [x] Create `src/music/types.ts` containing `WalkStep` (R6) and the R7 types. Create `src/presets/types.ts` with the R8 types, leaving out `sound` and `visual` for now.
- [x] Write `src/music/rng.test.ts` covering every R5 test vector; `int` staying within range; `pick` throwing on an empty array; identical sequences for identical seed texts; and different sequences for different texts.
- [x] Write `src/music/streams.test.ts`: `seedHex(1)` is `00000001`; `seedHex(0xdeadbeef)` is `deadbeef`; `compositionPhraseIndex(0, 7)` is 0; `compositionPhraseIndex(0.3, 7)` is 7; and the traversal stream for seed 1, phrase 0 produces the same first three values as `createRng('1|0|1|traversal')`.

**Verify**

1. `npm run check` passes.
2. `grep -rn "Math.random" src` prints nothing.

- [x] All verification steps pass.

## Phase 10: Implement seeded graph traversal

**Agent** · **Read:** R4 (TypeScript contract), R5, R6

- [x] Implement `walkPhrase` in `src/music/traversal.ts` exactly as specified in R6.
- [x] Create test helpers: `tests/unit/helpers/fixtureGraph.ts`, which loads the branching fixture with `node:fs` and `buildGraph` and accepts an optional function to modify the connections before building; and `tests/unit/helpers/scriptedRng.ts`, which returns listed floats in order and then continues with `createRng('scripted-fallback')`.
- [x] Write `tests/unit/music/traversal.test.ts` using the branching fixture:
  1. Start choice: first float 0.0 starts at `"1"`; 0.5 starts at `"2"`.
  2. At variation 0, the edges from `"1"` have weights 81 and 1 (total 82). A float of 0.5 chooses `"2"` with probability 81/82; a float of 0.99 chooses `"3"`.
  3. Graph contribution: with connection 1→3 changed to 9 synapses, a float of 0.6 chooses `"3"`; with the original weights, 0.6 chooses `"2"`.
  4. At variation 1 (alpha 0.5), the weights from `"1"` are 3 and 1. A float of 0.7 chooses `"2"`; 0.8 chooses `"3"`.
  5. Dead end: floats `[0.5, 0.75, 0.1, 0.0]` produce beats 0–4 of `start "2"`, `edge "4"`, `edge "5"`, `rest`, `restart "1"`.
  6. The number of floats consumed equals 1 plus the number of `edge` steps plus the number of `restart` steps.
- [x] Write `tests/data/traversal-real.test.ts` on the real circuit. For seeds 1–50 at variations 0, 0.5, and 1, using `createRng(`${seed}|0|1|traversal`)`: each walk has 32 steps; beats 0, 4, …, 28 are never rests; every edge exists in `graph.outgoing` with a matching synapse count; every start and restart uses a start neuron; and every probability is greater than 0 and at most 1.
- [x] In the same file, assert that seed 1, phrase 0, variation 0 produces these first eight steps: `start 13768`, `edge 38853`, `edge 531829`, `edge 13728`, `edge 38853`, `edge 531829`, `edge 13728`, `edge 521526`. This sequence was computed during preparation with the R5 and R6 rules.

**Verify**

1. `npm run check` passes.
2. `grep -rnE "from '(react|tone)'" src/music` prints nothing.

- [x] All verification steps pass. The real-graph sequence matches the prepared sequence.

## Phase 11: Define presets and harmony

**Agent** · **Read:** R7 (chord qualities, harmony), R8

- [x] Create `src/presets/presets.ts` with the R8 `PRESETS` literal, `DEFAULT_PRESET_ID = 'rainy-windowsill'`, and `getPreset(id)`.
- [x] Create `src/music/harmony.ts` with `CHORD_QUALITIES`; `chordPitchClasses(chord)`; `voicingCandidates(chord, range)`; `chooseVoicing(chord, range, previous: number[] | null)`; `bassRootMidi(rootPitchClass)`; `ringIndexFor(neuron)`; the pure helper `applyRingRule(rawIndices: number[]): { index: number; stepped: boolean }[]`; and `chooseChordSlots(graph, walk, preset): ChordSlot[]`.
- [x] Write `src/music/harmony.test.ts`:
  - Each preset has 6 chords.
  - Every voicing pitch class and every root-plus-7 pitch class belongs to its key: D natural minor {0, 2, 4, 5, 7, 9, 10}, C natural minor {0, 2, 3, 5, 7, 8, 10}, or A Dorian {0, 2, 4, 6, 7, 9, 11}.
  - The five voicing test vectors in R7 are reproduced.
  - Every candidate lies within its range and has four ascending notes.
  - `bassRootMidi(0)` is 36, `bassRootMidi(2)` is 38, and `bassRootMidi(11)` is 47.
  - `applyRingRule([3, 3, 3, 5])` returns indices `[3, 4, 3, 5]` with only the second marked as stepped; `applyRingRule([5, 5])` returns `[5, 0]`.
  - `ringIndexFor({ id: '5', type: null, … })` equals `fnv1a32('id:5') % 6`.

**Verify**

1. `npm run check` passes.

- [x] All verification steps pass.

## Phase 12: Compose chords, bass, and keys

**Agent** · **Read:** R5, R6, R7, R8

Build the graph-driven layers. Phase 13 adds drums, embellishment notes, and humanization.

- [x] Create `src/music/patterns.ts` containing the bass cell lists and keys comping patterns from R7.
- [x] Create `src/music/compose.ts` with `composePhrase`. In this phase it implements R7 steps 1–5 and produces bass and keys events in canonical order, with `microOffset` 0 and unmodified velocities. Implement every rhythm-stream draw now, including the embellishment and fill decisions, so that Phase 13 does not change the draw order; store the embellishment decisions for Phase 13 to turn into notes, and set `score.fill`.
- [x] Fill in each trace step's `neuronType` and `uses` as described in R7.
- [x] Write `tests/unit/music/compose.test.ts` using the branching fixture and every preset:
  - Composing twice with the same inputs gives deeply equal scores.
  - There are 4 chord slots and 32 trace steps with correct `bar` and `beatInBar`.
  - For seeds 1–100 at variations 0, 0.5, and 1, all bass and keys invariants from R7 hold.
  - Beats with a `rest` trace step have no bass note onsets.
  - At variation 0, bars 4–7 reuse bars 0–3's keys patterns, and their `uses` text says so.
  - At variation 0, phrases 0 and 5 are equal except for `phraseIndex`.
  - Changing connection 1→3 from 1 to 9 synapses changes the chord slots or bass cells for at least one seed from 1 to 20.
- [x] Write `tests/data/compose-real.test.ts`. For seeds 1–30, every preset, and variations 0, 0.5, and 1 on the real circuit, all invariants hold and every trace edge is valid.

**Verify**

1. `npm run check` passes.

- [x] All verification steps pass.

## Phase 13: Compose drums, variation, and humanization

**Agent** · **Read:** R5, R7 (rhythm stream, drums, canonical order and humanization), R8

- [x] Add drum events to `composePhrase`: the `main` pattern in bars 0–2 and 4–6, the `turn` pattern in bars 3 and 7, and the fill replacement in bar 7 when `score.fill` is true.
- [x] Add embellishment notes from the decisions stored in Phase 12.
- [x] Apply humanization last, as specified in R7.
- [x] Extend the tests:
  - Drum hits match the preset patterns, including turn bars. Fills replace bar 7's steps 12–15 only when `score.fill` is true.
  - Variation 0 never produces embellishments. For Fruit Bowl Finals at variation 1, at least one seed from 1 to 50 has an embellishment.
  - Humanized velocities are between 0.05 and 1. Each `microOffset` is at least 0 and at most its voice's maximum.
  - Events remain in canonical order, and the per-bar density and polyphony limits hold.
- [x] Add `tests/data/compose-snapshot.test.ts` using `toMatchFileSnapshot('__snapshots__/rainy-windowsill-seed-1-variation-50.json')` for the real circuit, seed 1, phrase 0, variation 0.5, and Rainy Windowsill. Increment `MAPPING_VERSION` and update this snapshot whenever composition output changes.

**Verify**

1. `npm run check` passes.

- [x] All verification steps pass.

## Phase 14: Add the timing adapter and seeded audio buffers

**Agent** · **Read:** R5, R9 (timing adapter), R10 (seeded buffers)

- [x] Implement `src/audio/timing.ts` exactly as in R9, and test every R9 test value in `src/audio/timing.test.ts`.
- [x] Implement `src/audio/buffers.ts` as specified in R10.
- [x] Write `src/audio/buffers.test.ts` at 44,100 Hz:
  - Rendering any buffer twice produces identical samples.
  - Lengths: `kick` has 22,050 samples; `rain` has 2 channels of 341,775 samples; `crackle` has 2 channels of 253,575 samples; `impulse` has 2 channels of 97,020 samples.
  - Each buffer's absolute peak equals its R10 value within 1e-6. No sample is NaN. RMS is above 0.001.
  - For `rain`, the absolute difference between the last and first samples of each channel is below 0.1.
- [x] Render all six buffers at 48,000 Hz in one test and log the elapsed time. Fail only if it exceeds 2 seconds.

**Verify**

1. `npm run check` passes.
2. `grep -rn "Math.random" src` prints nothing.

- [x] All verification steps pass.

## Phase 15: Build the instrument and effects rig

**Agent** · **Read:** R1 (rule 2), R9 (timing adapter), R10

- [x] Add `SoundParams` from R10 to `src/presets/types.ts`, and add each preset's `sound` values from the R10 table.
- [x] Implement `createRig` in `src/audio/rig.ts` as specified in R10, including a helper that converts buffer data to a native `AudioBuffer`. Every Tone node receives the context argument.
- [x] Run `npm install --save-dev --save-exact @vitest/browser-playwright@5`. Add a second project to `vitest.config.ts`: `{ test: { name: 'audio', include: ['tests/audio/**/*.test.ts'], browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] } } }`, importing `playwright` from `@vitest/browser-playwright`. Add the `test:audio` script, and set `resolveJsonModule: true` in `tsconfig.test.json`.
- [x] Write `tests/audio/rig.test.ts`. For each preset, compose phrase 0 of seed 1 at variation 0.5 on the branching fixture (imported as JSON). Render the first bar's events offline with `new Tone.OfflineContext(2, 16 * secondsPerStep(bpm) + 1, 44100)`, triggering each event at `eventTimeSeconds`. Assert that no sample is NaN, the absolute peak is at most 1.0, and RMS is above 0.01.
- [x] In the same file, assert that rendering with all three layers muted and ambience off gives a peak below 0.001, and that muting only the drums changes the output compared with the full mix.

**Verify**

1. [x] `npm run check` passes.
2. [x] `npm run test:audio` passes.

- [x] All verification steps pass.

## Phase 16: Build the live engine and audition page

**Agent** · **Read:** R1, R9, R10, R12 (debug mode, test IDs)

- [x] Implement `PlaybackSequencer` in `src/audio/sequencer.ts` with the constructor, getters, `reset`, and `advance` from R9. `request` and `applyTempoNow` come in Phase 20.
- [x] Write `src/audio/sequencer.test.ts` with a fake `compose` function that records its calls and returns small scores. Test that 128 advances call `compose` once for phrase 0 and the 129th calls it for phrase 1; that each plan returns the events for its step and correct `bar` and `beat`; that `reset` returns to step 0 and phrase 0; and that no more than 2 scores are held.
- [x] Implement `src/audio/engine.ts` following R9 engine rules 1–6, without pending changes, mix controls, export, or interruption handling.
- [x] Replace the spike UI with a temporary audition page in `App.tsx`. It shows the circuit status and has a preset select, a seed number input with a **Random seed** button, variation and tempo sliders, a **Start / Restart** button that applies the settings with `engine.reset` and plays, a `play-toggle` button, `engine-status`, `position`, the current phrase's four chord symbols, and the latest eight trace steps as text.
- [x] Create `src/components/DiagnosticsPanel.tsx` and render it only with `?debug=1` (R12).
- [x] Delete `src/audio/spike.ts`, the spike UI, and `tests/browser/spike.spec.ts`.
- [x] Write `tests/browser/engine.spec.ts` (Chromium). Load `/?debug=1` and click Start / Restart; expect `engine-status` to read `playing` and `position` to change within 3 s. Pause; expect `position` to stay unchanged for 1.5 s. Play; expect it to advance again. Click `play-toggle` 20 times quickly, ending in the playing state, and expect diagnostics to show `repeatEvents` equal to 1. Pause, wait 2.5 s, and expect `keysActiveVoices` to equal 0.
- [ ] Write `tests/browser/soak.spec.ts`, skipped unless `SOAK=1` is set. It plays for 5 minutes in Chromium, reads diagnostics every 30 s, and asserts that `repeatEvents` is 1, `scoresHeld` is at most 2, `keysActiveVoices` is at most 8, and the status stays `playing`. Run it once and record the result in the Decision log.

**Verify**

1. `npm run check` passes.
2. `npm run test:audio` passes.
3. `npx playwright test --project=chromium` passes.
4. `SOAK=1 npx playwright test tests/browser/soak.spec.ts --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 17: Human gate — listening review

**User** · **Read:** R7, R8, R10

**Gate status:** Approved to continue by the user on 2026-10-01 (see Decision log): "lgtm, do your best to continue without my feedback". The user gave no concrete listening requests, so Phase 18 changes no code. Proceed to Phase 18. The seven checkboxes below and the **Listening notes** line remain user-owned records of the individual manual checks; no agent listened to the audio.

Agents: do not check these boxes. Stop and report that Phase 17 is waiting for the user.

- [ ] Run `npm run build && npm run preview` and open http://localhost:4173/?debug=1 in desktop Chrome.
- [ ] For each preset, listen to seeds 1, 2, and 3 for at least 2 minutes each at variation 0. Listen to one seed per preset at variation 100.
- [ ] Listen to each preset at 60 BPM and at 100 BPM.
- [ ] Judge against the plan: a stable groove; compatible bass and chords; clearly different presets; no clicks, harsh clipping, or piercing frequencies; and variation that audibly changes the music without breaking the groove.
- [ ] During one 5-minute session, watch the diagnostics and confirm voices don't accumulate and playback doesn't stop.
- [ ] Write concrete requests under **Listening notes**, for example "Fruit Bowl Finals hats too loud; reduce by about 30%", or write "Approved as is." Name a default seed if one sounded best.
- [ ] Decide whether the synthesized voices meet the listening bar. If not, name which voices should become locally hosted, appropriately licensed samples.

**Listening notes**

- *(The user writes notes here.)*

## Phase 18: Apply the listening review

**Agent** · **Read:** Phase 17 listening notes, R5, R7, R8, R10

- [x] Implement every request in the Phase 17 listening notes. If the notes say "Approved as is," change no code and check the remaining boxes.
- [x] If composition output changed, increment `MAPPING_VERSION`, update the snapshot, and update R7 and R8 in this document so later phases use the new values.
- [x] If sound parameters changed, update the R10 tables in this document.
- [x] If the user named a default seed, update `DEFAULT_SESSION_SEED` and R5.
- [x] If the user asked for sample-based voices, stop and report, because choosing and licensing samples needs the user.
- [x] Add a Decision log row summarizing the changes.

**Verify**

1. `npm run check` passes.
2. `npm run test:audio` passes.
3. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Milestone 3: Complete the player and export

Exit criteria from the plan: all controls follow the specified timing; repeated interaction creates no duplicate audio; exported notes and timing match the captured score; and the file plays in an independent audio player.

## Phase 19: Add the session store and persistence

**Agent** · **Read:** R5, R10 (`MixSettings`), R12

- [x] Create `src/app/store.ts` with `createStore` and `useAppState` (R12).
- [x] Create `src/app/state.ts` with `AppState`, `createInitialState(restoredSettings)`, an action union, and a reducer. Actions: `circuitLoading`, `circuitLoaded`, `circuitFailed`, `engineStatusChanged`, `audioNoticeChanged`, `tempoRequested`, `variationRequested`, `newBeatRequested`, `presetRequested` (each request carries `immediate: boolean`), `changesApplied`, `phraseStarted`, `positionChanged`, `mixChanged`, `exportStateChanged`, `animationToggled`, and `storageUnavailable`.
- [x] Reducer rules: an immediate request updates `active` and clears that field from `pending`; an immediate New beat or preset also resets `position` to phrase 0, bar 0, beat 0 and clears `activeScore`; a non-immediate request sets the `pending` field; `changesApplied` replaces `active` and removes pending fields that now equal the active values. A preset request also sets the preset's tempo.
- [x] Create `src/app/persistence.ts` with `loadSettings(getStorage)` and `createSettingsSaver(getStorage, delayMs = 500)` following R12. `getStorage` is a function so tests can make storage access throw.
- [x] Write reducer tests for every action and rule, and persistence tests covering an in-memory storage, invalid JSON, a wrong shape, storage whose access throws, and debouncing with `vi.useFakeTimers()`.

**Verify**

1. `npm run check` passes.

- [ ] All verification steps pass.

## Phase 20: Apply pending changes at musical boundaries

**Agent** · **Read:** R9 (sequencer, engine), R12 (control behavior)

- [x] Add `request` and `applyTempoNow` to `PlaybackSequencer` (R9), and report applied kinds in each `StepPlan`.
- [x] Extend `src/audio/sequencer.test.ts`:
  - A tempo requested at step 5 applies at step 16, not earlier.
  - A variation requested at step 5 applies at step 128.
  - A preset requested mid-phrase applies at step 128 together with its tempo, and phrase numbering continues.
  - A New beat requested at step 50 applies at step 128, where the phrase index becomes 0 and composition uses the new seed.
  - A second request for the same field replaces the first.
  - Requests made before the first composition apply immediately.
  - `applyTempoNow` changes the tempo without moving the position.
- [x] Add `request(change)` and `applyTempoNow(bpm)` to the engine. Set `transport.bpm` at the step's audio time and emit `applied`. Export an `EngineLike` interface from `engine.ts` describing the engine's public methods and events.
- [x] Create `src/app/controller.ts` with `SessionController`, which depends on `EngineLike`. Implement `loadCircuit`, `startListening`, `togglePlay`, `setTempo`, `setVariation`, `newBeat`, and `selectPreset` using the R12 control table. While paused, tempo uses `applyTempoNow`, and New beat or preset uses `engine.reset(newRecipe)`. Before the first start, all changes update the store only. Subscribe to engine `status`, `phraseStarted`, `applied`, and `position` events, dispatch matching actions, and save settings on every change.
- [x] Create `src/app/ControllerContext.tsx` with a provider and a `useController()` hook, and create the controller once in `main.tsx`.
- [x] Switch the temporary audition page to the controller and add `pending-changes` text.
- [x] Write `src/app/controller.test.ts` with a fake `EngineLike`, verifying which engine method is called and what the store contains for each control in each state (idle, playing, paused).
- [x] Write `tests/browser/boundaries.spec.ts` (Chromium). Start at 100 BPM. While playing, change variation; `pending-changes` shows it; it clears after the phrase index advances (within 21 s). Change tempo while playing; the pending text appears and clears within 3 s.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 21: Build the player controls

**Agent** · **Read:** R12, R14

- [x] Create these components in `src/components/`: `StartListening.tsx`, `TransportControls.tsx` (`play-toggle`, `engine-status`, and `position`, displayed 1-based as "Phrase 1 · Bar 1 · Beat 1"), `TempoControl.tsx`, `VariationControl.tsx`, `NewBeatButton.tsx`, `PresetPicker.tsx` (radio inputs in a `<fieldset>` with a `<legend>`), `NowPlaying.tsx` (track title, preset name, and seed as `seedHex`), and `PendingChanges.tsx`.
- [x] Use native controls with visible labels: `<label>`, `<input type="range">`, and `<output>` for sliders, and text buttons.
- [x] Replace the audition page in `App.tsx` with a header (title and tagline), a placeholder box where the scene will go, and the controls. Delete the audition code.
- [x] Disable Start listening until the circuit is ready. After the first start, show `play-toggle` in its place.
- [x] Write `tests/browser/controls.spec.ts` (Chromium):
  - A first visit shows Start listening, and diagnostics report status `idle`.
  - Clicking Start listening leads to status `playing`.
  - Selecting a preset while paused applies it immediately: the position resets and Now playing shows the new preset.
  - New beat while paused changes the seed and resets the position. New beat while playing shows a pending change that clears at the next phrase.
  - After a reload, the page is paused at phrase 1 with the same preset, seed, tempo, and variation.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 22: Build the mixer

**Agent** · **Read:** R10 (`MixSettings`, rig), R12

- [x] Add `setMix(mix)` to the engine. It calls `rig.setMix(mix, context.currentTime)` and starts or stops ambience when `ambienceOn` changes during playback. `start()` applies the stored mix, and `pause()` restores the master gain to `mix.masterVolume`.
- [x] Add `setMix(partial)` to the controller. It merges the change, dispatches `mixChanged`, and calls the engine only after the first start.
- [x] Create `src/components/MasterVolume.tsx` (`master-volume`) beside the transport controls, and `src/components/Mixer.tsx` with a level slider and mute checkbox per layer plus the ambience checkbox, grouped in a `<fieldset>` with `<legend>Mixer</legend>`.
- [x] Write `tests/audio/mix.test.ts`. An offline render with master volume 0 is silent. Changing the drums level from 0.8 to 0 at 0.5 s makes RMS after 0.6 s less than 5% of RMS before 0.5 s, and no sample-to-sample jump between 0.49 s and 0.56 s exceeds 0.5.
- [x] Write `tests/browser/mixer.spec.ts` (Chromium). Toggling every mute and the ambience checkbox while playing keeps the status `playing` and `repeatEvents` at 1. Mixer settings persist across a reload.

**Verify**

1. `npm run check` passes.
2. `npm run test:audio` passes.
3. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 23: Render a phrase offline

**Agent** · **Read:** R9 (timing adapter), R10, R11

- [x] Create `src/audio/export.ts` with `createExportSnapshot(score, recipe, preset, mix)` and `renderPhrase(snapshot)` as specified in R11.
- [x] Write `tests/audio/export.test.ts` (allow up to 60 s per test):
  1. At 60, 72, and 100 BPM, the rendered frame count is within 1 of `Math.round(exportSeconds(bpm) * 44100)`.
  2. A synthetic score with only kicks at steps 0, 16, 32, and 48 (velocity 1, no micro-offset), rendered at 72 BPM with ambience off, has onsets within 5 ms of 0, 3.333, 6.667, and 10.0 s. Detect an onset as the first sample above 0.05 after at least 50 ms below 0.01.
  3. A score with a single hat at step 1 and swing 0.56, at 72 BPM, has its onset within 5 ms of 0.2333 s.
  4. The final 10 ms of every render have RMS below 0.001.
  5. Rendering the same snapshot twice gives a maximum absolute sample difference below 1e-4.
  6. `Tone.getContext()` returns the same object before and after `renderPhrase`.

**Verify**

1. [x] `npm run check` passes (167 unit tests; evaluator re-run on 2026-10-04).
2. [ ] `npm run test:audio` passes. Evaluator re-run on 2026-10-04 stops before assertions with `listen EPERM: operation not permitted ::1:63315`; run on a Chromium/loopback-capable operator or CI runner.

- [ ] All verification steps pass.

## Phase 24: Build the export flow

**Agent** · **Read:** R11, R12

- [x] Add `beginExport()` and `endExport()` to the engine. They set status `exporting`, block `play()` and `start()`, and return the status to `paused` when done.
- [x] Add `exportPhrase()` and `dismissExport()` to the controller. Export requires an active score and ignores clicks while an export is running. It pauses playback, captures the snapshot from `active` (never `pending`), steps through the R11 states, encodes with `encodeWav16`, and creates the object URL. It revokes the previous URL before creating a new one and when dismissed. Add `getDiagnostics()` to the controller, combining the engine diagnostics with `objectUrlsHeld`, and show it in the diagnostics panel.
- [x] Create `src/components/ExportPanel.tsx` with the R11 description, `export-button` (disabled before the first start and during export), `export-status` inside a `role="status"` element, the `export-download` link with the file name as its `download` attribute, and a **Done** button that dismisses the result.
- [x] Add controller tests with a fake engine: the snapshot uses active rather than pending settings, a second export click during an export is ignored, and a rejected render leads to status `error` with the engine paused.
- [x] Write `tests/browser/export.spec.ts` (required in Chromium; also run in Firefox and WebKit and record failures):
  - Start listening, wait 2 s, and export. The status ends at `ready`, and the engine status is `paused`.
  - The download's name matches `^lofly-rainy-windowsill-seed-[0-9a-f]{8}\.wav$`. `parseWavHeader` reports 2 channels, 44,100 Hz, 16 bits, a duration within 0.01 s of `exportSeconds(72)`, and a peak above 1,000.
  - After three exports in a row, diagnostics show `objectUrlsHeld` of at most 1 and `repeatEvents` of 1, and clicking Play resumes playback.

**Verify**

1. `npm run check` passes.
2. `npm run test:audio` passes.
3. `npm run test:browser` passes in Chromium. Firefox and WebKit results are recorded in the Decision log.

- [ ] All verification steps pass.

## Phase 25: Handle loading, errors, and interruptions

**Agent** · **Read:** R9 (engine rules), R12 (failure behavior, debug mode), R14

- [x] Create `src/components/CircuitStatus.tsx`, showing the R14 loading text or the R12 error message with a `circuit-retry` button that calls `controller.loadCircuit()`.
- [x] Handle interruptions in the engine. Subscribe with `context.on('statechange', …)`. If the context state is anything other than `running` while the status is `playing`, pause the transport immediately without a ramp, release all voices, set status `interrupted`, and let the controller set the R12 notice. `play()` from `interrupted` awaits `Tone.start()` and then resumes the transport.
- [x] Add `debugInterrupt()` to the engine, which calls `context.rawContext.suspend()`, and a `simulate-interruption` button in the diagnostics panel.
- [x] Show the storage-unavailable note from R12.
- [x] Write `tests/browser/failures.spec.ts` (Chromium):
  1. With `**/circuit.json` answering 404, the error and Retry appear and Start listening is disabled. After removing the route, Retry leads to a ready circuit.
  2. With `circuit.json` answered by modified bytes, the error mentions the checksum.
  3. With `localStorage` made to throw through `page.addInitScript`, the app loads, plays, and shows the storage note.
  4. With `/?debug=1`, start playback and click `simulate-interruption`. The status becomes `interrupted`, the notice appears, and `position` stays unchanged for 1 s. Clicking Play resumes playback with `repeatEvents` still 1.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Milestone 4: Build the scene and explanation

Exit criteria from the plan: the fly and banana scene reads clearly on desktop and mobile; keyboard-only use works; visuals follow playback without affecting it; and the explanation distinguishes real connections from authored musical rules.

## Phase 26: Build the layout shell and visual tokens

**Agent** · **Read:** R12, R13 (visual parameters, responsive crop), R14

- [x] Add `VisualParams` (R13) to `src/presets/types.ts` and each preset's values from the R13 table.
- [x] Create `src/styles/tokens.css` with UI tokens (`--ui-bg`, `--ui-surface`, `--ui-text`, `--ui-muted`, `--ui-border`, `--focus`, a spacing scale, a radius, and the system font stack). Body text must reach a 4.5:1 contrast ratio; large text and control borders must reach 3:1. List the checked color pairs and their ratios in a comment.
- [x] Set `data-preset` and the active preset's visual values as CSS custom properties (`--scene-wall`, `--scene-window-sky`, and so on) on the app root.
- [x] Lay out the page in `src/styles/app.css`. At 960 px and wider, use two columns (scene 2fr, controls 1fr). From 700 to 959 px, put the scene on top with the controls in two columns below. Below 700 px, stack everything and add a sticky bottom bar containing `play-toggle` and `master-volume`. The page must not scroll horizontally at 320 px.
- [x] Create `src/app/useMediaQuery.ts` and `src/scene/SceneFrame.tsx`. The frame applies the R13 aspect ratios and `preserveAspectRatio` values and holds a placeholder SVG (`viewBox="0 0 1600 900"`) of colored rectangles using the scene tokens.
- [x] Give all interactive elements a `:focus-visible` outline of 3 px `var(--focus)` with a 2 px offset.
- [x] Under `prefers-reduced-motion: reduce`, set UI transitions to 0 s.
- [x] Write `tests/browser/layout.spec.ts` at 1280×800, 800×900, and 390×844. No horizontal scrolling occurs (`scrollWidth <= clientWidth`). At 390×844, after starting playback and scrolling halfway down, `play-toggle` and `master-volume` are inside the viewport. Attach a full-page screenshot for each size with `testInfo.attach`.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 27: Draw the room, window, desk, and banana

**Agent** · **Read:** R13

- [ ] Create the layer components from R13 (`Wall`, `Window`, `Rain`, `Lighting`, `Desk` with homework, pencil, and mug, and `Banana`) and compose them in `src/scene/Scene.tsx` in the R13 order. Add a simple placeholder silhouette `<g class="fly">` so the composition can be judged.
- [ ] Use only SVG shapes, gradients, and clip paths: no external images, no bundled fonts, and no `<text>` except the "HW" heading.
- [ ] Define rain streak and drop positions as fixed arrays in `src/scene/layers/rainLayout.ts`. Phase 31 adds animation timing.
- [ ] Take every color from the scene custom properties so each preset looks coherent.
- [ ] Replace the `SceneFrame` placeholder with `Scene`.
- [ ] Write `tests/browser/scene.spec.ts`. The SVG has its title and description. The `.fly` group and the banana group exist. Selecting another preset while paused changes the wall's computed fill. For each preset, attach screenshots at 1280×720 and 390×844. The serialized scene markup is under 150 KB.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 28: Draw the fly

**Agent** · **Read:** R13 (the fly)

- [ ] Create `src/scene/fly/Fly.tsx` with every class group in the R13 fly table. Show all six sleeves, the oversized headphones and cable, red compound eyes with highlights, antennae, and wings, with the front hands holding the pencil at the homework.
- [ ] Set transform origins in `src/scene/scene.css`, using `transform-box: fill-box` where needed.
- [ ] Draw the default studying pose: head tilted down about 4 degrees with the pencil on the page. Add no animation yet.
- [ ] Replace the placeholder silhouette with `Fly`.
- [ ] Extend `tests/browser/scene.spec.ts`. Each R13 fly class appears exactly once. The fly's `getBBox()` lies within x 800–1280 and y 230–740. For each preset, attach a close-up screenshot clipped to the fly at device scale factor 2.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 29: Human gate — scene art review

**User** · **Read:** R13

Agents: do not check these boxes. Stop and report that Phase 29 is waiting for the user.

- [ ] Run `npx playwright test tests/browser/scene.spec.ts tests/browser/layout.spec.ts --project=chromium`, then `npx playwright show-report` to view the attached screenshots.
- [ ] Run `npm run build && npm run preview` and look at the scene at desktop width and in a narrow, phone-sized window.
- [ ] Confirm that the fly reads as a fruit fly studying in oversized headphones and a six-sleeved hoodie, that the banana looks overripe, that the rain reads, that the three presets' lighting is distinct, and that the controls remain readable.
- [ ] Write concrete requests under **Scene notes**, or write "Approved as is."

**Scene notes**

- *(The user writes notes here.)*

## Phase 30: Apply the scene art review

**Agent** · **Read:** Phase 29 scene notes, R13

- [ ] Implement every request in the Phase 29 scene notes. If they say "Approved as is," change nothing and check the remaining boxes.
- [ ] If layout areas, classes, or colors changed, update R13 in this document.
- [ ] Add a Decision log row summarizing the changes.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 31: Animate the scene from musical cues

**Agent** · **Read:** R5 (animation stream), R9 (engine events), R12, R13 (animation cues)

- [ ] Create `src/scene/cues.ts` as pure functions: `createCueState(sessionSeed)`; `stepCue(state, stepEvent)` returning `{ bob: 'strong' | 'soft' | null }`; `phraseCue(state, phraseIndex)` returning `{ rub: boolean }`; `nextBlinkDelayMs(state)` returning 3,000–7,000; and `rainTimings(sessionSeed, count)` returning delays and durations. All randomness uses the animation stream.
- [ ] Write `src/scene/cues.test.ts`: strong bobs on beats 0 and 2 and soft bobs on beats 1 and 3; no bob on steps between beats; the R13 hand-rub rule (never phrase 0, never within two phrases of the previous rub); blink delays within range; and identical results for the same seed.
- [ ] Write `tests/data/animation-isolation.test.ts`. Composing phrases 0–3 for seed 1 produces identical scores whether or not 1,000 animation-stream draws happen between compositions.
- [ ] Expose engine `step` and `phraseStarted` events through the controller for the scene. Create `src/scene/useSceneCues.ts`, which subscribes to them and runs bob, blink, and rub animations on element refs with `element.animate()`. Do not update React state on each beat.
- [ ] Animate rain with CSS keyframes, setting each streak's `animationDelay` and `animationDuration` from `rainTimings`.
- [ ] Add the lighting transition (R13) when the active preset changes.
- [ ] Add the `animation-toggle` checkbox labeled "Animate scene." Its default follows `prefers-reduced-motion` while `animationEnabled` is `null` (R12); changing it stores `true` or `false`.
- [ ] Apply `.scene--still` when animation is off and `.scene--paused` while the document is hidden, and stop cue timers in both cases.
- [ ] Write `tests/browser/animation.spec.ts` (Chromium):
  - With `page.emulateMedia({ reducedMotion: 'reduce' })` and playback started, no animations inside the scene are running during 2 s. Turning the toggle on starts running animations.
  - With default motion while playing, `.fly-head` receives animations within 3 s.
  - After overriding `document.hidden` to true and dispatching `visibilitychange`, the scene has `.scene--paused` and diagnostics still report `playing`.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 32: Build the "How the beat is made" panel

**Agent** · **Read:** R6, R7 (trace), R12, R14 (explanation labels)

- [ ] Create `src/components/explanation/describe.ts`:
  - `describeTraceStep(step, graph)` returns `{ label: 'Real connection' | 'Authored rule', title, detail }`. An edge might read "MBON12 (13768) → MBON15 (…)" with detail "17 synapses · 42% chance · chose bass root-push". Show percentages without decimals, or "<1%". A start reads "Phrase start at MBON11 (10704)", a restart reads "Restart at … after a dead end", and a rest explains that the previous neuron has no outgoing connections in this subset.
  - `describeMappingRules(preset)` returns rule sentences generated from the code's constants: the two-bar chord slots and ring rule with the preset's chord symbols in ring order, the bass and keys rules, reuse, embellishment, fills, and humanization.
- [ ] Create `src/components/explanation/ExplanationPanel.tsx`: a `<details data-testid="explanation">` with the summary "How the beat is made" and these sections:
  - **The circuit:** manifest title, release, counts, synapse threshold, selection rule, and a link to the credits.
  - **Recent choices:** the latest 8 trace steps up to the current beat, newest first. Update at most once per bar while the panel is open, outside any live region. Edge rows carry `data-source`, `data-target`, and `data-synapses` attributes.
  - **This phrase's chords:** the 4 slot symbols, the neuron type that chose each, and whether the ring rule stepped.
  - **Rules we wrote:** the mapping rules.
  - **Versions:** mapping version, engine version, preset version, and the first 12 characters of the graph checksum.
- [ ] Write unit tests for both describe functions using the branching fixture.
- [ ] Write `tests/browser/explanation.spec.ts` (Chromium). Open the panel while playing. Within 8 s at least one "Real connection" row appears, and its source, target, and synapse count exist in `public/data/circuits/mbon-v1/circuit.json` (read in the test with `node:fs`).

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 33: Add credits, copy, and the asset manifest

**Agent** · **Read:** R3 (attribution), R4 (manifest), R14

- [ ] Create `src/components/Credits.tsx` with the R14 credits, in a section with `id="credits"` linked from the footer and the explanation panel.
- [ ] Apply the R14 copy to the header, loading state, Start listening, about line, and Now playing.
- [ ] Create `src/app/jokes.ts` with the R14 joke list and selection rule using the jokes stream, and `src/components/StatusJoke.tsx`, which shows the joke as plain text near Now playing, outside any live region.
- [ ] Create `ASSETS.md` in the repository root with a table covering: the scene SVG components (original artwork made for this project, with paths); audio (generated in `src/audio/buffers.ts` and by Tone synthesizers, with no samples); data (the MaleCNS files, CC BY 4.0, the citation, the filtering rules, and the manifest path); and fonts (system fonts only). End with "Update this file whenever an asset is added."
- [ ] Write a unit test for joke selection: deterministic for a seed, and never more often than once every three phrases.
- [ ] Write `tests/browser/credits.spec.ts`. The credits link to the CC BY 4.0 license URL and the preprint DOI, and they include `manifest.license.attribution` exactly.

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 34: Complete keyboard and accessibility support

**Agent** · **Read:** R12 (test IDs), R13, R14

- [ ] Run `npm install --save-dev --save-exact @axe-core/playwright@4`.
- [ ] Create `src/app/useKeyboardShortcuts.ts`. Space or K toggles playback, and N triggers New beat, but only when focus is on the document body or the scene, never in an input, select, textarea, button, or link. List the shortcuts in the controls area.
- [ ] Add one `role="status"` region with `aria-live="polite"` that announces engine status changes ("Playing", "Paused", the interruption notice) and export status. It never announces beats, positions, trace updates, or jokes.
- [ ] Give every control an accessible name. Give range inputs `aria-valuetext` such as "72 BPM" or "Variation 35 percent". Connect pending-change text to its control with `aria-describedby`.
- [ ] Mark decorative elements inside the scene SVG `aria-hidden="true"`, keeping the root's `role="img"` title and description.
- [ ] Write `tests/browser/a11y.spec.ts` (Chromium):
  - axe with tags `wcag2a`, `wcag2aa`, and `wcag21aa` reports no serious or critical violations on first load, while playing, with the explanation and credits open, and at 390×844.
  - Using only the keyboard, Tab from the top of the page reaches Start listening and Enter activates it. Tabbing through every control in DOM order shows a visible outline (computed `outline-style` other than `none`) on each focused element.
  - Pressing Space with focus on the body toggles playback, and the status region reads "Paused" and then "Playing".

**Verify**

1. `npm run check` passes.
2. `npx playwright test --project=chromium` passes.

- [ ] All verification steps pass.

## Milestone 5: Validate and prepare release

Exit criteria from the plan: the acceptance checks pass on the documented browser and device matrix, with any unsupported behavior stated accurately, and the static production build is ready for the selected host.

## Phase 35: Cover the acceptance criteria with tests

**Agent** · **Read:** [02-PLAN.md section 7](./02-PLAN.md#7-validation-and-acceptance), R12

- [ ] Create `tests/README.md` with a table that maps each row of the plan's validation table (data integrity, graph contribution, repeatability, musical constraints, audio lifecycle, export, failure recovery, accessibility, listening quality, and sustained use) to the automated tests covering it and to the Phase 38 manual checks.
- [ ] Add tests for any gaps the mapping reveals. At minimum, write `tests/browser/lifecycle.spec.ts` (Chromium):
  - Without a click, no audio starts: diagnostics stay `idle` for 3 s after load.
  - Ten preset selections within 2 s while playing leave `repeatEvents` at 1 and the status `playing`.
  - After an export, a preset change, and Play, there is still one engine, and `keysActiveVoices` is at most 8 after 3 s.
- [ ] Extend `tests/browser/soak.spec.ts` to read `SOAK_MINUTES` (default 5). After the soak, run five exports in a row and assert `objectUrlsHeld` is at most 1. Log `performance.memory.usedJSHeapSize` before and after the exports without asserting on it.
- [ ] Add the script `test:all` = `npm run check && npm run test:audio && npm run test:browser`, and add it to R2 in this document.
- [ ] Run `SOAK=1 SOAK_MINUTES=15 npx playwright test tests/browser/soak.spec.ts --project=chromium` once, and record the result and the logged memory values in the Decision log.

**Verify**

1. `npm run test:all` passes in Chromium. Firefox and WebKit failures are recorded in the Decision log with their error text.
2. The 15-minute soak run passes.

- [ ] All verification steps pass.

## Phase 36: Check performance budgets and the production preview

**Agent** · **Read:** R2, [02-PLAN.md section 7](./02-PLAN.md#7-validation-and-acceptance) (performance budgets)

- [ ] Write `scripts/measure-budgets.mjs`. After a build, it gzips (level 9, with `node:zlib`) `dist/data/circuits/mbon-v1/circuit.json` and every file in `dist/` except source maps. It prints a table and exits with status 1 if the circuit exceeds 200 KiB or the total exceeds 4 MiB. Add the `budget` script.
- [ ] Write `tests/browser/startup.spec.ts` (Chromium). After the circuit is ready, measure the time from clicking Start listening to status `playing` and to the first `position` change. Assert that both are under 2,000 ms, and log the values.
- [ ] Write `scripts/serve-subpath.mjs`, which serves `dist/` under `/nested/lofly/` on port 4174 with `node:http` and correct content types for HTML, JavaScript, CSS, JSON, and SVG. Write `tests/browser/subpath.spec.ts`, which starts that server in `beforeAll` (the Playwright web server has already built `dist/`), opens `http://localhost:4174/nested/lofly/`, waits for the circuit to be ready, starts listening, and expects `playing`. Stop the server in `afterAll`.
- [ ] Record the gzipped circuit size, total gzipped size, and startup timings in the Decision log.

**Verify**

1. `npm run build && npm run budget` passes.
2. `npx playwright test tests/browser/startup.spec.ts tests/browser/subpath.spec.ts --project=chromium` passes.

- [ ] All verification steps pass.

## Phase 37: Write the README and data regeneration guide

**Agent** · **Read:** R1–R4, R11, R12, `ASSETS.md`, `scripts/data/reports/mbon-v1-extraction.md`

- [ ] Rewrite `README.md` with these sections:
  - **What it is:** one paragraph and the tagline.
  - **Quick start:** Node 22, `npm ci`, and `npm run dev`.
  - **Commands:** the R2 table.
  - **How it works:** real circuit, seeded walk, authored mapping, and Tone.js, with links to the docs.
  - **Audio behavior:** Start listening is required; playback in background tabs; interruption recovery; export details (8 bars plus a 2-second tail, stereo 44.1 kHz 16-bit WAV, pending changes excluded).
  - **Browser support:** a placeholder table noting that Phase 38 confirms support.
  - **Data:** source, release, license, citation, filtering, file locations, and checksum verification.
  - **Regenerating the data:** installing uv, then `npm run data:download`, `data:extract`, `data:verify`, and `data:validate`; about 1.1 GB of download and disk space; the expected R3 values; and what to update when the circuit changes.
  - **Testing:** unit, audio, and browser tests, soak runs, budgets, and `npx playwright install chromium firefox webkit`.
  - **Deployment:** serve the static `dist/` directory from any static host, with no backend or secrets. `base: './'` supports subdirectories, and the data is served from the same origin.
  - **Project structure** and **Credits**, linking `ASSETS.md`.
- [ ] Write `scripts/data/README.md` covering the config fields, each script and its outputs, the expected results from R3, how to select a different circuit (edit the config, rerun the pipeline, and update the tests' expected values and R3), and troubleshooting (for a checksum mismatch, delete the cached file and download again).
- [ ] Confirm that every command either README mentions appears in `npm run` output or runs as written.

**Verify**

1. `npm run check` passes.
2. Every README command is listed by `npm run` or was run successfully.

- [ ] All verification steps pass.

## Phase 38: Human gate — release validation

**User** · **Read:** [02-PLAN.md section 7](./02-PLAN.md#7-validation-and-acceptance), `tests/README.md`

Agents: do not check these boxes. Stop and report that Phase 38 is waiting for the user.

- [ ] Fill in the browser and device matrix below with the versions and devices you actually tested.
- [ ] In each desktop browser, play for 15 minutes in the foreground and 5 minutes in a background tab with `?debug=1`. Confirm that playback never stops and that the diagnostics show no growing voice, score, or object URL counts.
- [ ] In each desktop browser, export five times in a row and play the files in QuickTime Player or VLC.
- [ ] On iOS Safari and Android Chrome, check playback, controls, recovery after briefly switching apps or locking the screen, and export downloads. Decide whether mobile export is supported and record the decision in the Decision log.
- [ ] Listen to all three presets across three seeds for 2 minutes each, at low and high variation and at 60 and 100 BPM. Confirm a stable groove, compatible bass and chords, distinct presets, and no clicks or harsh clipping.
- [ ] Use the app with only the keyboard, and spot-check it with VoiceOver on macOS. Status changes are announced; beats are not.
- [ ] Check the reduced-motion setting and the animation toggle.
- [ ] On a reference laptop and phone, confirm audio starts within 2 s of Start listening and does not break up while the scene animates. Record the device models.
- [ ] Choose the static host, or record that the choice is deferred.
- [ ] Confirm the plan's MVP completion checklist:
  - [ ] A first-time visitor can start an enjoyable beat without setup or an account.
  - [ ] One verified real circuit materially selects the bass and chord motifs.
  - [ ] Three musical layers, three distinct presets, tempo, variation, mixer, and New beat work together.
  - [ ] The illustrated fly studies beside the banana and responds subtly to the music.
  - [ ] Eight-bar WAV export uses the captured score and settings and downloads successfully on the supported platforms.
  - [ ] The graph source, license, filtering, and authored mapping are documented and credited.
  - [ ] Keyboard access, reduced motion, errors, and audio interruptions have been verified.
  - [ ] Required checks pass and the production build can be served by a static host.
- [ ] Write the issues to fix under **Release notes**, or write "Ready to release."

**Browser and device matrix**

| Browser or device | Version | Playback | Controls | Background tab | Interruption recovery | Export plays | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome (desktop) | | | | | | | |
| Firefox (desktop) | | | | | | | |
| Safari (desktop) | | | | | | | |
| iOS Safari | | | | Not applicable | | | |
| Android Chrome | | | | Not applicable | | | |

**Release notes**

- *(The user writes notes here.)*

## Phase 39: Apply release fixes and produce the final build

**Agent** · **Read:** Phase 38 matrix and release notes, `README.md`

- [ ] Fix every issue in the Phase 38 release notes. If they say "Ready to release," change no code.
- [ ] Replace the README's browser support placeholder with the Phase 38 matrix, stating unsupported behavior accurately (for example, mobile export or mobile background playback, if unsupported).
- [ ] If Phase 38 chose a host that needs configuration files, add them and document them in the README. Otherwise add nothing host-specific.
- [ ] From a clean install (`rm -rf node_modules dist && npm ci`), run `npm run test:all` and `npm run budget`.
- [ ] Build, serve with `npm run preview`, and smoke-test loading, playing, changing presets, and exporting.
- [ ] Add a Decision log row summarizing the release state. Do not deploy or push; publishing is the user's step.

**Verify**

1. `npm run test:all` passes after a clean install.
2. `npm run budget` passes.
3. The preview smoke test succeeds.

- [ ] All verification steps pass.
