# Helicopter Tunnel Game

A one-button helicopter-through-scrolling-tunnel game in the classic SFCave
lineage. Hold to thrust up, release to fall, don't crash. Distance is the score.

Runs in the browser: Canvas 2D, TypeScript, no game engine. See
[`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr)
for the design decisions.

## Develop

```sh
pnpm install
pnpm dev         # dev server
pnpm test        # run the sim test suite (Vitest)
pnpm test:watch  # watch mode
pnpm typecheck   # tsc --noEmit
pnpm check       # biome lint + format check
pnpm format      # biome autofix
pnpm build       # typecheck + production build to dist/
```

## Layout

| Path          | Responsibility                                                          |
| ------------- | ---------------------------------------------------------------------- |
| `src/sim/`    | Pure deterministic core: state machine, physics, tunnel gen, collision |
| `src/render/` | Draws a sim state to a canvas context (read-only w.r.t. the sim)       |
| `src/input/`  | DOM events → one `thrustHeld` boolean                                  |
| `src/storage/`| `localStorage` best-distance persistence                              |
| `src/app.ts`  | Canvas ownership + fixed-timestep loop + wiring                        |

A run is a pure function of `(seed, sequence of thrustHeld booleans)`. Pin the
tunnel with `?seed=<string>`.

## Status

Scaffold. The sim state machine, helicopter physics and the shell are wired;
tunnel generation, the difficulty ramp and real collision are stubbed and will be
built test-first.
