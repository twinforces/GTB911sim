# Changelog

Long-term history. What / Why / How. Git hashes filled in after commits.

## 2026-09-04 — Publish: 9/11 Collapse Lab

- **What:** Title is 9/11 Collapse Lab. Logs are four sections + three heat-tracking joins. Collisions are inelastic. House fire is tree, then couch, then timber. Apartment is a room fire: next room through the wall, then up; unprotected steel fails ~575 °C; that bay pancakes; the rest of the building stays a building. Four panes labeled Front / Everything (orbits) / Action / Top. Event log in the end dialog. Story, not Storey.
- **Why:** A corner fire is not a hinge and not a global collapse. Gravity wins because nothing invents a sideways kick. The teaching path has to look like fire, not a video.
- **How:** Compartment gas for the apartment. Drop-only unlock. Bay mechanism when two columns in a bay lose yield. SAT Y-prefer, restitution 0. Brand cards at `public/og.jpg`.

## 2026-09-04 — MVVM split, tests, hostile documentation

- **What:** Physics moved to `src/model/`. Commands and labels to `src/viewmodel/LabViewModel.ts`. Chrome and WebGL to `src/view/`. Tests on M and VM. Comments say both What and Why because non-coders will read this looking for a cheat.
- **Why:** Tiny files per accusation. View never constructs the engine.
- **How:** git mv + LabViewModel. `npm test` includes `src/model/*.test.ts` and `src/viewmodel/*.test.ts`. Critic map in `src/model/README.md`.

## 2026-09-04 — Working sim snapshot (pre-MVVM)

- **What:** First public commit of Collapse Lab: PFP header, teaching path, neighbor-heat fire, drop-only unlock, house burn-down, apartment as a building, towers with sequential floor climb.
- **Why:** Lunch-run request was two pushes — this one is the sim as it actually ran, before the file split, so a hostile reader can see we did not “fix the physics while we reorganized.”
- **How:** `git init` → `twinforces/GTB911sim`. Physics still in `src/lib/sim/` on this commit. Hash `53e0027`.

## 2026-09-04 — Credit line and public repo

- **What:** Header PFP, “An @GrumpyTechBro joint” → https://x.com/GrumpyTechBro. Repo `twinforces/GTB911sim`.
- **Why:** This is a named argument, not an anonymous toy.
- **How:** `public/grumpy-tech-bro.jpg`, header in the lab view, `gh repo create`.

## 2026-09-04 — Teaching path, neighbor heat, house fire, apartment massing

- **What:** Bonfire → houses → apartment → towers. Neighbor-heat fire. Christmas-tree ignition. Apartment is a brick building. Houses burn down in the footprint. Towers climb one story at a time.
- **Why:** The truther claim is a scale error plus a hinge. Small-scale runs are the same three laws.
- **How:** Piece world (logs, timber, columns) + tower floor world. Fire Speed scales heat only.

## Failures we are not repeating

- Unlocking logs / joists with a lateral kick looked like demolition. Drop-only.
- Whole-wall ignition looked like a cheat. Neighbor heat.
- Translucent apartment walls read as a bare frame. Opaque brick facades.
- Giant flame sprites punched the house roof. Cap indoor fire.
- Early settle while the roof was still on: “still a house.” Settle after the roof is down.
- Mixing physics with React so a critic had to hunt. MVVM.
