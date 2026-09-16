# Model — read this first if you think we cheated

This folder is the physics. It does not draw. It does not play. It integrates.

If you are here to prove the lab is a video, pick the accusation and open the file. That is the whole point of the split.

| You think… | Open | Function |
| --- | --- | --- |
| Gravity is faked | `constants.ts`, `pieces.ts` | `G = 9.81`. `integratePieces` does `vy -= G * dt`. |
| Fire Speed also speeds the collapse | `engine.ts` `step()` | Heat is multiplied by `speed`. Falling is not. |
| The fire is painted on a whole wall | `pieces.ts` `spreadPieces`, `engine.ts` `spreadFire` | A burning member warms neighbors, including the floor above. They light when *they* pass ignition temperature. No clock unlocks story 94. |
| The Christmas tree lights the whole house | `pieces.ts` `ignitePieces` + `spreadPieces` | Ignition is the tree only. The tree cannot heat anything but the couch until the couch is lit. |
| Members fly sideways (demolition) | `pieces.ts` `unlockPiece` | `drop = true` zeroes `vx` and `vz`. Houses and apartments always drop. |
| Wall panels jump around | `pieces.ts` `integratePieces` / `zNear` | 3-axis AABB. Front and back walls share x,y. Without a z test they explode apart. Restitution is 0. |
| Logs shrink / boil like noodles | `pieces.ts` `weldStickGroups`, `evaluatePieces` | Four sections + three joins. A stick is one rigid body until a neighbour is half charcoal or the join hits ignition. Contacts prefer Y for stacks so the crib is not a Z-grid. |
| Logs don't darken | `wood.ts` `woodRgb` | Surface char from 80 °C. Ignition is already charcoal. Ember is a coal edge, not a floodlight. |
| Apartment faces gray / 14 m ribbons | `pieces.ts` `buildApartment`, `scene3d.ts` | Bay × course panels. Street faces carry the window texture; edges are brick. |
| Nothing rotates — is that beyond the engine? | `pieces.ts` `unlockPiece`, `integratePieces` | Pieces have always had `theta` / `omega`. Unlock is a small flop capped by length (not a centrifuge). |
| Apartment never collapses | `pieces.ts` `evaluatePieces` apartment branch | Two fire-floor columns losing Eurocode yield is a story mechanism. Nearby bay panels drop, not one 14 m ribbon. |
| Houses don’t burn down / settle too early | `pieces.ts` `evaluatePieces`, `piecesSettled` | Timber has to char. Roof has to come down before “settled.” |
| Steel “melts” | `steel.ts` `fyFactor` | Eurocode 3 Table 3.1. Yield is gone by 1200 °C. Steel melts near 1500 °C. Office fires never get there. We reduce *strength*, we do not melt columns. |
| The tower is pre-leaned so it tips | `engine.ts` `standingLean()` | Returns **0** for the standing shaft. CGrav offset is a number in metres, not a banana. |
| Rigid tree and crush are the same clip | `scenarios.ts` (`tree` vs `north`) + `engine.ts` `initiate()` | `crush: false` hinges the upper block. That is the cartoon. `crush: true` drops it through the footprint. |
| WTC 7 is a short twin | `frame.ts`, `engine.ts` `evaluateFrame` | Seated girder at column 79. αLΔT walk-off, then Euler on a missing brace. 80/81 follow because they only share load through those floors. Shell last. |
| NIST time is a forced target | `engine.ts` `evaluateStructure` | NIST minutes are a *comparison* on the HUD. Collapse is `capacity < load`. No hold-until-72%, no force-at-105%. |
| Center Gravity is decorative | `pieces.ts` `pieceCgrav`, `engine.ts` `cgOffset` | Mass-weighted. Telemetry is that number. |

## How a step works (pieces world)

1. `stepPieceHeat(dt * FireSpeed)` — temperatures, fuel, char, neighbor heat, then “is this member still strong enough?”
2. `stepPieceMotion(dt)` — gravity and collisions at 1×, always.
3. Camera, particles, bubbles — presentation. They cannot change `intact`, `temp`, or `vy`.

## How a step works (tower world)

1. `stepFire(dt * FireSpeed)` — heat columns, walk fire one story at a time, Eurocode 3 remaining yield. WTC 7: `evaluateFrame` (walk-off, then unbraced buckle).
2. `evaluateStructure` — if remaining capacity < load, `initiate`. NIST minutes are not a gate.
3. `stepCollapse(dt)` — Bazant-style crush, or a hinge if you turned crush off.

## What this is not

- Not NIST NCSTAR 1. Lumped five-column groups, not 236 perimeter columns.
- Not LS-DYNA. 2D Euler plus a z scatter, not a continuum FEM.
- Not a video. Change Fire Speed, “Fire stays put,” or “Rigid tree” and the numbers change.

If a number in here looks like a fudge, say which line. That is the debate we wanted.
