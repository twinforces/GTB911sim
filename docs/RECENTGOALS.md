# Recent goals

Scratchpad. Older entries migrate to `docs/CHANGELOG.md`.

## 2026-09-04 — MVVM + tests + hostile comments

- **What:** Split Collapse Lab into Model / ViewModel / View. Unit tests on M and VM. File-level and function-level comments written for non-coders who will try to prove it is a video.
- **Why:** A critic should be able to open one small file per accusation. Mixing React, WebGL, and Euler in `src/lib/sim` made that a hunt.
- **How:** `src/model/`, `src/viewmodel/LabViewModel.ts`, `src/view/`. View constructs the VM, never `SimEngine`. `npm test` covers G, Eurocode knots, neighbor heat, drop-only, Fire Speed vs gravity, play/pause.

## 2026-09-04 — Public audit repo

- **What:** `twinforces/GTB911sim` first commit is the working sim *before* the split (hash `53e0027`), so nobody can claim we “fixed the physics while we reorganized.”
- **Why:** Two-push lunch request. Snapshot, then architecture.
- **How:** Header PFP + “An @GrumpyTechBro joint.” Ringmaster plugin loaded from `twinforces/grokdevprompts`.
