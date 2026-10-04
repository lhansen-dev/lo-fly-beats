Read .ralph/DONE: claims bounded handles and 12,000-cue test.
git diff main...HEAD -- . ':!.ralph': inspected Phase 31 change; no unrelated source changes apparent.
grep -q 'animations.push' src/scene/sceneCueDriver.ts: exit 1 (expected 1; passes)
grep -q 'let blinkAnimation' src/scene/sceneCueDriver.ts && grep -q 'let rubAnimation' src/scene/sceneCueDriver.ts: exit 0 (passes)
grep -q 'keeps only current animation handles across many cues' src/scene/sceneCueDriver.test.ts: exit 0 (passes)
grep -q 'const timerState: { pending: (() => void) | null } = { pending: null }' src/scene/sceneCueDriver.test.ts: exit 0 (passes)
grep -q 'keeps only current animation handles across many cues' src/scene/sceneCueDriver.test.ts && npx vitest run --project unit src/scene/sceneCueDriver.test.ts -t 'keeps only current animation handles across many cues': exit 0 (passes)
npx vitest run --project unit src/scene/sceneCueDriver.test.ts: exit 0 (passes)
grep -q 'keeps the rub cooldown across hide and show' src/scene/sceneCueDriver.test.ts && grep -q 'keeps the rub cooldown across disable and enable' src/scene/sceneCueDriver.test.ts && grep -q 'starts fresh cue state for a new session seed' src/scene/sceneCueDriver.test.ts: exit 0 (passes)
grep -q 'export function createCueSession' src/scene/sceneCueDriver.ts && grep -q '\.animate(' src/scene/sceneCueDriver.ts: exit 0 (passes)
npx vitest run --project unit src/scene/cues.test.ts tests/data/animation-isolation.test.ts src/scene/scene.test.ts src/scene/scene-frame.test.ts src/app/controller.test.ts: exit 0 (passes)
npx tsc -b: exit 0 (passes)
npx tsc -p tsconfig.test.json: exit 0 (passes)
npx oxlint: exit 0 (passes)
npm run check: exit 0 (passes)
npx playwright test --project=chromium: exit 1
Manual review of R5/R9/R12/R13, engine events, cue lifecycle, CSS, persistence, and browser specs: bounded three handles and timer cleanup are correct; no concrete source defect found.
Playwright failure detail: preview server listen EPERM: operation not permitted 127.0.0.1:4173 before any browser tests; browser runtime remains unverified.
git diff --check: exit 0
