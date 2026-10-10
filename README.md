# Helicopter Tunnel Game

A one-button helicopter-through-scrolling-tunnel game in the classic SFCave
lineage. Hold to thrust up, release to fall, don't crash. Distance is the score.

Runs in the browser: Canvas 2D, TypeScript, no game engine. See
[`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr)
for the design decisions.

## Status

Playable browser game. Implemented features include:

- Seeded scrolling tunnels with obstacles and an opening grace distance.
- A distance-based difficulty ramp that increases speed and narrows the gap.
- Helicopter physics, tunnel-edge and obstacle crash detection, and retry flow.
- Pixel-art helicopter and wreck sprites, a smoke trail, and a responsive play area.
- Distance display and best-distance persistence in `localStorage`, with an
  in-memory fallback when storage is unavailable.
- Manual pause, automatic pause when the tab is hidden, and a resume countdown.

## Play

Press and hold **Space**, **Arrow Up**, the primary mouse button, or touch to
start and thrust upward. Release to fall. After a crash press again to retry.

Press **Esc** or **P** during a run to pause. Switching away from the tab also
pauses the run. Press thrust to resume after a **3 → 2 → 1** countdown.

Each run gets a new random seed. Add `?seed=<string>` to the URL to replay the
same tunnel on every retry. A run is deterministic for a given seed and sequence
of thrust inputs.

## Develop

Requires [pnpm](https://pnpm.io/) (the version is pinned in `package.json`).

```sh
pnpm install
pnpm dev         # dev server
pnpm test        # run all tests (Vitest)
pnpm test:watch  # watch mode
pnpm typecheck   # tsc --noEmit
pnpm check       # biome lint + format check
pnpm format      # biome autofix
pnpm build       # typecheck + production build to dist/
pnpm preview     # serve the production build locally
```

The dev server also shows the helicopter's collision box and a speed/distance
readout for playtesting.

## Layout

| Path           | Responsibility                                                         |
| -------------- | ---------------------------------------------------------------------- |
| `src/sim/`     | Pure deterministic core: state machine, physics, tunnel gen, collision |
| `src/render/`  | Draws a sim state to a canvas context (read-only w.r.t. the sim)       |
| `src/input/`   | DOM events → one `thrustHeld` boolean                                  |
| `src/pause/`   | Pause state and resume countdown                                       |
| `src/storage/` | `localStorage` best-distance persistence                               |
| `src/ui.ts`    | HTML overlays, instructions, and distance displays                     |
| `src/theme.ts` | Shared colors and sprite palette                                       |
| `src/app.ts`   | Canvas ownership + fixed-timestep loop + wiring                        |
