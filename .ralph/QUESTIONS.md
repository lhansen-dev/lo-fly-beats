# Needs attention: Phase 18 cannot be planned — the Phase 17 listening notes are empty

This card's entire scope is "implement every concrete request in the Phase 17
**Listening notes**". I read those notes. They do not exist yet.

`docs/03-IMPLEMENT.md` lines 1563–1579 (Phase 17: Human gate — listening review):

- All seven of Phase 17's checkboxes are still `- [ ]` (unchecked).
- The **Listening notes** section contains exactly one line:
  `- *(The user writes notes here.)*`
- I grepped the whole repository for "Approved as is", "Listening notes", and
  related phrases; the only hits are the Phase 17/18/29/30 instructions
  themselves. There is no separate notes file, no decision-log row for Phase 17,
  and no commit that recorded a listening review.

Nothing in this sandbox can substitute for the missing input: there is no audio
device, no browser for a human to listen in, and no operator to ask mid-run. I
also must not invent the notes — `docs/03-IMPLEMENT.md` "How to work through
this checklist" rule 8 and Phase 17's own line ("Agents: do not check these
boxes") forbid an agent from deciding a human gate's outcome. Any plan I wrote
today would either be empty or would fabricate an approval.

Please answer the questions below (or just fill in the notes and re-run the
card) and I will produce the plan.

## Blocking questions

1. **Can you complete Phase 17 and paste the result into the doc?** The card
   needs the literal verdict written under the `**Listening notes**` heading in
   `docs/03-IMPLEMENT.md` (replacing the `*(The user writes notes here.)*`
   line) — either the exact text `Approved as is.` or a list of concrete
   requests. Everything below only matters if the answer is "requests".

2. **If the verdict is "Approved as is", who checks the boxes?** Phase 18 says
   "change no code and check the remaining boxes", but Phase 17's boxes are
   human-gate boxes an agent may not touch. Confirm you want the loop to: check
   only Phase 18's six task boxes plus its "All verification steps pass" box,
   add a Decision log row recording the approval, and leave every Phase 17 box
   for you. Also confirm it is acceptable that, in that branch, the card's only
   diff is in `docs/03-IMPLEMENT.md` (no source change at all) — I want to agree
   on that before I write acceptance criteria that assert it.

3. **If there are requests, how precise are they?** A small local model cannot
   translate "the hats feel splashy" into numbers. For each request I need the
   target spelled out well enough to become a concrete edit, i.e. one of:
   - a sound parameter and its new value, from the R10 tables
     (`docs/03-IMPLEMENT.md` line 860 onward) — e.g. a buffer recipe/peak in
     `src/audio/buffers.ts`, a `SoundParams` field (`keysCutoffHz`,
     `bassCutoffHz`, `masterCutoffHz`, `reverbSend`, `saturationWet`,
     `rainLevel`, `crackleLevel`), or a `DEFAULT_MIX` layer level in
     `src/audio/rig.ts`;
   - a preset field from R8 (`docs/03-IMPLEMENT.md` line 640 onward) and its new
     value — the three presets in `src/presets/presets.ts` are
     `rainy-windowsill` (D minor, 72 BPM, swing 0.56), `overripe-2am`
     (C minor, 64 BPM, swing 0.6), and `fruit-bowl-finals` (A Dorian, 86 BPM,
     swing 0.55);
   - or a composition rule from R7 (`docs/03-IMPLEMENT.md` line 480 onward)
     stated as a rule change, since that path also forces a `MAPPING_VERSION`
     bump (currently `2` in `src/music/versions.ts`) and a rewrite of
     `tests/data/compose-snapshot.test.ts` plus its snapshot.
   Which preset does each request apply to — one of the three, or all of them?

4. **Did a seed sound best?** `DEFAULT_SESSION_SEED` in `src/music/versions.ts`
   is currently `1`. Give the exact integer if it should change, or say "keep 1".

5. **Do the synthesized voices meet the listening bar?** If any voice should
   become a locally hosted sample, the card says to stop and report — tell me
   now so the card goes back to you instead of into the loop.

6. **Should Phase 18 run at all while Phase 16 is unfinished?** `docs/03-IMPLEMENT.md`
   Phase 16 still has two unchecked boxes (the `tests/browser/soak.spec.ts` run
   and "All verification steps pass"), and the Decision log row at line 97 says
   Verify steps 3 and 4 were skipped because the sandbox refused the preview
   server bind (`listen EPERM ... ::1:4173`). `playwright.config.ts` has since
   been changed to `127.0.0.1:4173`. This card's Verify list includes
   `npx playwright test --project=chromium`, so I need to know: is the preview
   server now reachable inside the sandbox the loop and evaluator run in? If it
   is still blocked, that command cannot be an acceptance criterion and I need
   an agreed substitute (e.g. `npm run check` plus `npm run test:audio` only,
   with the Playwright run left to you).
