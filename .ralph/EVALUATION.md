VERDICT: revise

All 19 explicit acceptance commands pass, including sleeve outlines/shade tokens, matching geometry and paint order, class counts, token definitions, TypeScript, targeted lint, and production build. The scene implementation and browser coverage otherwise match Phase 28.

However, `npm run check` exits 1 with 210 tests passed and 1 failed. The focused command `npx vitest run --project unit src/scene/fly/fly.test.ts` also exits 1:

```text
FAIL src/scene/fly/fly.test.ts > Fly > draws every sleeve distinct from the torso with its own dark outline
AssertionError: expected undefined to be defined
src/scene/fly/fly.test.ts:23:22
```

Fix all over-escaped regular expressions in `src/scene/fly/fly.test.ts:22–35`, not just the first failing match: regex literals need `\b`, `\(`, `\)`, and `\d` rather than doubled backslashes; the template strings passed to `new RegExp` need `\\b` rather than four backslashes. Currently the torso match searches for a literal backslash, and sleeve, token, and numeric-width extraction are similarly broken. Retain the sleeve-separation assertions, verify they actually extract tokens and widths, and rerun the focused unit test and `npm run check`.

Unlike the documentation's earlier environment note, Node unit tests run in this sandbox. `npx playwright test --project=chromium` remains blocked before tests by `listen EPERM: operation not permitted 127.0.0.1:4173`; this is an operator verification item, not a code defect. Update the verification evidence when recording the corrected unit-test result; no documentation/source files were changed by this evaluator.

```findings
[
  {
    "severity": "critical",
    "file": "src/scene/fly/fly.test.ts",
    "line": 22,
    "issue": "Over-escaped regexes in the sleeve-separation regression test prevent matching rendered SVG and cause npm run check to fail."
  }
]
```
