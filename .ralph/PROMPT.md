You are working on: replacing the throwaway audition page with the real, permanent player
control UI (Phase 21 of `docs/03-IMPLEMENT.md`) — eight components in `src/components/`, a
rebuilt `src/app/App.tsx`, and `tests/browser/controls.spec.ts`.

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

Repository hints (Vite + React 19 + TypeScript, no extra dependencies needed):
- UI components live in `src/components/` as default-exported React function
  components in `.tsx` files. They read state with `useAppState(selector)` from
  `src/app/store.ts` and call methods on `useController()` from
  `src/app/ControllerContext.tsx` (`startListening`, `togglePlay`, `setTempo`,
  `setVariation`, `newBeat`, `selectPreset`). `src/app/state.ts` defines `AppState`
  and the action union; `src/components/DiagnosticsPanel.tsx` is an existing example.
- TypeScript is strict with `verbatimModuleSyntax` (use `import type` for types),
  `noUnusedLocals` (no unused imports) and `erasableSyntaxOnly` (no `enum`,
  `namespace`, or constructor parameter properties).
- Unit tests run in a **node** environment; the `unit` project includes
  `src/**/*.test.ts`. A `.ts` test file cannot contain JSX: build elements with
  `createElement` from `react` and render with `renderToStaticMarkup` from
  `react-dom/server` (if `react-dom/server` will not import, use `react-dom/server.node`).
  Existing fake-dependency patterns live in `src/app/controller.test.ts`.
- Run only the single check your task names. Never run `npm run check`, `npm test`,
  `npm run test:audio`, or `npx playwright test` — the Playwright/browser runs cannot
  bind local ports in this sandbox and will hang or fail.
- `docs/01-IDEAS.md` and `docs/02-PLAN.md` are read-only; `docs/03-IMPLEMENT.md` is
  edited only when a task says so.
