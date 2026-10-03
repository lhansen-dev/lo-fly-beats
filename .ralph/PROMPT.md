You are working on: fixing the unstable `useAppState` selector in the Phase 21 player controls
(`src/components/PresetPicker.tsx`) and guarding it with a snapshot-stability unit test.

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

Repo hints for this card:
- This is a Vite + React 19 + TypeScript app. Unit tests run with
  `npx vitest run --project unit <file>` (node environment). Never run
  `npm run check`, `npm test`, `npm run test:audio` or Playwright: the first two
  run the whole suite and the last two cannot work here (this sandbox denies
  local socket binds, and no browser is available).
- Add no dependencies. `npm install` is not needed for any task here.
- Files under `src/**` are typechecked by `tsconfig.app.json`: `strict`,
  `verbatimModuleSyntax` (type-only imports must use `import type`),
  `noUnusedLocals` (no unused imports), `erasableSyntaxOnly`, and no node types
  (do not import `node:fs` and friends in a `src` test).
- `.ts` test files cannot contain JSX. Build elements with `createElement`, the
  same way the existing `src/components/controls.test.ts` does.
- If a task gives you exact file content or an exact line to write, use it
  verbatim rather than paraphrasing it.
</content>