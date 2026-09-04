# Collapse Lab

An [@GrumpyTechBro](https://x.com/GrumpyTechBro) joint.

Interactive 3D physics, not a video. A teaching path:

**Boy Scout bonfire → 1-storey house → 2-storey house → apartment → North/South Tower.**

Gravity is 9.81 m/s². Steel follows Eurocode 3 reduction factors. Wood chars. Fire spreads by **neighbor heat**: a burning member warms what is within a couple of metres; when that neighbor crosses ignition temperature, it lights. No whole-wall cheat.

The claim this lab is built against is “one face was hit, so the tower had to tip over like a chimney.” Run **Rigid tree** (crush off) to see that cartoon. Run **North Tower** to see the same gravity with floors that can fail.

## Architecture (MVVM)

Critics: start here, then open the tiny file that matches the accusation.

| Layer | Where | What you are looking at |
| --- | --- | --- |
| **Model** | [`src/model/`](src/model/) | Physics. No React. No WebGL. Numbers and members. Start at [`src/model/README.md`](src/model/README.md). |
| **ViewModel** | [`src/viewmodel/`](src/viewmodel/) | Play / pause / speed / which run. Turns the model into labels the UI shows. The View never constructs `SimEngine`. |
| **View** | [`src/view/`](src/view/) | Buttons, captions, the 3D canvas. Pretty. Not the argument. |

If you think the fire is painted on, you want [`src/model/pieces.ts`](src/model/pieces.ts) (`spreadPieces`) and [`src/model/engine.ts`](src/model/engine.ts) (`spreadFire`). If you think gravity is faked, you want [`src/model/constants.ts`](src/model/constants.ts) (`G = 9.81`) and `integratePieces`. If you think Fire Speed also speeds up the collapse, you want `SimEngine.step()` — heating is scaled, falling is not.

Tests that prove those three claims live next to the code:

- `src/model/constants.test.ts` — `G === 9.81`
- `src/model/steel.test.ts` — Eurocode 3 knots, including 600 °C → 0.47
- `src/model/pieces.test.ts` — tree-only ignition, couch gate, drop-only unlock, gravity
- `src/model/engine.test.ts` — Fire Speed heats; it does not add gravity
- `src/viewmodel/LabViewModel.test.ts` — play / pause / speed / which-run

## How to run

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Dev server binds `0.0.0.0:8080` (this project started in Grok Build).

## Tests

`npm test` runs Model and ViewModel unit tests plus the platform script tests. Those are the layers you can prove wrong in a terminal without a GPU.

## License

Source is published so it can be audited. The physics citations (Eurocode 3, NIST NCSTAR 1 times as *comparison*, not as a forced target) are documented in the model files themselves.
