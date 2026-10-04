VERDICT: revise

All whole-card acceptance commands passed, including guarded tests, both TypeScript checks, oxlint (0 errors), and regression suites. `npm run check` passed (236 unit tests, data validation, build). The retained cooldown/new-seed tests claimed in DONE also pass.

Fix the unbounded animation retention in `src/scene/sceneCueDriver.ts:58–83`. Every bob, blink, and rub is appended to `animations`, but no completed or canceled animation is removed. Even replaced/canceled bob objects remain strongly referenced throughout a listening session. An in-memory reproduction invoking the actual driver for 10,000 beat cues printed:

`10,000 bobs: cancellation calls before stop=9999; stop cancels 10000 historical Animation objects (expected bounded active handles).`

Replace the historical array with bounded current handles (one each for bob/blink/rub), cancel/release replaced handles, and make stop cancel only current handles. Alternatively, remove handles when they finish or are canceled. Add a regression to `src/scene/sceneCueDriver.test.ts` exercising many cues/timer cycles and proving cleanup does not revisit all historical animations; retain the existing cooldown and seed tests. This is a real memory leak in an application intended for prolonged playback, not a style preference.

Browser verification remains operator-required: `npx playwright test --project=chromium` exited 1 before tests with `Error: listen EPERM: operation not permitted 127.0.0.1:4173` and `Process from config.webServer was not able to start`. The authored browser acceptance checks pass; do not change source merely to work around this sandbox restriction. Run Chromium on a socket-enabled runner before human approval.

```findings
[
  { "severity": "critical", "file": "src/scene/sceneCueDriver.ts", "line": 58, "issue": "The driver retains every completed or canceled Animation object until stopped, causing unbounded memory growth during prolonged playback." },
  { "severity": "important", "file": "tests/browser/animation.spec.ts", "issue": "Chromium runtime verification is unverified because the sandbox refuses the preview server socket bind with listen EPERM." }
]
```
