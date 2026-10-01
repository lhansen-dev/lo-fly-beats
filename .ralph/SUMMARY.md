# Phase 20 — Apply pending tempo/variation/preset/seed changes at musical boundaries

Adds `request`/`applyTempoNow` to `PlaybackSequencer` and the audio engine (with a new
`EngineLike` interface), a `SessionController` that applies tempo immediately while
paused but defers it to the next bar — and defers variation/preset/New-beat to the next
phrase — while playing, and a React `ControllerContext` wiring the existing audition
page in `App.tsx` to the controller with a new `pending-changes` indicator. Includes new
unit tests (`sequencer.test.ts`: 11 cases covering all five required boundary scenarios;
`controller.test.ts`: 8 cases covering idle/playing/paused control routing) and a
Playwright boundary spec (`tests/browser/boundaries.spec.ts`).

**Status: approved.** The prior revision's blocking issue (two leftover unused imports
failing `npm run typecheck`/`npm run build`) is fixed with a minimal two-line diff. Every
whole-card acceptance criterion — both build gates and the regression list — now passes
when run independently. `npx playwright test --project=chromium` still can't execute in
this sandbox (confirmed `EPERM` binding `127.0.0.1:4173`, the same limitation recorded for
Phases 16/18) and needs to run in CI or locally before full end-to-end proof. One real but
narrow edge case was found and documented for follow-up: selecting a preset and then
nudging tempo again while playing, both before the same phrase boundary, can leave the
pending-changes text showing a stale BPM value (the audio/tempo itself still ends up
correct); it doesn't affect any required test or criterion and is left for a later card.
