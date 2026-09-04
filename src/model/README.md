# Model — read this first if you think we cheated

This folder is the physics. It does not draw. It does not play. It integrates.

If you are here to prove the lab is a video, pick the accusation and open the file. That is the whole point of the split.

| You think… | Open | Function |
| --- | --- | --- |
| Gravity is faked | `constants.ts`, `pieces.ts` | `G = 9.81`. `integratePieces` does `vy -= G * dt`. |
| Fire Speed also speeds the collapse | `engine.ts` `step()` | Heat is multiplied by `speed`. Falling is not. |
| The fire is painted on a whole wall | `pieces.ts` `spreadPieces`, `engine.ts` `spreadFire` | A burning member warms neighbors. They light when *they* pass ignition temperature. |
| The Christmas tree lights the whole house | `pieces.ts` `ignitePieces` + `spreadPieces` | Ignition is the tree only. The tree cannot heat anything but the couch until the couch is lit. |
| Members fly sideways (demolition) | `pieces.ts` `unlockPiece` | `drop = true` zeroes `vx` and `vz`. Houses and apartments always drop. |
| Houses don’t burn down / settle too early | `pieces.ts` `evaluatePieces`, `piecesSettled` | Timber has to char. Roof has to come down before “settled.” |
| Steel “melts” | `steel.ts` `fyFactor` | Eurocode 3 Table 3.1. Yield is gone by 1200 °C. Steel melts near 1500 °C. Office fires never get there. We reduce *strength*, we do not melt columns. |
| The tower is pre-leaned so it tips | `engine.ts` `standingLean()` | Returns **0** for the standing shaft. CGrav offset is a number in metres, not a banana. |
| Rigid tree and crush are the same clip | `scenarios.ts` (`tree` vs `north`) + `engine.ts` `initiate()` | `crush: false` hinges the upper block. That is the cartoon. `crush: true` drops it through the footprint. |
| NIST time is a forced target | `engine.ts` `evaluateStructure` | NIST minutes are a *comparison*. The integrator is not keyed to hit 102:00. |
| Center Gravity is decorative | `pieces.ts` `pieceCgrav`, `engine.ts` `cgOffset` | Mass-weighted. Telemetry is that number. |

## How a step works (pieces world)

1. `stepPieceHeat(dt * FireSpeed)` — temperatures, fuel, char, neighbor heat, then “is this member still strong enough?”
2. `stepPieceMotion(dt)` — gravity and collisions at 1×, always.
3. Camera, particles, bubbles — presentation. They cannot change `intact`, `temp`, or `vy`.

## How a step works (tower world)

1. `stepFire(dt * FireSpeed)` — heat columns, walk fire one storey at a time, Eurocode 3 remaining yield.
2. `evaluateStructure` — if remaining capacity < load, `initiate`.
3. `stepCollapse(dt)` — Bazant-style crush, or a hinge if you turned crush off.

## What this is not

- Not NIST NCSTAR 1. Lumped five-column groups, not 236 perimeter columns.
- Not LS-DYNA. 2D Euler plus a z scatter, not a continuum FEM.
- Not a video. Change Fire Speed, “Fire stays put,” or “Rigid tree” and the numbers change.

If a number in here looks like a fudge, say which line. That is the debate we wanted.
