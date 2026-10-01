# Phase 16 — live playback engine and temporary audition page

Replaces the Phase 7 "spike" with a real, looping playback engine: a pure `PlaybackSequencer`
(`src/audio/sequencer.ts`, with unit tests) that composes one phrase at a time and hands back
per-step events, and a singleton `PlaybackEngine` (`src/audio/engine.ts`) that drives it through
a single Tone.js `scheduleRepeat`, with start/pause/play/reset and status/position/step events.
`src/app/App.tsx` is rewritten as a temporary audition page (preset select, seed + random-seed
button, variation/tempo sliders, Start/Restart, play/pause, status, position, chord symbols, and
a trace readout), and a debug-only `DiagnosticsPanel` renders engine diagnostics behind
`?debug=1`. The old spike (`src/audio/spike.ts`) and its tests are deleted. New Playwright specs
cover engine start/pause/resume/voice-release (`tests/browser/engine.spec.ts`) and a 5-minute
stability soak gated on `SOAK=1` (`tests/browser/soak.spec.ts`); `playwright.config.ts` now binds
the preview server to the IPv4 loopback to avoid this sandbox's `::1` restriction. The Decision
log records three phase-16 entries (the sandbox's `EPERM` block on binding a local server, the
IPv4 config change, and the Start/Restart pause-before-reset fix), and the checklist leaves the
soak box and final-verification box unchecked — those two Playwright runs are the operator's
step, as the card requires.

All acceptance criteria pass (typecheck, lint, targeted and full unit test runs, build, file/
test-id/checklist/decision-log checks). One non-blocking issue is worth a follow-up: `App.tsx`
statically imports `DEFAULT_MIX` from `rig.ts`, which pulls Tone.js into the main page bundle
instead of loading it lazily on the first Start click as Phase 7 established — see
`.ralph/EVALUATION.md` for details.
