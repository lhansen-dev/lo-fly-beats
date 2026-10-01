VERDICT: approve

## What I verified

This is a re-review after a prior `revise` (commit `d894fc2`). That round's blocker was that the
only Phase-18 Decision log row never mentioned `MAPPING_VERSION`. This attempt fixed exactly
that, plus added the "outside the sandbox" wording the prior note asked for. I re-ran every
command from the acceptance criteria myself, from the repository root, against the current
worktree (`HEAD` = `84911ec`):

- Criterion 1 (`MAPPING_VERSION` in a Phase-18 Decision log row): **exit 0.** The new row "No
  code changed in Phase 18: `MAPPING_VERSION` stays at 2 and `DEFAULT_SESSION_SEED` stays at 1
  …" satisfies this.
- Criterion 2 (`DEFAULT_SESSION_SEED` in a Phase-18 row): **exit 0** — same row.
- Criterion 3 (≥2 Phase-18 Decision log rows): **exit 0**, count is now 3 (was 1 before this
  round).
- Criterion 4 (final verification box ticked OR Decision log says "outside the sandbox"):
  **exit 0** via the new row "… both steps still need to be run outside the sandbox by the
  operator or CI before it can be ticked."
- Regression: `MAPPING_VERSION = 2`, `DEFAULT_SESSION_SEED = 1` unchanged — **exit 0**.
- Regression: all three presets' `tempoBpm`/`swing` unchanged — **exit 0**.
- Regression: Phase 17's seven checkboxes still unchecked (count = 7) — **exit 0**.
- Regression: Phase 17 Listening-notes placeholder intact — **exit 0**.
- Regression: Phase 17 Gate status line present and quotes the approval — **exit 0**.
- Regression: Phase 18's six task checkboxes all ticked (count = 6) — **exit 0**.
- Regression: `git diff --name-only main...HEAD -- . ':!.ralph'` is exactly
  `docs/03-IMPLEMENT.md` — **exit 0**. Confirmed via `git diff --stat` too: 1 file, 12
  insertions, 6 deletions, doc-only.
- `npx vitest run --project unit tests/data/compose-snapshot.test.ts`: **1/1 passed.**
- `npm run typecheck`: **exit 0** (`tsc -b`, clean).
- `npm run lint`: **exit 0** (oxlint, 0 warnings/errors).
- `npm run check` (full): **passes** — 80/80 unit+data tests, `data:validate`, and `build` all
  succeed.
- I also independently re-ran the two sandbox-blocked Verify commands myself (not just trusting
  the Decision log): `npm run test:audio` → `listen EPERM: operation not permitted ::1:63315`;
  `npx playwright test --project=chromium` → webServer `listen EPERM: operation not permitted
  127.0.0.1:4173`. A raw `node -e "net.createServer().listen(0,'127.0.0.1',...)"` also throws
  `EPERM`, confirming this sandbox denies every local socket bind, independent of this change,
  matching the already-documented Phase 16 precedent. The Decision log's new row accurately
  describes this and correctly says it needs to be re-verified outside the sandbox — it does not
  falsely claim success.

One regression bullet does **not** pass as written: "The Decision log table is still well
formed — every row has exactly four cells" (`awk … NF != 6 { exit 1 }`) exits 1. I tracked this
down: it is the pre-existing Phase 14 row ("`buffer|${name}|${sampleRate}`" inside the Reason
cell contains two literal, unescaped `|` characters), introduced in commit `669d713` on
2026-09-30 — long before Phase 17/18 existed. I proved this is not caused by this card's diff by
running the identical check against the untouched `main` branch directly
(`git show main:docs/03-IMPLEMENT.md | awk … | awk -F'|' …`), which **also exits 1**. None of the
four new rows this card added contain any embedded pipes, and the diff never touches line 31
(Phase 14's row). Per the acceptance note "Items 1–4 must fail on the untouched worktree and
pass once the work is done" — only items 1–4 were designed to flip state; this particular
regression bullet was already broken on the untouched worktree, so it isn't a regression this
card introduced, and fixing an unrelated Phase-14 decision-log cell is outside this card's scope
("Out of scope: anything not requested in the notes"). I'm flagging it as a finding (severity
`important`) for a future documentation-hygiene pass rather than blocking this card on it; see
`.ralph/EVALUATION-NOTES.md` for the exact commands and proof.

## Judgment on the card's substance

The Phase 17 gate closed with a blanket verbal approval ("lgtm, do your best to continue without
my feedback") and no concrete requests, so per the card's own branching rule this is the
"Approved as is" path: no code changes, just checklist/Decision-log bookkeeping. That's exactly
what happened — `src/music/versions.ts`, `src/presets/presets.ts`, and every other source/test/
config file are byte-identical to `main`. The six Phase 18 task boxes are ticked, a Decision log
row documents the no-code rationale naming both `MAPPING_VERSION` and `DEFAULT_SESSION_SEED`,
and the two sandbox-blocked Verify commands were honestly re-attempted and reported rather than
falsely checked off. No sample-based voices were requested, so that checklist item correctly
required no stop-and-report. Nothing was found unrelated to the card's scope.

## For the human reviewer

- The one open item is purely a pre-existing cosmetic Markdown table-parsing issue in the
  Phase 14 Decision log row (unescaped `|` inside a code span), unrelated to this card. Worth a
  one-line fix in a future pass (e.g. replace `` `buffer|${name}|${sampleRate}` `` with
  `` `buffer\|${name}\|${sampleRate}` `` or rewrite without the raw template string), but it
  predates this change and isn't part of this card's scope.
- Phase 18's final "All verification steps pass." box is intentionally left unchecked because
  `npm run test:audio` and `npx playwright test --project=chromium` cannot run in this sandbox
  (every local socket bind returns `EPERM`). This needs a real run outside the sandbox (operator
  machine or CI) to close out Phase 18 fully; the Decision log says so explicitly.

```findings
[
  { "severity": "important", "file": "docs/03-IMPLEMENT.md", "line": 94, "issue": "Pre-existing Phase 14 Decision log row contains unescaped '|' characters inside a code span (`buffer|${name}|${sampleRate}`), giving that row 8 pipe-delimited fields instead of 6; this makes the 'Decision log table is still well formed' regression check fail, but it predates this card (reproduced identically on main) and is out of this card's scope to fix." },
  { "severity": "suggestion", "file": "docs/03-IMPLEMENT.md", "issue": "Phase 18's final verification box can only be closed by running `npm run test:audio` and `npx playwright test --project=chromium` outside this sandbox (operator/CI); the Decision log already records this correctly." }
]
```
