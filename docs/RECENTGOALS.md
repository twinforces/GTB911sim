# Recent goals

Scratchpad. Older entries migrate to `docs/CHANGELOG.md`.

## 2026-09-04 — Publish: corner bay, not rubble

- **What:** Apartment fire is a compartment. First steel fail ~13 min at 575 °C. That bay pancakes; the rest stands. Header is “A GrumpyTechBro Joint.” Title 9/11 Collapse Lab.
- **Why:** 90-minute “rubble” while CGrav sat at 7.00 m was a timer lying. An apartment fire takes a bite, it does not flatten eight stories.
- **How:** `heatCompartments`, bay unlock when two columns die, honest settle copy. No 90-minute force-settle.

## 2026-09-04 — Charcoal sticks, not noodles

- **What:** Logs blacken with heat. A stick is one log until a neighbour is half charcoal or the join hits ignition. SAT prefers Y so the crib is not a Z-grid. Apartment faces are bay × course panels with brick edges.
- **Why:** Tumbling tan noodles, gray iso faces, and 14 m facade ribbons were the last visual lie.
- **How:** `woodRgb` surface-char from 80 °C. Joins track neighbour temp. `resolveAabb` Y-prefer. 6-material walls. Smaller boards.

## 2026-09-04 — Pieces fall; they do not shrink

- **What:** Bonfire logs are four length-sections (---- not —). Charcoal unlocks and drops. Houses are boards that fall. No sideways kick at unlock (Newton 1). Shrinking-in-place is gone.
- **Why:** Gravity wins because nothing invents a horizontal velocity. Locking members so they would not "pop out" was the wrong fix. IRL burning wood breaks and the pieces fall.
- **How:** `buildBonfire` ×4 along length. `heatPieces` no longer resizes. `unlockPiece` always vx=vz=0. `evaluatePieces` drops charred logs/timber. Giant floor plate removed; walls are panels.

Scratchpad. Older entries migrate to `docs/CHANGELOG.md`.

## 2026-09-04 — MVVM + tests + hostile comments

- **What:** Split Collapse Lab into Model / ViewModel / View. Unit tests on M and VM. File-level and function-level comments written for non-coders who will try to prove it is a video.
- **Why:** A critic should be able to open one small file per accusation. Mixing React, WebGL, and Euler in `src/lib/sim` made that a hunt.
- **How:** `src/model/`, `src/viewmodel/LabViewModel.ts`, `src/view/`. View constructs the VM, never `SimEngine`. `npm test` covers G, Eurocode knots, neighbor heat, drop-only, Fire Speed vs gravity, play/pause.

## 2026-09-04 — Public audit repo

- **What:** `twinforces/GTB911sim` first commit is the working sim *before* the split (hash `53e0027`), so nobody can claim we “fixed the physics while we reorganized.”
- **Why:** Two-push lunch request. Snapshot, then architecture.
- **How:** Header PFP + “An @GrumpyTechBro joint.” Ringmaster plugin loaded from `twinforces/grokdevprompts`.
