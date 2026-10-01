# Phase 20 — Apply pending tempo/variation/preset/seed changes at musical boundaries

Adds `request`/`applyTempoNow` to `PlaybackSequencer` and the audio engine (with a new
`EngineLike` interface), a `SessionController` that applies tempo immediately while
paused but defers tempo to the next bar and variation/preset/New-beat to the next
phrase while playing, and a React `ControllerContext` wiring the existing audition
page in `App.tsx` to the controller with a `pending-changes` indicator. Includes new
unit tests (`sequencer.test.ts`, `controller.test.ts`) and a Playwright boundary spec.

**Status: sent back for revision.** The feature work and all 16 whole-card acceptance
criteria (greps + targeted unit tests) pass, but `npm run typecheck` / `npm run build`
/ `npm run check` all fail with exit 2 because of two leftover unused imports (`vi` in
`src/app/controller.test.ts`, `PendingChange` in `src/app/controller.ts`). That's a
two-line fix, but it means the card's own stated Verify step ("`npm run check` ...
pass") does not currently pass, so it can't go to the human reviewer yet.
