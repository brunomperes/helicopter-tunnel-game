# Pause is a shell concern, not a sim Phase

Pausing a run lives entirely in the shell (`src/app.ts` + a small pure helper in
`src/pause/`). It is **not** a sim `Phase` and the sim never learns about it. A
"frozen" tick is defined as "`step` was not called this tick": the fixed-timestep
loop holds its accumulator and resets the frame clock (the same trick the
`visibilitychange` handler uses for time the tab spent hidden) so time spent
frozen does not fast-forward the sim when it goes live again.

A tiny reducer models three shell modes and the events that move between them:

- `running` — the loop steps the sim.
- `paused` — frozen; render draws a scrim + "PAUSED". Two entry points, both a
  no-op outside a `flying` run: the pause key (`Esc` / `P`), and the tab becoming
  hidden mid-run (auto-pause). Auto-pause is a one-way trip — returning to the tab
  lands on "PAUSED" and resumes with a thrust press like any other pause, never
  automatically.
- `resuming` — frozen; a 1500 ms wall-clock countdown (`3 → 2 → 1`, one digit per
  500 ms via `ceil(msLeft / 500)`), advanced by a `tick` event carrying the
  frame's elapsed ms. Render draws only the digit over the frozen field — no
  scrim — so the player can re-orient before re-entering motion. Entered by
  thrust from `paused`; at zero the mode flips to `running` and the sim goes live
  with whatever thrust is then held (the resuming press is not consumed or
  replayed). The pause key during the countdown returns to `paused` and discards
  it, so the next thrust starts a fresh `3 → 2 → 1`.

The helper has its own unit tests (transitions, countdown progression,
reset-on-re-pause). Render learns the mode through `HudModel` fields (`paused`,
`resumeDigit`) and draws the matching overlay.

Why not add a `paused` value to the sim `Phase`: ADR-0002 makes a run a pure
function of `(seed, thrust sequence)`. Threading pause through the sim would put
wall-clock-driven, shell-only state into that pure core, break the property that
replaying a thrust sequence reproduces a run exactly, and complicate every sim
test with a mode that has nothing to do with the physics. Keeping pause in the
shell costs a second piece of state for `app` to juggle alongside `Phase`, and
means the pause reducer and the sim `step` are two separate state machines the
shell has to keep coherent — an acceptable trade for leaving the sim untouched.
