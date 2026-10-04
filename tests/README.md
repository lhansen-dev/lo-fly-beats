# Acceptance coverage

Run `npm run test:all` for unit/data checks, Chromium Web Audio tests, and the desktop browser projects. Install their binaries with `npx playwright install chromium firefox webkit` first. The production preview starts automatically for browser tests. Accessibility, lifecycle, and startup acceptance specs target Chromium; other interaction specs run in all three projects. Automated WebKit results supplement real Safari testing.

The acceptance areas below correspond to [the plan's validation table](../docs/02-PLAN.md#7-validation-and-acceptance). Manual release validation remains in [phase 38](../docs/03-IMPLEMENT.md#phase-38-human-gate--release-validation); passing automation does not complete listening or real-device checks.

| Area | Automated evidence | Phase 38 manual checks |
| --- | --- | --- |
| Data integrity | `tests/data/real-circuit.test.ts`, `tests/unit/connectome/`, and `npm run data:verify` against upstream records | Confirm the circuit, attribution, and filtering in the MVP checklist |
| Graph contribution | `tests/unit/music/traversal.test.ts`, `tests/data/traversal-real.test.ts`, `tests/data/compose-real.test.ts`, `tests/browser/explanation.spec.ts` | Inspect the explanation and confirm the real circuit materially selects motifs |
| Repeatability | `tests/data/compose-snapshot.test.ts`, `tests/data/animation-isolation.test.ts`, `src/music/streams.test.ts`, `tests/audio/export.test.ts` | Audition the presets and seeds; inspect exported files |
| Musical constraints | `tests/unit/music/compose.test.ts`, `tests/data/compose-real.test.ts`, `src/audio/timing.test.ts`, `tests/audio/rig.test.ts`, `tests/audio/mix.test.ts` | Listen at variation and tempo limits for compatible harmony, groove, clicks, and clipping |
| Audio lifecycle | `tests/browser/engine.spec.ts`, `tests/browser/lifecycle.spec.ts`, `tests/browser/boundaries.spec.ts`, `src/app/controller.test.ts`, `src/audio/engine*.test.ts` | Foreground/background playback, switching apps, locking the screen, and recovery on actual devices |
| Export | `src/audio/wav.test.ts`, `src/audio/export.test.ts`, `tests/audio/export.test.ts`, `tests/browser/export.spec.ts`, `tests/browser/lifecycle.spec.ts` | Five exports per desktop browser played in QuickTime/VLC; decide mobile download support |
| Failure recovery | `tests/browser/failures.spec.ts`, `tests/unit/connectome/load.test.ts`, `src/app/persistence.test.ts`, `src/app/controller.test.ts`, `src/audio/engine.interruption.test.ts` | Actual browser/OS interruptions and mobile app switching |
| Accessibility | `tests/browser/a11y.spec.ts`, `tests/browser/animation.spec.ts`, `tests/browser/layout.spec.ts`, `tests/browser/scene.spec.ts`, `tests/unit/styles/tokens.test.ts` | Keyboard-only use, VoiceOver, reduced motion, animation toggle, and real mobile controls |
| Listening quality | `tests/audio/mix.test.ts` bounds numerical peaks; composition tests bound notes and density. Musical quality requires human listening. | Three presets × three seeds, two minutes each, low/high variation and 60/100 BPM |
| Sustained use | `tests/browser/soak.spec.ts` checks status, schedules, scores, voices, and retained URLs through playback and five exports; logs heap measurements | 15 minutes foreground and 5 minutes background in each desktop browser with diagnostics |

The soak is opt-in to keep routine checks fast:

```sh
SOAK=1 npm run test:browser -- tests/browser/soak.spec.ts --project=chromium
SOAK=1 SOAK_MINUTES=15 npx playwright test tests/browser/soak.spec.ts --project=chromium
```

`SOAK_MINUTES` defaults to 5 and must be positive. Heap values are informational because garbage collection and browser support vary; resource counts are asserted. `npm run build && npm run budget` checks gzip size budgets. Startup and subdirectory deployment checks live in `tests/browser/startup.spec.ts` and `tests/browser/subpath.spec.ts`.
