# Grace-exit difficulty spike: abrupt drift + first obstacle

Status: needs-triage

## Context

While TDD-building the tunnel generator (`src/sim/tunnel.ts`, branch `worktree-sim-tdd`)
the ADR-0003 invariants were all satisfied and tested:

- per-slice edge movement stays at ~1.0–1.2 px against a ~1.7–2.0 px reachable
  bound (`tunnel.followFactor = 0.6`),
- effective opening never drops below `helicopter.height + tunnel.clearance` (84 px),
- obstacles never occupy consecutive slices, first obstacle band deferred to
  `graceDistance + obstacleInterval`.

However, a crude reactive autopilot (bang-bang on the time-optimal switching curve,
targeting the tightest opening in a 360 px look-ahead window) clears 5/8 test seeds
indefinitely but crashes on 3 — every failure clustered in the ~350 px right after
the grace corridor ends.

## Why

Two things switch on almost together at `graceDistance`:

1. the corridor centre, pinned dead-centre for the whole 1200 px grace stretch,
   is suddenly free to drift at the full per-slice budget, and
2. the first obstacle appears one `obstacleInterval` (340 px) later.

A planning player who reads the whole screen can pre-position and make it (so this
does not violate ADR-0003 "every crash is player error"). But the transition has no
easing, so the margin for a player who reacts late is thin exactly where a new
player first meets real difficulty.

## Possible refinement (not yet actioned)

Ease the drift budget and/or obstacle depth up over the first band or two past
`graceDistance` instead of 0 → full instantly. Would need its own test
(e.g. edge-step budget at `graceDistance + k` grows monotonically for small k).

## Comments
