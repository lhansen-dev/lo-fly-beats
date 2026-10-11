# Lo-fly beats: learning prototype in five sessions

Created October 5, 2026. Implements the first milestone in [04-LEARNING-RADIO.md](./04-LEARNING-RADIO.md). Sessions 1–4 are implemented with their automated finish checks verified; session 5 remains planned. Human listening review remains pending. The integrated session 4 path now verifies browser playback and captured-score export.

## The result we are building

A browser experiment where the same local fly can learn a two-bar bass motif, play recognizable variations over the existing accompaniment, and retain its learned parameters after a reload. Each session should leave something demonstrable and a short handoff for the next session.

The five sessions cover the audible learning experiment. The shared station, continuous listener feedback, internal synaptic plasticity, MIDI ingestion, and a full-CNS activity simulation follow once this experiment has useful listening results. Local persistence means one fly per browser profile at this stage; it does not yet mean one fly shared by all listeners.

### Decisions that keep this implementable

| Decision | Starting choice | Why |
| --- | --- | --- |
| Musical output | Learn bass-cell choices only. Reuse the existing chord, keys, drum, timing, instrument, and WAV machinery. | Isolates an audible change without introducing a second music engine. |
| Neural model | A small, fixed, discrete-time reservoir built from the existing `mbon-v1` graph: 97 neurons and 936 connections. | This verified graph already has a 92-neuron recurrent core. See the [extraction report](../scripts/data/reports/mbon-v1-extraction.md). |
| Relationship to the current graph | The existing whole-CNS traversal continues to produce the accompaniment. The experimental MBON reservoir produces bass decisions, with separate provenance. | Makes the experimental subset explicit while keeping the current listening baseline available. |
| What learns | A categorical decoder from reservoir activity to the existing bass vocabulary. Internal reservoir connections remain fixed during these sessions. | Provides a measurable first learning task with a small parameter count. |
| Teaching material | One original motif and a few authored variations, expressed using existing bass-cell IDs. | Avoids external MIDI acquisition, parsing, and corpus preparation before the basic experiment works. |
| Execution | Pure TypeScript model and evaluation functions; one dedicated browser worker for training and model inference. | Uses the current stack and keeps training out of audio scheduling. |
| Persistence | A separate, versioned IndexedDB checkpoint store, with current and previous snapshots. | Allows asynchronous, transactional saves and recovery without mixing model state into UI settings. |

Training a readout while holding a recurrent network fixed follows the reservoir approach described in [Jaeger's echo-state report](https://www.ai.rug.nl/minds/uploads/EchoStatesTechRep.pdf). The particular graph, dynamics, musical inputs, classifier, and sampling rules below are our engineering choices. The MBON subset is a computational prototype, not the complete biological learning circuit discussed in the product proposal.

## Contracts to settle in session 1

Keep the model independent of React, Tone, storage, and the DOM. It should be usable directly by unit tests, an evaluation script, and a worker.

```text
whole-CNS graph + recipe
    -> existing phrase plan: chords, traversal, keys, drums, rest mask
    -> musical context -> persistent MBON reservoir -> learned bass choices
    -> shared score renderer -> immutable PhraseScore -> playback / WAV

teaching examples -> decoder training -> versioned learned parameters
phrase boundary -> commit prepared model state -> checkpoint
```

Introduce these concepts in `src/music/learning/types.ts`:

- `LearningParameters`: graph checksum, model seed/configuration, input and vocabulary versions, decoder weights, training-update count, and model revision.
- `LearningRuntime`: reservoir activations, previous executed bass action, and a monotonic generation index. This is separate from the recipe's phrase index, which New beat currently resets.
- `LearningSnapshot`: parameters, runtime, recent bounded motif summaries, and compatibility metadata.
- `BassDecision`: beat, chosen cell ID, selection probability, legal-action mask, and whether the traversal forced a rest.
- `PreparedLearningPhrase`: phrase/request identity, parent model revision, immutable score, starting snapshot, and ending runtime. Preparing a phrase must not mutate the live fly. Adoption commits its score and starting snapshot for restart; its ending runtime supplies the speculative parent for preparing the following phrase.

Keep the legacy `composePhrase(graph, recipe, phraseIndex)` entry point and its deterministic outputs. Refactor its internals into `buildPhrasePlan(...)` and `renderPhrasePlan(plan, bassOverrides?)`. An absent override must produce the existing score, including the current random-draw order. Learned bass still uses the current pitch resolution, note shortening, sorting, and humanization.

Add optional learning provenance to the score. It names the reservoir graph checksum, learner version, model revision, and bass decisions. The existing `score.trace` continues to describe the accompaniment traversal; remove its obsolete bass-choice descriptions when an override supplies bass, and show those decisions separately. A simultaneous activity model cannot truthfully be represented as one traversal edge per beat.

Use a separate learner version and RNG namespace. Preserve mapping version 2 for the legacy generator. Learning randomness must depend on the model seed, generation index, and action purpose, independently of animation and jokes.

### Runtime behavior

| Action | Learning behavior |
| --- | --- |
| Pause, resume, audio interruption, WAV export | Preserve parameters and runtime. Rendering a captured score never runs training or advances the model. |
| Tempo or mixer change | Preserve the model; retain the current control timing. |
| Variation change | Apply next phrase; controls constrained sampling in learning mode. At zero, use greedy decisions. The legacy mode keeps its existing exact-repeat behavior. |
| New beat or preset change | Reset transient reservoir/context at the applicable boundary and preserve learned parameters and fly identity. Invalidate prepared results from the previous recipe. |
| Teach motif | Train a candidate copy. Publish its parameters at a phrase boundary; the current score remains immutable. |
| Reload | Restore the last committed boundary snapshot and start paused. Regenerate the next whole phrase from that snapshot. An interrupted partial phrase may replay from its beginning; mid-phrase recovery is outside this milestone. |

## Session 1 — separate phrase planning from musical memory

**Demo:** the legacy player still works, and a stateful test generator carries its previous bass choice across two phrases.

**Read:** `src/music/{compose,patterns,harmony,streams,types}.ts`, `src/audio/sequencer.ts`, `src/app/controller.ts`, and the existing composition tests.

**Work**

- [x] Extract phrase planning and rendering without changing baseline scores. Expose the existing bass-cell rendering helper rather than duplicating pitch and duration rules.
- [x] Create the learning types and a pure session API: `preparePhrase(plan, snapshot)` returns a prepared result; `commitPhrase(result)` accepts only the expected parent/request revision.
- [x] Implement musical context and a bounded recent-action history. Start with a deterministic selector that proves state passes between phrases; do not call it learned behavior.
- [x] Define legal bass actions: the four strong cells on beats 0/2, the five weak cells on beats 1/3, and forced silence at existing traversal rests. Forced rests advance context but are excluded from teaching loss and motif accuracy.
- [x] Add a development-only experiment switch, initially outside the default listening flow. Settle the score provenance and control/reset rules above.

**Files:** refactor `src/music/compose.ts`; add `src/music/learning/{types,context,session}.ts`; extend `src/music/types.ts`; add focused tests under `tests/unit/music/learning/`.

**Finish checks**

- Existing baseline snapshot passes unchanged, including zero-variation behavior.
- Preparing twice from the same snapshot yields equal scores and ending states and leaves the input snapshot unchanged.
- Two consecutive stateful phrases retain context; preparing the second from a fresh state demonstrably differs on a hand-checkable fixture.
- Existing bass register, strong-beat roots, monophony, density, and duration constraints hold with overrides, including forced rests.

Run `npm run check` and the focused composition/learning unit tests. No live-worker or persistence integration yet.

## Session 2 — make the connectome produce persistent activity

**Demo:** the small graph produces repeatable, bounded activity across phrase boundaries, and an untrained decoder turns that activity into audible bass choices on a developer audition page.

**Work**

- [x] Load and verify `mbon-v1` using the existing schema/checksum code. Introduce an explicit loader path; the current app loader selects `whole-cns-v1`. Pin stable numeric-ID ordering for model arrays.
- [x] Build sparse incoming model rows from the retained anatomical edges. Store original synapse counts separately from modeled weights.
- [x] Start with `rawWeight = log1p(synapseCount)` and normalize each incoming row to a total of `0.85`. A row without inputs remains zero. These effective weights are positive by design; transmitter signs and physiological strengths are not known from this export.
- [x] Update once per musical beat: `xNext = 0.75*x + 0.25*tanh(W*x + Win*u)`. Use separate old/new arrays so neuron iteration order cannot change the result.
- [x] Encode `u` as beat position (4), bar parity within the two-bar motif (2), chord-ring index (6), previous executed bass cell (9), and traversal-rest status (1). Initialize the previous-action vector to zeros. Generate input weights in `[-0.2,0.2]` deterministically from model seed `1`; this seed belongs to the fly, independently of the recipe seed.
- [x] Add a nine-action decoder with logits `Wout*[1,x]`, stable masked softmax, and seeded selection. Initialize output weights to zero; use fixed vocabulary ordering to resolve greedy ties. Keep the input mapping and internal weights fixed.
- [x] Define exploratory selection as a mixture of decoder probabilities and a uniform distribution over legal actions, initially at most 20% exploration at full variation. This is an authored variation mechanism, not evidence of learning.

**Files:** add `src/music/learning/{graph,reservoir,decoder,versions}.ts`, a small experimental circuit loader, and reservoir/decoder tests. Reuse the existing developer UI or add `src/components/learning/LearningLab.tsx` behind the experiment switch.

**Finish checks**

- Every internal model connection corresponds to a source edge; graph data is unchanged.
- A tiny directed fixture verifies propagation direction and weighted sums by hand.
- Run at least 10,000 simulated phrases: activations remain finite and in `[-1,1]`, weights remain unchanged, and retained histories stay bounded.
- Continued runtime differs from resetting at each phrase. Replaying identical inputs from identical snapshots reproduces decisions.
- Record activation range, saturation rate, activity differences after altered inputs, and inference time. Do not accept a numerically bounded but effectively constant reservoir as useful.
- A manually assembled learning score plays and exports through the existing audio paths.

Run `npm run check`; add one focused real-audio rendering check for an overridden score. These numeric starting values may be tuned from measured activity, with changes recorded in the handoff.

## Session 3 — teach one motif and measure retention

**Demo:** train the decoder, disable further updates, then hear the taught bass motif recur over new chord contexts with controlled variations.

**Work**

- [x] Add a versioned, original two-bar teaching example, using these initial choices:

  ```text
  bar A: root-hold,  and-root, root-push,   fifth
  bar B: root-short, rest,     root-octave, approach
  ```

  Include a few sparse variants with legal cell substitutions. Store action sequences and provenance in `src/music/learning/curriculum.ts`, with held-out context fixtures under `tests/fixtures/learning/`; the examples are curriculum data, not inference rules.
- [x] Implement supervised cross-entropy updates for output weights only. Start with learning rate `0.03`, L2 coefficient `0.0001`, gradient norm capped at `1`, and a maximum of 20,000 updates per Teach operation. Keep these values in versioned configuration.
- [x] Train on a copied model in bounded chunks. Start by feeding previous teacher actions, then include rollouts with the model's own previous choices and corrective labels. Keep training runtime separate from the listening runtime.
- [x] Accept finite candidate weights and return measured results. Reject failed/non-finite candidates without replacing the live parameters. Evaluation uses fresh runtime and held-out seeds/context sequences.
- [x] Add `scripts/learning/evaluate.ts` and a documented `npm run learning:eval` command. Use one lightweight TS script runner if needed; include script files in typechecking. Write reproducible score JSON and a metric report to ignored `artifacts/learning/`, plus a concise checked-in result report.
- [x] Compare the existing generator, untrained reservoir decoder, trained decoder with updates frozen, and a trained decoder using only the same context features. Also train controls with connectome weights set to zero (retaining the same leak) and with source indices permuted while target indices/input weights stay fixed. Preserve incoming row counts and weights in the permuted control; a relabeling of both sources and targets would not test a changed topology. Retrain each control under the same update budget.

**Files:** add `src/music/learning/{curriculum,train,evaluate}.ts`, context fixtures, training tests, `scripts/learning/evaluate.ts`, and `docs/learning/experiment-01.md`. Update `package.json` only for the evaluation command and any justified development dependency.

**Finish checks**

- Training changes output weights and reduces held-out error; anatomical counts and internal weights remain unchanged.
- With updates frozen and variation zero, mean target-cell accuracy reaches an initial target of 80% over 20 held-out recipe seeds and all three presets, excluding forced rests. Report each preset as well as the mean.
- At full variation, ten consecutive phrases contain at least two distinct two-bar action sequences while averaging at least 60% target-cell accuracy. All hard musical constraints still pass.
- The inference API receives only plan/context and learned state. It cannot consult the teaching sequence or a target motif identifier.
- Report action accuracy, interval/onset motif similarity, rest fraction, distinct cell count, repetition rate, and constraint violations. Human listening remains necessary to judge useful variations.
- A context-only or altered-connectivity model may perform equally well. Record that result honestly; successful motif teaching does not establish a benefit from fly wiring.

Run `npm run check` and `npm run learning:eval`. If the targets fail, use this session to fix the model/curriculum and record the failed run; do not advance on training loss alone or silently lower the thresholds.

## Session 4 — integrate prepared playback and saved checkpoints

**Demo:** teach while listening, adopt the result on a phrase boundary, reload, and recover the learned behavior with playback paused.

**Work**

- [x] Add one dedicated worker owning model inference/training, with typed `initialize`, `prepare`, `teach`, and `restore` messages. Every response carries a request ID, recipe generation, and parent model revision. Use the bundler-supported worker URL form and terminate the worker on disposal. [Web Workers documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
- [x] Prepare the initial learning phrase before transport starts, and keep current plus next scores ready. Build accompaniment plans outside `PlaybackEngine.onStep`; send only small harmonic/rest/context inputs to the worker. Do not clone the full CNS graph into the worker.
- [x] Extend the sequencer with a prepared-score provider for learning mode. The audio callback only takes a ready score, commits its already-computed snapshot, and schedules events. It never awaits work, trains, or writes storage.
- [x] Give next-phrase preparation priority over training chunks, with at most one pending preparation and one pending teaching operation. Accept a candidate only when a replacement next phrase is ready; otherwise defer adoption to the following boundary. Drop stale replies after preset/New beat/reset or model revision changes.
- [x] If a result misses its boundary, repeat the current immutable score for one phrase, freeze model progress, and record the fallback. Retry from the committed snapshot with a new request generation; discard forecasts for the missed timeline. A worker failure returns to a usable listening state with a clear status.
- [x] Add strict snapshot validation and asynchronous IndexedDB saves. Store current and previous committed snapshots in one transaction. Check model/config, input/vocabulary versions, both graph checksums, array dimensions, and finite numeric bounds before restore. [IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).
- [x] Save at phrase boundaries and after accepted teaching. A boundary save contains the starting runtime for the phrase about to play, its active recipe and phrase identity, and the adopted parameters. Reload replays from that boundary; speculative ending states and unadopted training results must not become checkpoints. When teaching while paused with an active score, defer adoption until the next phrase; the initial paused screen can adopt before its first phrase is prepared.
- [x] On invalid/incompatible current state, try the previous compatible checkpoint. If neither works, initialize a fresh model with an explicit status. Storage failure leaves the in-memory listening session usable.

**Files:** add `src/music/learning/worker.ts`, `src/app/{learningClient,learningPersistence}.ts`; update `src/audio/{sequencer,engine}.ts`, `src/app/{controller,state}.ts`, and `src/main.tsx`. Add lifecycle, race, and restore tests.

**Finish checks**

- Save/restore at a boundary yields the same next score and following runtime as an uninterrupted run in the same JS environment. Cross-browser comparisons use numeric tolerances and musical metrics where needed.
- Repeated preparation, cancelled teaching, stale messages, pause/resume, export, and hidden-scene updates cannot create duplicate training updates or state commits.
- Worker-delay tests exercise the repeat fallback and verify that late results cannot advance the model out of order.
- New beat and preset changes follow the rules above both while playing and while paused.
- Malformed, incompatible, quota-failed, and unavailable storage paths leave the player usable.
- Diagnostics show at most two ready scores, one worker, bounded histories, and one repeat scheduler event.

Run `npm run check`, `npm run test:audio`, and targeted browser specs for boundaries, lifecycle, export, and learning restore. Measure preparation time; initially target p95 below 100 ms on the documented reference laptop, excluding initial graph loading and training. Treat any timing adjustment as a recorded decision, not an assumed guarantee.

## Session 5 — make the experiment understandable and judge it

**Demo:** choose Learning experiment, teach the original motif, listen to its variations, then return after a reload to the same learned fly.

**Work**

- [ ] Add a compact experimental panel with mode selection, Teach motif, a teaching/ready status, and saved/unsaved status. Expose variation through the existing control. Provide a deliberate Forget learning action that also deletes both checkpoint generations; ordinary New beat preserves learned parameters.
- [ ] Show recorded facts: accepted update count, adopted model revision, retained motif similarity, and last checkpoint time. Label metrics as measurements; do not invent experience messages or claim learning occurred while paused.
- [ ] Update the explanation and credits to distinguish whole-CNS traversal, modeled MBON activity, authored constraints, and trained bass choices. Keep the existing traversal scanner labeled for accompaniment. Put a small activity summary in the experimental panel instead of presenting traversal highlights as neural firing.
- [ ] Extend the evaluation harness with paired condition bundles. Render three representative held-out seeds per preset for the legacy, untrained, and trained-frozen conditions using the same tempo, mix, accompaniment seed, and starting context. Use the existing browser offline renderer for WAVs; randomize listening labels and record their mapping separately.
- [ ] Write a listening comparison in `docs/learning/experiment-01.md`: whether the motif is recognizable, variations remain pleasant, and the trained version is preferable or at least useful beside the current generator. Keep unperformed listening checks explicitly pending.
- [ ] Run the saved-state comparison after a fresh browser load and a 15-minute learning-mode soak. Update README, test coverage, experiment limitations, and this checklist with actual results.

**Files:** add `src/components/learning/LearningPanel.tsx` and `tests/browser/learning.spec.ts`; update `src/app/App.tsx`, explanation/credit components, diagnostics, evaluation tooling, README, and `tests/README.md`.

**Finish checks**

- Teaching and Forget learning work by keyboard, status changes are accessible, and the scene remains usable with motion disabled.
- Export renders the captured learning score without regenerating or updating the fly.
- Paired recordings and the frozen-learning/checkpoint metrics are available for review; listening conclusions name the actual reviewer and evidence.
- The soak has bounded scores, worker requests, history, and audio resources. Record fallback count and preparation/training timings.
- `npm run test:all`, `npm run learning:eval`, and `npm run build && npm run budget` pass. Run the opt-in soak once; fix failures that affect the experimental path.

The implementation can be complete while the listening comparison remains pending. Claim the audible-learning milestone achieved only when retention, useful variation, restart recovery, and actual listening evidence are all recorded.

## Session handoffs

At the end of each session, update its boxes and add a short entry below with completed files, verification commands/results, measured model behavior, deviations, and the next concrete task. Check only work actually verified. Keep listening observations separate from automated metrics. Later sessions should read this plan and the latest handoff before editing; they should not need chat history.

| Session | Status | Evidence / decisions | Next task |
| --- | --- | --- | --- |
| 1 | Complete | Baseline snapshot unchanged; pure preparation/adoption, retained context, and override constraints verified. See handoff below. | Load and verify MBON graph; replace the test selector with fixed reservoir activity and a decoder. |
| 2 | Complete | Verified MBON loader, fixed sparse activity, masked decoder, 10,000-phrase measurements, and captured-score audio/WAV audition. See handoff below. | Teach the original motif and measure frozen retention against the planned controls. |
| 3 | Complete (automated checks) | Decoder-only teaching, frozen retention/variation targets, and all controls verified. Failed runs and sampling calibration recorded in [experiment 01](./learning/experiment-01.md). Human listening pending; integrated browser audition verified in session 4. | Integrate worker preparation and boundary checkpoints. |
| 4 | Complete (automated checks) | Dedicated worker, prepared boundary adoption, transactional checkpoints, exact replay, and failure/race recovery verified. Headless animation timing adjustment recorded below. | Finish experimental mode/Forget UI, paired listening review, and learning soak. |
| 5 | Planned | — | Finish the experimental UI and paired listening review. |

### Session 1 handoff — October 5, 2026

Completed `src/music/compose.ts` planning/rendering extraction and shared `renderBassCell`; added `src/music/learning/{types,context,session}.ts`, typed bass vocabulary, optional score provenance, `src/components/learning/LearningLab.tsx`, and focused learning/override tests. Mapping version remains 2. Without overrides, the existing serialized baseline snapshot and zero-variation exact repeats are unchanged.

The session API is pure: `preparePhrase(plan, snapshot)` copies its inputs and freezes the prepared result. `commitPhrase(result, expectedParent, expectedRequestId)` returns an adopted score and starting boundary snapshot, plus a separately named `nextSnapshot` for speculative preparation. It returns `null` for unexpected requests, duplicate/out-of-order adoption, changed parent state/model revision, or an invalidated recipe generation. Explicit expected-parent/request arguments keep the adoption gate independent of a mutable controller. The starting snapshot, rather than `nextSnapshot`, is the future checkpoint/restart state.

The current selector is an authored, deterministic test scaffold. It ranks legal cells from the previous executed action, chord-ring index, and two-bar parity; variation mixes that choice with up to 20% uniform exploration using the separate `learning|learnerVersion|modelSeed|generationIndex|purpose` RNG namespace. Zero variation is greedy. No decoder weights are trained, no reservoir graph is loaded, reservoir activations/weights are empty, the reservoir checksum is explicitly `null`, and the update count stays zero. Version constants temporarily live in `context.ts`; session 2 can move them into its planned `versions.ts` module.

Musical context already encodes the 22 session-2 input features. Forced rests execute the silent action, advance context, and receive an all-false legal mask and false motif eligibility. Runtime retains at most 8 recent actions; the snapshot retains at most 8 two-bar motif summaries. Over 25 test phrases, these histories stayed bounded. On a hand-checkable fixture with one voiced beat followed by 31 forced rests, a fresh phrase starts with `root-hold`; the following phrase retains the final silent action and starts with `root-push`. This establishes state transfer, not learning or listening quality.

Use `npm run dev`, then open `/?learning=1` for the manual Prepare/Adopt panel. Repeated Prepare does not advance memory; Adopt retains the starting state and makes the ending state available for the next preparation. The panel uses the current listening recipe, reports bass decisions separately from the accompaniment traversal, and is omitted from production builds. New beat/preset changes reset transient context on the next manual preparation, preserve parameters/model seed and the monotonic generation index, and invalidate previously prepared results. Variation changes replace the next preparation; tempo leaves decisions/state unchanged. The legacy player retains its existing control, pause/resume, interruption, and captured-score export behavior. Playback boundaries, Teach, reload persistence, and live worker integration remain assigned to later sessions.

Verification: `npm run check` passed (64 unit/data files, 317 tests; data validation and production build passed), and `npx vitest run --project unit tests/unit/music/learning tests/unit/music/compose.test.ts tests/data/compose-snapshot.test.ts` passed (4 files, 23 tests). The override suite exercises all nine cells over all three presets and variations 0/0.5/1, checking the existing register, harmony, strong-beat root, monophony, duration, density, sorting, and forced-rest invariants. A Chromium development smoke check verified the panel is hidden by default, repeated Prepare produces identical decisions, and two successive adoptions advance the generation counter without page errors. Existing lint/build warnings remain. No listening judgment is claimed.

Next: explicitly load/checksum the MBON graph, pin numeric neuron ordering, build sparse fixed model rows, and replace the test selector with measured reservoir activity plus the masked decoder. Preserve the pure preparation/adoption and starting-versus-ending snapshot contracts.

### Session 2 handoff — October 5, 2026

Completed `src/music/learning/{graph,reservoir,decoder,versions,random,load}.ts`; replaced the test selector in `session.ts`; updated types, context, and the developer `LearningLab`; added graph, reservoir, decoder, and activity tests and a focused real-audio override/export test. The explicit learning loader reuses the existing manifest/schema, SHA-256, byte-count, and graph-integrity checks, loads `mbon-v1` under the deployment base, and rejects another circuit identity. The default application loader still selects `whole-cns-v1`. Circuit files and anatomical counts are unchanged.

The immutable model uses 97 numerically ordered IDs, 936 incoming edges, and 25,379 original synapses. Each edge retains its synapse count separately from its positive effective weight. Nonempty incoming rows sum to 0.85 after `log1p` scaling; empty rows contribute zero. Activity updates synchronously once per beat, including forced rests, with retention 0.75 and tanh contribution 0.25. Model seed 1 produces 2,134 fixed input weights for the existing 22 features. The action-major decoder has 882 zero-initialized weights, including one bias per action. The original numeric choices required no tuning.

The fixed model is supplied explicitly to `createLearningSnapshot(accompanimentChecksum, model)` and `preparePhrase(plan, snapshot, model)`. This keeps graph/input weights shared and outside the copied, future-checkpoint snapshot, and keeps inference pure without a module-global graph. Preparation checks the graph checksum, fly seed, configuration, versions, and decoder dimensions/finite values. The starting-versus-ending snapshot and adoption gate are unchanged. Transient resets zero the 97 activations and previous-action vector but retain parameters, model seed, histories, and the monotonic generation index. Learner and snapshot versions advance to 2; input/vocabulary versions remain 1 and legacy mapping remains 2.

At positive variation, selection samples `(1 - 0.2*variation)*maskedSoftmax + 0.2*variation*legalUniform`; zero variation is greedy with stable vocabulary ties and selection probability 1. Because the untrained decoder has zero logits, every positive variation currently samples legal actions uniformly. Different carried activity therefore does not yet imply different greedy bass decisions. A hand-set readout test demonstrates that nonzero output weights can distinguish activity; teaching remains session 3. Forced rests execute silence and advance activity/context without becoming teaching/accuracy observations.

Measured on an Apple M1 Max with Node v22.22.3, using the real MBON model and 60 branching-accompaniment plans (20 seeds × three presets, variation 1): 10,000 sequential preparations/adoptions covered 320,000 beats. Every beat update checked finite, bounded input activity; all ending activations remained in `[-1,1]`. Across 970,000 sampled boundary activations, the range was **[-0.420685, 0.479360]** and saturation at `abs(x) >= 0.95` was **0%**. Mean RMS change between phrase boundaries was **0.118623**. Changing one feature group from the same state produced RMS activity differences of **0.038354** (beat), **0.035544** (bar parity), **0.039135** (chord), **0.035843** (previous action), and **0.027564** (rest). These checks reject an effectively constant reservoir; they do not establish an anatomical advantage or learning. Internal/input/readout weights stayed unchanged; recent actions and motif summaries each remained at most 8.

In the same informational local run, mean preparation time was **2.397 ms**, p95 **2.831 ms**, and mean beat inference time **0.0558 ms**; the 10,000-phrase test took **25.03 s**. Preparation includes rendering/copying/freezing the score but excludes accompaniment planning and loading. The inference microbenchmark includes context encoding, reservoir update, and decoding; these Node timings are not browser-worker guarantees. Reproduce metrics with `npx vitest run --project unit tests/unit/music/learning/activity.test.ts --reporter=verbose --disableConsoleIntercept`.

Use `npm run dev`, then `/?learning=1`: Prepare does not advance memory; Adopt makes the ending runtime the next parent. Render audition WAV captures the selected score and current tempo/mix through the existing offline rig, then exposes native audio controls and a WAV download. Playback/rendering never runs inference or adopts memory. The panel shows measured activity and separate bass provenance, handles a failed learning load with Retry, and disposes replaced audition URLs. This is a manual developer audition; live sequencing, worker ownership, teaching, and saved checkpoints remain later sessions. No listening-quality judgment is claimed.

Verification: `npm run check` passed (68 unit/data files, 332 tests; data validation and production build passed), and `npm run test:audio -- tests/audio/export.test.ts` passed (7 real Chromium Web Audio tests). The new audio check isolates bass, verifies audible finite stereo 44.1 kHz output and the PCM WAV header, and proves rendering preserves model/snapshot/score. Existing baseline snapshots and bass-override constraint tests pass unchanged. The developer browser smoke verifies the panel, repeatable preparation, native audio playback/download, adoption/reset behavior, URL disposal, and corrupt-circuit retry. Existing lint/build warnings remain.

Next: add the original curriculum and bounded decoder-only training, then evaluate frozen retention and variation against the legacy, context-only, zero-connectivity, and source-permuted controls. Preserve fixed internal/input weights, explicit model identity, pure preparation, and boundary snapshot semantics.

### Session 3 handoff — October 5, 2026

Completed `src/music/learning/{curriculum,train,evaluate}.ts`, deterministic context partitions under `tests/fixtures/learning/`, focused training/metric tests, `scripts/learning/evaluate.ts`, and [experiment 01](./learning/experiment-01.md). Added Teach/Cancel to the development-only manual `LearningLab`. `npm run learning:eval` uses the pinned lightweight `tsx` runner via `node --import`; scripts participate in typechecking. Generated score bundles and the detailed metric report live in ignored `artifacts/learning/` and are written through temporary files. The default listening flow and legacy mapping version 2 remain unchanged.

Teaching copies only decoder weights and uses separate runtime. A chunk performs at most 128 updates, also bounding visited beats. Each operation permits at most 20,000 eligible updates: 4,000 teacher-forced, followed by 16,000 self-fed exploratory updates with corrective labels. Learning rate 0.03, L2 0.0001, and gradient cap 1 remain the planned values. Training alternates retained four-phrase sequences with fresh starts. Forced rests advance context without a label/update. Finite candidates return fresh validation measurements; cancelled, failed/non-finite, or stale candidates cannot replace live parameters. Acceptance returns parameters with one new model revision and the actual added update count, preserving listening runtime. Production worker/boundary adoption remains session 4; the developer lab uses an explicit manual boundary and invalidates previously prepared results when accepting teaching.

The first real-graph run reached 100% greedy accuracy but failed full-variation retention at 58.53%. Reweighting the original curriculum example from 16 to 32 relative to one per sparse variant still failed at 59.21%. Curriculum version 2 and decoder configuration version 2 now use that weighting and sampling temperature 0.8, retaining the 20% exploration ceiling. All controls were retrained, and thresholds stayed at 80% greedy / 60% full variation. The failed reports are preserved locally and their results are recorded in the checked-in experiment report. Reservoir configuration, anatomical counts, input/internal weights, model seed, and learning RNG namespace remain unchanged; snapshots now include and validate decoder configuration. No target sequence or motif identifier enters normal inference.

With updates frozen over 20 disjoint recipe seeds × three presets, trained MBON mean target-cell accuracy is **99.66%** at zero variation and **65.32%** over ten consecutive full-variation phrases per seed/preset. Each preset has those same action metrics because ring-index/rest inputs match across presets; rendered pitches/chords differ and are checked. Final held-out raw cross-entropy falls from **1.496793 to 0.178014**; at least **35 distinct two-bar sequences** occur in every trained ten-phrase trial after neutralizing forced-rest positions for diversity. All six conditions have zero hard constraint violations. The report includes onset/interval similarity, rest fraction, distinct cells, repetition, per-preset accuracy, and graph/weight identities.

The controls show no anatomical advantage: context-only reaches **100% / 83.97%** greedy/full-variation accuracy, zero connectivity **99.66% / 65.74%**, and source-permuted connectivity **99.49% / 64.83%**. The permutation changes sources only and preserves target rows, incoming counts, weights, synapse counts, and input weights. Hash checks and unit tests verify fixed model arrays stay unchanged. On Apple M1 Max / Node v22.22.3, a reference full evaluation takes about 17.1 s; MBON training takes about 1.36 s. These informational timings are not browser-worker guarantees.

Verification: `npm run check` passed (70 unit/data files, 344 tests; typechecking, circuit validation, baseline snapshots, and build passed), and `npm run learning:eval` passed with reproducible musical results. Hand-calculated evaluator tests also verify the reported metrics. Existing lint/build warnings remain. The current restricted environment denied starting the local Vite server (`listen EPERM`), so browser audition smoke and human listening are explicitly pending. Live worker playback, persistence, and the audible-learning milestone are not claimed.

Next: move bounded inference/training into the dedicated worker, prioritize prepared scores, adopt trained candidates only at real playback boundaries, and persist compatible starting-boundary snapshots with recovery. Preserve isolated training runtime, frozen score export, stale-candidate rejection, decoder compatibility, and honest control comparisons.

### Session 4 handoff — October 5, 2026

Completed `src/music/learning/{worker,workerProtocol,workerRuntime,snapshot}.ts`, `src/app/{learningClient,learningPersistence}.ts`, sequencer/engine/controller/state/startup integration, and lifecycle/race/restore tests. The development-only `/?learning=1` lab now teaches through the worker and plays through the ordinary transport and captured-score WAV export. The default listening flow remains the legacy generator; pure preparation and its baseline snapshots are unchanged. Added a dedicated development browser configuration and `npm run test:learning:browser`, plus pinned development-only `fake-indexeddb` for transaction/rollback tests.

One bundler-created module worker loads/verifies the MBON circuit and owns fixed-model inference and copied decoder training. Typed initialize/restore/prepare/teach/cancel messages and all replies carry request ID, recipe generation, and parent model revision. Training yields after at most 128 updates, so received preparations/cancellations run before further chunks; canceled timers cannot act on another training operation. Only compact recipe, chord-ring, beat/rest inputs and bounded learned snapshots cross the worker boundary. The full CNS graph, accompaniment events, and legacy bass choices stay on the main thread. Inference does not receive teaching labels or motif IDs. Learner/snapshot versions remain 2 because the learned dynamics and snapshot contract are unchanged.

The client prepares/render-validates results outside audio scheduling. The sequencer consumes ready immutable scores and precomputed boundary snapshots synchronously; plan building, worker requests, status publication, and storage run in deferred tasks. Initial playback and Play after paused resets wait for a prepared score. Only one preparation and one teaching operation can be pending; retained score count stays at most two. Completed training becomes live only with a ready replacement at a real phrase boundary. Paused active scores preserve their parameters/runtime until that boundary; the initial screen can accept and save teaching before playback. Cancelled/stale candidates never change live update counts. New beat/preset changes preserve accepted parameters and monotonic generation while resetting transient activity, including when later variation requests supersede their forecasts.

A missed boundary repeats the exact current score, keeps its starting snapshot committed, and changes request generation. Late forecasts for the missed timeline are discarded; the retry starts from the frozen committed snapshot. A completed teaching candidate can be deferred to the following boundary. Worker failure retains the current playable score with an explicit error; startup/reset preparation failure can use the baseline transport. Worker termination, request timers, and storage connection disposal are explicit.

The separate `lofly-learning-v1` IndexedDB database keeps current and previous records in one read/write transaction. Strict validation checks checkpoint/recipe/preset identity, both verified graph checksums, complete model/decoder configuration, input/vocabulary/mapping/learner versions, seed, dimensions, finite numeric bounds, counters, and bounded histories. Invalid current state falls back to a compatible previous checkpoint; two invalid records produce an explicit fresh-fly status. Rotation does not overwrite a recovery copy with an invalid current record. Saves contain the adopted phrase's **starting** runtime, active recipe, phrase index, and parameters; speculative ending runtime and unadopted training are excluded. Storage failures preserve in-memory learning/playback. Same-environment restore reproduces both the saved score and the following runtime exactly.

On Apple M1 Max / Node v22.22.3 with Playwright Chromium headless (SwiftShader), 34 accepted preparations including 32 paused variation changes measured **149.1 ms p95** with animation enabled; the preceding run measured 150.2 ms. A representative final sample spent 0.4 ms planning, 1.2 ms in worker inference, 0.5 ms rendering/adoption validation, and 140.1 ms in worker round-trip time. With scene animation disabled, 32 further preparations measured **6.1 ms p95** end to end. The final full-suite run reproduced **152.9 ms animated / 11.3 ms motion-disabled p95**, passing both recorded ceilings. Initial graph loading and training were excluded. This supports main-thread/software-renderer delay as the cause of the animated result, rather than slow reservoir computation; it is not a hardware-GPU guarantee. Recorded timing adjustment: keep the original **100 ms** target for motion-disabled preparation and use a **200 ms** regression ceiling for this animated headless configuration. Both conditions remain measured; do not describe the animated run as meeting 100 ms. Diagnostics retain only the most recent 64 timing samples, total sample count, worker inference/training times, fallback count, score/request counts, and bounded history counts. The deliberate 22-second delay test records one frozen fallback; ordinary teaching/reload/export records none.

Verification: `npm run check` passed (73 unit/data files, 389 tests, circuit validation and production build), `npm run test:audio` passed (15 real Chromium Web Audio tests), and all five development learning specs passed. `npm run budget` also passed. Targeted production Chromium boundaries/export/idle/export-resume checks passed (4/5); the existing rapid-preset test exceeded its two-second UI timing limit (2.926 s in the combined run, 5.620 s in isolation). The unchanged phase-3 commit `dbcbbed`, tested in a temporary worktree with the same browser/dependencies, also failed that limit at 2.797 s. This pre-existing headless animation timing failure is recorded rather than weakening its assertion; learning scheduling/resource checks pass independently. Typechecking includes the development browser configuration. Tests verify coalesced/repeated preparations, response identity, cancellation before/after replacement preparation, stale recipe replies, missed candidate deferral, exact restore, paused/playing resets, unavailable/quota-failed storage, real IndexedDB corruption recovery, transaction abort, one worker, at most two scores, and one audio repeat event. Existing lint/build warnings and headless rendering/polyphony warnings remain; no human listening judgment is claimed.

Next: session 5 adds deliberate production mode selection and Forget learning, recorded saved/unsaved facts, accurate accompaniment/activity explanations, paired listening bundles/review, and the 15-minute learning soak. Recheck preparation latency with a hardware renderer and keep the headless timing distinction visible.

### Overnight handoff — October 11, 2026: the fly composes

This went beyond the planned session 5. A new composer in `src/brain/` replaces the MBON bass experiment as the default listening mode. The MBON lab remains available at `/?learning=1` in development, and the classic walk at `/?composer=walk`.

- **Circuit and model:** a 1,771-neuron ear-to-song circuit (`song-v1`) with transmitter signs. Rate dynamics run per sixteenth note, and every layer's decisions are read from 887 song-side neurons through phase-tuned readout pools.
- **Training:** an original tutor (school), then per-bar policy gradient against an authored critic (practice). A section head chooses groove, breakdown, or intro for each phrase.
- **In the app:** a worker runs the fly one phrase ahead, learns gently from played phrases, takes listener bananas, and saves per browser.
- **Results:** shipped-fly measurements, controls, the three-seed wiring comparison, and caveats are in [experiment 02](./learning/experiment-02-fly-brain.md). Demo tapes are in `docs/demos/`.
- **Not done:** human listening, production deployment review, and Firefox/WebKit runs of the new browser specs. In this Linux sandbox the existing Chromium suite fails 25 of 52 tests on the unchanged baseline as well, so those failures are environmental. The new `tests/browser/brain.spec.ts` passes in Chromium.
- **Next:** listen and compare against the walk; rerun the wiring comparison with more seeds and a statistical test; consider reward-modulated plasticity inside the circuit (the original stage 2).

## What follows the five sessions

Use the results to choose the next small milestone. If motif retention fails, improve the musical representation or decoder. If useful learning works but altered connectivity performs equally well, retain that finding and design a stronger temporal task before claiming anatomical benefit.

Once the audible experiment is convincing, plan a separate shared-station delivery: first a server process that owns generation and portable checkpoints with learning frozen; then synchronized listener playback and restart recovery; then a bounded feedback experiment. Measure score delivery versus streamed audio before choosing transport/hosting. Internal plasticity needs a separately selected circuit and explicit reward/physiological assumptions. A banana reaction belongs with that feedback work, after the model has a measured musical foundation.
