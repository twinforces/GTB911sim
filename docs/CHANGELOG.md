# Changelog

Long-term history. What / Why / How. Git hashes filled in after commits.

## 2026-09-04 — Working sim snapshot (pre-MVVM)

- **What:** First public commit of Collapse Lab: PFP header, teaching path, neighbor-heat fire, drop-only unlock, house burn-down, apartment as a building, towers with sequential floor climb.
- **Why:** Lunch-run request was two pushes — this one is the sim as it actually ran, before the file split, so a hostile reader can see we did not “fix the physics while we reorganized.”
- **How:** `git init` → `twinforces/GTB911sim`. Physics still in `src/lib/sim/` on this commit.

## 2026-09-04 — Credit line and public repo

- **What:** Header PFP, “An @GrumpyTechBro joint” → https://x.com/GrumpyTechBro. Repo `twinforces/GTB911sim`.
- **Why:** This is a named argument, not an anonymous toy.
- **How:** `public/grumpy-tech-bro.jpg`, header in the lab view, `gh repo create`.

## 2026-09-04 — Teaching path, neighbor heat, house fire, apartment massing

- **What:** Bonfire → houses → apartment → towers. Neighbor-heat fire. Christmas-tree ignition. Apartment is a brick building. Houses burn down in the footprint. Towers climb one storey at a time.
- **Why:** The truther claim is a scale error plus a hinge. Small-scale runs are the same three laws.
- **How:** Piece world (logs, timber, columns) + tower floor world. Fire Speed scales heat only.

## Failures we are not repeating

- Unlocking logs / joists with a lateral kick looked like demolition. Drop-only.
- Whole-wall ignition looked like a cheat. Neighbor heat.
- Translucent apartment walls read as a bare frame. Opaque brick facades.
- Giant flame sprites punched the house roof. Cap indoor fire.
- Early settle while the roof was still on: “still a house.” Settle after the roof is down.
