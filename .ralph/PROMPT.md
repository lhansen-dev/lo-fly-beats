You are working on: finishing Phase 16 of `docs/03-IMPLEMENT.md` in this Vite +
React + TypeScript lo-fi music app — adding the missing 5-minute Playwright soak
spec, fixing the audition page's Start / Restart flow, pointing the Playwright
preview server at the IPv4 loopback, and recording Phase 16 in the
implementation checklist.

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

Environment hints for this repository:
- This sandbox DENIES binding a local HTTP server (`listen EPERM ...
  ::1:4173`). Never run `npx playwright test`, `npm run test:browser`, or
  `npm run test:audio` (Vitest browser mode): they need a server/browser that
  cannot start here and will fail for reasons unrelated to your change. The
  operator runs those. Writing and typechecking the specs is your job.
- Never run `npm run check` or `npm test` — they run the whole suite.
  `npm run typecheck` (`tsc -b`) is fast and typechecks `src/`, `tests/`, and
  the root config files; it is the right check when a task names it.
- Useful landmarks: the audition page is `src/app/App.tsx`, the engine and
  sequencer are `src/audio/engine.ts` and `src/audio/sequencer.ts`, the debug
  panel is `src/components/DiagnosticsPanel.tsx`, the existing end-to-end spec
  to copy style from is `tests/browser/engine.spec.ts`, and the implementation
  checklist with its Decision log table is `docs/03-IMPLEMENT.md` (Phase 16
  starts at `## Phase 16: Build the live engine and audition page`).
- `docs/03-IMPLEMENT.md` Phase 17 is a human gate: never tick its boxes, and do
  not edit any phase other than the one your task names.
- If a check fails because of something you did not touch, make the smallest
  fix that makes it pass and mention it in `.ralph/ITERATION_DONE`.