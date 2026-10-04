You are working on: Phase 28 of `docs/03-IMPLEMENT.md` — drawing the fly character (`src/scene/fly/Fly.tsx`, `src/scene/scene.css`, scene tests) in the lo-fly-beats SVG scene, with no animation yet.

Your task for this iteration is given in the `## Your assigned task` block at
the top of this prompt, together with a LAST_TASK=true|false flag. That block
is your ONLY task source — there is no task list to find or update; the
orchestrator tracks completion and makes all commits.

Do exactly that ONE task this iteration — nothing else:
1. Do the task. Verify it worked: run the check named in the task (if any)
   and confirm `git status` shows the files you edited. Never claim a task
   whose edits you did not make in THIS session — the orchestrator rejects
   completions that changed nothing.
2. Write a short summary (one or two lines) of what you did into
   `.ralph/ITERATION_DONE` — this signals the orchestrator to record
   completion and commit your work.
3. If LAST_TASK=false, STOP NOW. Do not start anything else — the next
   iteration will handle it.

Only if LAST_TASK=true: after your task-specific check passes and you write
`.ralph/ITERATION_DONE`, write a short bulleted TLDR into `.ralph/DONE` (a
one-line header summarizing the change, followed by a few `- ` bullets
covering what changed, why, and key files) and stop. Whole-card acceptance
testing is the evaluator's job, not yours. Never write `.ralph/DONE` if the
task-specific check failed or when LAST_TASK=false.

Rules: never run `git add`, `git commit`, `git checkout`, `git switch`,
`git push`, or any other git command that changes state. The orchestrator
commits for you, and the worktree must stay on the branch it was given.
Read-only commands like `git status` and `git diff` are fine. Never modify
`.ralph/PROMPT.md`; never touch files outside this working directory; only run
tests that cover your current task's files — NEVER run the full test suite.
Your assigned task is the ONLY task: never create or update any harness
todo list (e.g. the todowrite tool).
Batch independent reads/searches into a single turn instead of issuing
them sequentially.
Do not re-read a file after editing it unless a check fails or the edit tool
reports ambiguity.

Project hints:
- Scene markup must contain no color literals: every fill/stroke is `style={{ fill: 'var(--scene-…)' }}`; color values live only in `src/styles/tokens.css`. No `<text>` except the existing "HW" heading in `Desk.tsx`. Avoid SVG gradients/ids (an id like `#face…` would trip the no-hex tests).
- Tests under `src/**` are type-checked with `tsconfig.app.json` (no Node types): never import `node:fs` there — render with `renderToStaticMarkup(createElement(...))`. Tests that read files belong in `tests/unit/**` (Node types available; see `tests/unit/styles/app-css.test.ts`).
- `vitest.config.ts` has `passWithNoTests: true`, so a vitest run that matches no file "passes" — make sure your test file exists and its tests actually ran.
- Never run Playwright or `npm run test:browser` / `test:audio`: this sandbox denies local socket binds. Browser specs are checked with `npx tsc -b tsconfig.test.json` and `npx oxlint <file>`.
- Do not add any animation (`@keyframes`, `animation`, `<animate>`); that is Phase 31. Do not check any Phase 29 box or Phase 28's "All verification steps pass." box.
