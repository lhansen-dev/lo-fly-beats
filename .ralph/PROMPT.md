You are working on: Phase 28 of `docs/03-IMPLEMENT.md` — drawing the SVG fruit-fly character (`src/scene/fly/Fly.tsx`) with every R13 fly class group, its transform origins in `src/scene/scene.css`, and the fly browser tests.

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

Task-specific hints:
- Scene art is inline SVG in a `viewBox="0 0 1600 900"`. Look at `src/scene/layers/Desk.tsx` and `src/scene/layers/desk.test.ts` for the drawing and test style before writing new code.
- Scene markup must contain NO color literals (no `#abc`/`#aabbcc`, no `rgb(`/`rgba(`) and no `<text>` — colors come only from `var(--scene-...)` tokens defined in `src/styles/tokens.css`, applied via `style={{ fill: 'var(--scene-...)' }}` / `stroke`.
- Never put a `transform` attribute on an element whose class starts with `fly` (later CSS animation would override it); use an unclassed inner `<g transform=...>` wrapper instead.
- Do not add any animation, `@keyframes`, or transitions — that is Phase 31.
- Playwright and vitest browser mode cannot run in this sandbox (local socket binds fail with `listen EPERM`). Never run `npx playwright test` or `npm run test:audio`; use the check named in your task.
- Unit tests run with `npx vitest run --project unit <file>`.

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
