You are working on: Phase 33 of Lo-fly beats — credits section, R14 copy, status jokes, ASSETS.md, and the credits browser test.

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
- Read the files named in your task before editing them; earlier iterations may already have changed them (e.g. `src/app/App.tsx`).
- Component unit tests live under `src/` as `*.test.ts` (no JSX in tests): render with `renderToStaticMarkup(createElement(Component))` from `react-dom/server`, and create the store with `createAppStore(createInitialState(null))` (`src/app/store.ts`, `src/app/state.ts`). `src/components/controls.test.ts` shows the `ControllerProvider` + `SessionController` setup needed to render `App`.
- The vitest config has `passWithNoTests: true`, so make sure your test file actually exists and its tests are reported as run.
- `npx playwright test` without `--list` cannot run here (the sandbox denies local socket binds); never try to run browser tests beyond `--list`.
- Copy strings exactly as written in the task, including the Unicode ellipsis `…`.

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
