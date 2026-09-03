# DISTANCE readout shows on the attract screen

Status: ready-for-human

## Context

On the attract screen the bottom-left HUD shows `DISTANCE: <n>` with `n`
counting upward. Attract mode idle-scrolls the background (`scrollDemo` in
`src/sim/index.ts` advances `state.distance` every tick to keep the tunnel
moving), and `render()` in `src/render/index.ts` calls `drawHud` unconditionally
(line 25), so the demo scroll distance is rendered as if it were a live score.

The helicopter is already gated on `state.phase !== "attract"` (line 24); the
HUD is not.

## Why it's wrong

The number is meaningless before a run has started — it's just the attract
background's scroll offset — and it reads as a score the player hasn't earned.
`BEST` is already drawn centre-screen by `drawAttract`, so the bottom HUD adds
nothing on this phase.

## Possible fix (not yet actioned)

Gate `drawHud` on `state.phase !== "attract"` in `render()`, mirroring the
helicopter draw on the line above. A render test asserting no `DISTANCE` text is
emitted while `phase === "attract"` would lock it down.

## Comments

### 2026-09-03 — implemented (branch `worktree-hud-01-distance-attract`)

Applied the suggested fix: `render()` now gates `drawHud` on
`state.phase !== "attract"`, on the line right after the matching helicopter
gate in `src/render/index.ts`.

Added `src/render/render.test.ts` — the first render-layer test. It uses a
minimal recording context that captures `fillText` strings and asserts:

- attract phase (after several demo-scroll ticks, `distance > 0`) emits no
  `DISTANCE` text;
- flying phase emits both `DISTANCE:` and `BEST:` from the bottom HUD.

`pnpm test` (38 passing), `pnpm typecheck`, `pnpm check` all clean. Awaiting
human review / merge.
