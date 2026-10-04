You are working on: finishing Phase 28 of `docs/03-IMPLEMENT.md` — drawing the full SVG fly character (head, eye shine, headphones, transform origins, browser spec) in this React/Vite app.

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
- This sandbox denies every local socket bind. NEVER run `npx vitest`, `npm test`, `npm run check`, `npx playwright`, or `npm run test:browser` — they fail with `listen EPERM` and the operator has chosen to skip them. Verify only with the check command written in your task (`npx tsc -b`, `npx oxlint …`, `npm run build`, grep).
- Scene source files must contain no colour literals (no `#hex`, no `rgb(`/`rgba(`); colours come from `--scene-*` custom properties in `src/styles/tokens.css`, applied with `style={{ fill: 'var(--…)' }}` or `style={{ stroke: 'var(--…)' }}`.
- Use JSX attribute names (`className`, `strokeWidth`, `strokeLinecap`) in `.tsx` files.

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