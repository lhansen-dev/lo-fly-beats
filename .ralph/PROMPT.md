You are working on: adding the shared app state store (`src/app/store.ts`,
`src/app/state.ts`) and debounced `localStorage` settings persistence
(`src/app/persistence.ts`) with unit tests — Phase 19 of `docs/03-IMPLEMENT.md`.

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

Repository hints (this project):
- Vite + React 19 + TypeScript + zod 4 + vitest 5. Everything you need is
  already installed — never run `npm install` or add a dependency.
- Unit tests live beside their module as `src/**/*.test.ts` and run with
  `npx vitest run --project unit <path>` in the Node environment (no DOM, no
  browser): never render React in a unit test.
- Never run `npm run check`, `npm test`, `npm run test:audio`, or Playwright —
  they run the whole suite or need a browser. Run only the single command your
  task names.
- House style, enforced by `tsc -b` and oxlint: 2-space indent, single quotes,
  no semicolons, `import type` for type-only imports (`verbatimModuleSyntax`),
  no `enum`/`namespace` (`erasableSyntaxOnly`), no unused imports or
  parameters (`noUnusedLocals`, `noUnusedParameters`).
- The spec for this work is `docs/03-IMPLEMENT.md`, section
  `### R12. App state, controls, and failure behavior` and `## Phase 19`, but
  your task text already restates everything you must implement — read the
  existing `src/` files it names rather than guessing their contents.
