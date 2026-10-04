VERDICT: approve

All listed acceptance commands pass, including the reset regressions and `npm run check` (248 unit tests). Reviewed the full diff against R6/R7/R12/R14: the panel, descriptions, bar sampling, metadata, and browser assertion are implemented; reset clearing works both while open and on resubscription.

Chromium verification remains blocked: `npx playwright test --project=chromium` exits 1 before tests with `Error: listen EPERM: operation not permitted 127.0.0.1:4173`. This is the existing sandbox socket restriction, not a change failure. The human reviewer should run Chromium on an unrestricted runner; Phase 31/32 verification boxes remain unchecked. Updated documentation with the verified results and reset behavior.

```findings
[
  { "severity": "important", "file": "tests/browser/explanation.spec.ts", "issue": "Chromium behavior, including the eight-second real-connection assertion, remains unverified because the sandbox denies the preview server socket bind (listen EPERM on 127.0.0.1:4173)." }
]
```
