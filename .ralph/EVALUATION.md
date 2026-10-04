VERDICT: revise

All 22 acceptance commands passed with their expected exit codes, including TypeScript, targeted Oxlint, both builds, bundled CSS, class/token checks, and the Phase 28 checklist/log checks. Vitest and Playwright remain operator steps, as instructed.

One card requirement is not actually implemented: R13 says **all six sleeves are visible**, but the folded back sleeves are invisible against the torso. In `src/scene/fly/Fly.tsx`, line 13 fills the torso with `var(--scene-fly-hoodie)`; lines 22–23 stroke both folded sleeves with exactly that same opaque colour, entirely inside the torso, with no outline or other separation. Only their dark hand circles are visible.

Evidence: `nl -ba src/scene/fly/Fly.tsx` shows the identical fill/stroke tokens. An in-memory Python Bézier containment check produced:
```
back-left: all sampled centerline points inside torso=True; minimum boundary distance=39.87 > stroke radius 12
back-right: all sampled centerline points inside torso=True; minimum boundary distance=21.82 > stroke radius 12
```
There is no failing shell acceptance command; this is a rendering omission those presence/count checks cannot catch.

Change the sleeve rendering so all six arms, especially both folded back arms, are distinguishable from the torso and one another. For example, use the existing hoodie-shade token or tokenized outlines/seams on the overlapping sleeves while retaining six `data-sleeve` paths and the R13 class groups. Add a focused regression assertion for their visual separation, then rerun the static/build checks; leave runtime verification for the operator as agreed. This is about making required sleeves visible, not choosing an art style.

```findings
[
  { "severity": "critical", "file": "src/scene/fly/Fly.tsx", "line": 22, "issue": "Both folded back sleeves paint entirely inside the identical-colour torso without separation, so the required six visible sleeves are not rendered." }
]
```
