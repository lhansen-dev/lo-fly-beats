You are working on: Phase 16 of `docs/03-IMPLEMENT.md` — build the live playback
engine (`PlaybackSequencer` + singleton engine), replace the Phase 7 audio spike
with a temporary audition page and a `?debug=1` diagnostics panel, and add the
Chromium engine and soak browser specs.

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
- `docs/03-IMPLEMENT.md` is the specification. Read the exact section your task
  names (use `grep -n '^### R9' docs/03-IMPLEMENT.md` and friends to find it)
  before writing code, and inspect the existing files instead of assuming their
  contents. Do not edit `docs/01-IDEAS.md` or `docs/02-PLAN.md`.
- Code style: 2-space indent, single quotes, no semicolons, named exports.
  TypeScript has `strict`, `noUnusedLocals`, `noUnusedParameters` and
  `erasableSyntaxOnly` (so: no `enum`, no `namespace`, no constructor parameter
  properties — declare class fields explicitly).
- Only files in `src/audio/` may use `tone`; `src/music/` and `src/connectome/`
  never import `react` or `tone`. `Math.random` is banned everywhere in `src/`.
  Engine and rig code always uses the context it was given (`context.transport`,
  `context.draw`, `context.destination`), never `Tone.getTransport()`,
  `Tone.getDraw()`, `Tone.Frequency()` or `Tone.now()`.
- Importing `tone` at module scope creates a global AudioContext immediately, so
  React modules must never import it, directly or transitively.
- Useful commands: `npx tsc -b` (typecheck), `npm run build`,
  `npx vitest run --project unit <file>` (node tests),
  `npx playwright test <spec> --project=chromium` (browser tests; the config
  builds and serves the app automatically). Never run `npm run check`,
  `npm test` or the whole Playwright suite.
