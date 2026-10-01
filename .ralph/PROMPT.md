You are working on: closing out Phase 18 of `docs/03-IMPLEMENT.md` in the
lo-fly-beats repo — recording the Phase 17 listening-gate approval and applying
the listening review as a no-code-change ("Approved as is") review.

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

## Project notes (read these before editing)

- This card deliberately changes **no source code**. The only file you may edit
  is `docs/03-IMPLEMENT.md` (plus `.ralph/ITERATION_DONE` and `.ralph/DONE`).
  Never edit anything under `src/`, `tests/`, or any config file.
- `docs/03-IMPLEMENT.md` is a long checklist. Phase 17 (around line 1563) is a
  **human gate**: never tick, reword, or delete its seven `- [ ]` checkboxes or
  the `- *(The user writes notes here.)*` line — they belong to the user.
  Phase 18 (around line 1581) is the agent phase you are closing out.
- Many lines in that file are duplicated across phases (for example
  `- [ ] Add a Decision log row summarizing the changes.` and
  `- [ ] All verification steps pass.`). When your task supplies a multi-line
  anchor for an edit, use it exactly as given instead of a shorter one, and copy
  every literal string from the task byte-for-byte (quotes, backticks, dashes).
  Literal blocks in a task may be indented two spaces for readability — strip
  that indent when copying, so the text you search for matches the file.
- The **Decision log** is a 4-column markdown table near the top of the file
  that ends just before the `## Reference` heading (around line 100). New rows
  go at the END of the table. Never put a `|` character inside a cell's text.
- When your assigned task explicitly names commands to run (for example
  `npm run check`, `npm run test:audio`, or
  `npx playwright test --project=chromium`), those named commands ARE that
  task's check: run exactly them, and nothing broader.
- Report truthfully. Never tick a verification checkbox for a command that
  failed or that you did not run; if a command fails, record its exact error
  text where the task says to and say so in your summary.
