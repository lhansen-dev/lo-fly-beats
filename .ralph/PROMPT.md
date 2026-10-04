You are working on: Phase 25 of docs/03-IMPLEMENT.md for Lo-fly beats — circuit-load error UI with Retry, audio-interruption handling in the engine, a debug Simulate interruption button, the storage-unavailable note, and a Chromium failures spec.

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

Task-specific hints:
- Unit tests run in Node with `npx vitest run --project unit <files>`. The vitest config sets `passWithNoTests: true`, so make sure the run actually reports your tests.
- This sandbox denies local socket binds: Playwright (`npx playwright test`) and `npm run test:audio` fail with `listen EPERM`. Do not try to make them run; author browser specs and verify them with `npm run typecheck`.
- `npm run typecheck` (`tsc -b`) typechecks `src/` (including `*.test.ts`) and `tests/`. Do not use `tsc -p` on the tsconfig files.
- Static component tests use `renderToStaticMarkup`, which escapes `'` as `&#x27;` — assert on substrings without apostrophes.
- Keep the code style of neighbouring files (no semicolons, single quotes, 2-space indent).
