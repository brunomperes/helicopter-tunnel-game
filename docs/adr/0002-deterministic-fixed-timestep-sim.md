# Deterministic fixed-timestep sim as a pure core

All game logic lives in `src/sim/`: a pure module with one entry point,
`step(state, thrustHeld) -> state`, that imports nothing browser-bound and holds
no hidden state. Randomness comes only from a seeded PRNG carried in the state. The
shell (`render`, `input`, `storage`, `app`) is thin and untested; `app` runs the
sim at a fixed 120 Hz via an accumulator, decoupled from `requestAnimationFrame`
rendering, which interpolates between the last two sim states.

Why, rather than the usual "advance physics by the rAF delta": a fixed timestep
makes a run a pure function of `(seed, input sequence)`. That makes the `Ramp` and
tunnel generation behave identically on any refresh rate, makes bugs reproducible
from a seed, and makes the sim exhaustively unit-testable without a DOM (ADR
scope of `sim` tests in `docs/agents/domain.md` context). The cost is the
accumulator/interpolation machinery and the discipline of keeping `sim` pure —
every non-deterministic or DOM-bound thing must be pushed out to the shell.
