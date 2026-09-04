# Pause is a shell concern, not a sim Phase

Pausing a run lives entirely in the shell (`src/app.ts` + a small pure helper in
`src/pause/`). It is **not** a sim `Phase` and the sim never learns about it.
"Paused" is defined as "`step` was not called this tick": the fixed-timestep loop
holds its accumulator and resets the frame clock (the same trick the tab-hidden
path already uses) so a long pause does not fast-forward the sim on resume. A
tiny reducer models the two shell modes — `running` and `paused` — and the events
that move between them (`pauseKey`, `thrust`), with its own unit tests. Render
learns it is paused through a `HudModel` flag and draws the overlay.

Why not add a `paused` value to the sim `Phase`: ADR-0002 makes a run a pure
function of `(seed, thrust sequence)`. Threading pause through the sim would put
wall-clock-driven, shell-only state into that pure core, break the property that
replaying a thrust sequence reproduces a run exactly, and complicate every sim
test with a mode that has nothing to do with the physics. Keeping pause in the
shell costs a second piece of state for `app` to juggle alongside `Phase`, and
means the pause reducer and the sim `step` are two separate state machines the
shell has to keep coherent — an acceptable trade for leaving the sim untouched.
