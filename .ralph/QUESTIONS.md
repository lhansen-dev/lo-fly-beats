# Phase 30 is blocked: the Phase 29 scene review hasn't been done

This card depends on the Phase 29 human gate, and that review hasn't happened yet in this worktree. In `docs/03-IMPLEMENT.md`:

- All four Phase 29 checkboxes (lines 1831–1834) are still unchecked (`- [ ]`).
- The **Scene notes** section (lines 1836–1838) still holds only the template text `- *(The user writes notes here.)*`. It has no concrete requests and no "Approved as is."

Phase 30's only input is the operator's judgment of the art. It can't be inferred or built offline, so I can't write a plan that matches what you want.

Questions:

1. Please do Phase 29 yourself. Run `npx playwright test tests/browser/scene.spec.ts tests/browser/layout.spec.ts --project=chromium` and then `npx playwright show-report`, or run `npm run build && npm run preview`. Check the scene at desktop width and at phone width. Then replace the placeholder under **Scene notes** in `docs/03-IMPLEMENT.md` with either:
   - concrete, specific requests, naming the layer or fly part and the change you want (for example: "banana: add more brown spots", "Late Night Cram lamp glow too weak"), or
   - the exact text "Approved as is."

   Commit that edit to the branch and re-queue this card.
2. Should Phase 30 check the Phase 29 boxes, or will you check them yourself? (The doc says agents must not check them.)
