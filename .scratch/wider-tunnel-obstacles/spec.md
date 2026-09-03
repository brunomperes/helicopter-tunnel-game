# Wider slices and multi-slice obstacles

Status: ready-for-agent

## Problem Statement

Every Obstacle is exactly one Slice wide (12 px on the current config). On screen
it reads as a hairline spike, not a block. A twitch of Thrust threads it, and
because width never varies, every Obstacle plays the same. The Tunnel edges also
change direction on the same fine 12 px grid.

The player wants Obstacles that are visibly chunky blocks of varying width, so
that clearing one means committing to a path above or below it for a stretch
rather than flicking past its tip. Width should be a source of challenge and of
variety between Obstacles.

## Solution

- The Slice (the unit the Tunnel is generated in) is widened.
- An Obstacle spans a random whole number of Slices, drawn per Obstacle from a
  configured range, instead of always one.
- An Obstacle's faces are flat: while it is placed, the Gap centre is held so
  both Tunnel edges are level across its Slices, and it reads as a true
  rectangular block (per `CONTEXT.md`, "Obstacle").
- Between any two Obstacles there is always at least one clear Slice.
- All ADR-0003 solvability invariants continue to hold for every Slice: the
  effective opening never drops below a Helicopter height plus clearance, and no
  edge moves further between adjacent Slices than the Helicopter can physically
  cover while that Slice scrolls past.

## User Stories

1. As a player, I want Obstacles that are visibly wider than a sliver, so that
   they register as real blocks I fly around rather than hairline spikes.
2. As a player, I want Obstacle width to vary from one Obstacle to the next, so
   that the Tunnel keeps surprising me instead of every Obstacle playing
   identically.
3. As a player, I want a wide Obstacle to force me to hold a path above or below
   it for a stretch, so that clearing it feels like a committed maneuver.
4. As a player, I want the Tunnel edges level directly above and below an
   Obstacle, so that I can read the safe opening past it at a glance.
5. As a player, I want at least one clear stretch of Tunnel between any two
   Obstacles, so that I always get a beat to reposition before the next one.
6. As a player, I want Obstacles still spaced about one obstacle interval apart
   on average, so that the rhythm of a Run is unchanged even though each Obstacle
   is now wider.
7. As a player, I want every Obstacle to still leave an opening at least a
   Helicopter-plus-clearance tall, so that no Obstacle is an unavoidable Crash.
8. As a player, I want a wider Obstacle never to be deeper than the Gap can
   safely allow, so that width adds challenge without making the Tunnel
   unsolvable.
9. As a player, I want the opening stretch of every Run (the grace distance) to
   stay Obstacle-free, so that I still get an unpressured start.
10. As a player, I want the same Seed to always produce the same Obstacles at the
    same widths and places, so that a Run is reproducible and a shared Seed plays
    identically for everyone.
11. As a player replaying a pinned Seed, I want Obstacle widths to be part of what
    the Seed fixes, so that practicing a known Tunnel is meaningful.
12. As a player, I want the Tunnel edges to undulate on a coarser grid, so that
    the passage feels like sweeping movement rather than fine stair-steps.
13. As a player, I want the coarser edge grid to still never jump further than I
    can climb or dive in the time that stretch takes to pass, so that edge
    movement stays survivable.
14. As a player, I want a Crash into a wide Obstacle to happen when I actually
    touch any part of it, so that collision matches what I see.
15. As a player, I want to Crash into the leading vertical face of a wide
    Obstacle by flying into it at Obstacle height, so that the block is solid on
    all sides, not only at its tip.
16. As a player who flies above a top-edge Obstacle and dives too early, I want to
    clip its trailing corner, so that I must clear the whole width before
    descending.
17. As a player, I want each Obstacle to intrude from a single edge for its whole
    width, so that a block is either a ceiling block or a floor block, never both.
18. As a player, I want Obstacles to keep alternating unpredictably between the
    top and bottom edge, so that I can't settle into a fixed pattern.
19. As a player, I want a wide Obstacle next to a drifting section of Tunnel to
    still sit flush against flat wall, so that it never appears to float or
    overlap the opening ambiguously.
20. As a player, I want the Tunnel behind me unaffected by how far ahead the game
    has generated, so that a Run never visibly changes as it streams.
21. As a player on the Attract screen, I want the idling demo Tunnel to show the
    same wide Obstacles, so that the game previews itself honestly.
22. As a designer, I want Obstacle width bounds to be config values, so that I can
    tune how punishing Obstacles are without touching generation logic.
23. As a designer, I want the Slice width to be a single config value, so that I
    can trade edge-grid coarseness against feel and performance in one place.
24. As a designer, I want widening a Slice to loosen the per-Slice edge-step
    budget in proportion automatically, so that the Tunnel stays solvable at any
    Slice width I choose.
25. As a designer, I want Obstacle depth still derived from the current Gap and
    clearance, so that Obstacles auto-scale as the Ramp narrows the Gap.
26. As an agent maintaining the code, I want multi-Slice Obstacles to need no
    change to collision or rendering, so that the change stays contained to
    Tunnel generation and its tests.
27. As an agent, I want the existing Tunnel-generation test suite to still
    express every invariant, restated for Obstacle groups instead of single
    Slices, so that regressions are caught at the same seam.

## Implementation Decisions

### Data model — unchanged interfaces

`Slice` and `Obstacle` in `src/sim/tunnel.ts` are unchanged. A multi-Slice
Obstacle is represented as a run of consecutive `Slice`s that each carry an
`Obstacle` with **identical `edge` and `depth`**:

```ts
// A 3-slice obstacle from the top edge:
slices[i]   .obstacle = { edge: "top", depth: 90 }
slices[i+1] .obstacle = { edge: "top", depth: 90 }
slices[i+2] .obstacle = { edge: "top", depth: 90 }
```

`src/sim/collision.ts` (`crashes`, `heliSliceRange`) and `src/render/index.ts`
(`drawTunnel`, `drawObstacle`) already iterate per Slice and are **not modified**.
The single obstacle spike they draw / test today is just the span-1 case.

### Config

`Config.tunnel` gains:

- `obstacleMinSlices`, `obstacleMaxSlices` — integers `>= 1`, inclusive bounds on
  how many consecutive Slices one Obstacle spans. Each Obstacle's span is drawn
  uniformly from `[min, max]` off the Seed RNG.
- `sliceWidth` is widened from its current placeholder to a larger placeholder.
  The exact value is a tuning concern, **not fixed by this spec**; it stays a
  single config value and the generation math must not assume any particular one.

### Generation (`extendTunnel` / `initTunnelGen` / `TunnelGen`)

- Band gating is unchanged: at most one Obstacle may *start* per
  `obstacleInterval`-wide band past `graceDistance`; band 0 stays clear;
  `prevBand` still records the last band that produced an Obstacle.
- When an Obstacle starts, the generator commits a span `S` in
  `[obstacleMinSlices, obstacleMaxSlices]` plus an `edge` and a `depth`, and
  stamps `{ edge, depth }` onto the next `S` Slices.
- **Separation rule (replaces "never two consecutive obstacle slices"):** after an
  Obstacle's last Slice, at least one Slice with `obstacle: null` must be emitted
  before another Obstacle may start. One clear Slice is enough.
- **Held-flat edges:** for the duration of an Obstacle's span, the Gap centre is
  held constant at the value it had on the Obstacle's first Slice. The raw Gap
  still follows the Ramp (its change over a span is negligible and is not
  special-cased). Centre-drift budgeting resumes on the first clear Slice after
  the span.
- **Depth / solvability:** keep `depth = maxDepth * (0.4 + 0.6 * r)`, but compute
  `maxDepth` from the *smallest* raw Gap across the span (the far end, where the
  Ramp has narrowed most) so `gap - depth >= helicopter.height + clearance` holds
  on every Slice of the span. With edges held flat this equals today's
  single-Slice computation to within the Ramp's sub-pixel drift.
- `TunnelGen` walk state: replace `prevHadObstacle` with whatever is needed to
  (a) know how many Obstacle Slices remain to stamp, (b) carry the committed
  `edge` / `depth` across them, (c) enforce the one-clear-Slice gap. A span that
  begins near an `extendTunnel` call boundary must be fully resumable from
  `TunnelGen` alone — no regeneration of the prefix.

### Solvability math

`maxEdgeStep` is already `f(sliceWidth, rampSpeed, physics)`. A wider `sliceWidth`
raises the per-Slice scroll time and therefore the reachable vertical distance,
and the `followFactor` clamp scales with it. **No formula change** — the
per-Slice edge-step bound stays valid at any `sliceWidth`.

### Determinism

Obstacle span is drawn from the same RNG stream as `edge` and `depth`, so it is
fully determined by the Seed. Stable-prefix and
incremental-equals-one-shot guarantees are preserved, including when a span
straddles an `extendTunnel` boundary.

### Attract mode

The wide Obstacles appear in the Attract demo scroll once the demo keeps
extending the Tunnel — tracked separately in
`.scratch/tunnel-generation/issues/02-attract-scroll-stops-generating-tunnel.md`.
No extra work in this spec.

## Testing Decisions

A good test asserts externally observable properties of the generated Tunnel and
of Crashes, over **many Seeds**, never internal generator fields. The seam is the
pure generator: `generateTunnel` / `extendTunnel` / `initTunnelGen` from
`src/sim/tunnel.ts`, plus `step` / `createInitialState` for the collision cases.
This is the same single seam the current suite uses.

Prior art: the whole `describe("tunnel generation")` block in
`src/sim/sim.test.ts` (edge-step bound, opening floor, obstacle spacing,
determinism, stable prefix, incremental == one-shot) and the collision cases in
`describe("sim lifecycle")` ("crashes into the tunnel ceiling/floor edge", "does
not crash inside the centred, obstacle-free grace corridor").

Modules under test: `src/sim/tunnel.ts` (generation); `crashes` behaviour
exercised end-to-end through the sim.

New and updated tests:

- **Obstacle groups.** Collapse each maximal run of consecutive Obstacle-carrying
  Slices into a group. Assert: every group's Slices share one `edge` and one
  `depth`; every group length is in `[obstacleMinSlices, obstacleMaxSlices]`;
  group lengths vary across a long Tunnel / many Seeds (not all equal).
- **Separation.** Between the last Slice of one group and the first Slice of the
  next there is `>= 1` Slice with `obstacle: null`. (Replaces the current
  "gap > 1 between obstacle indices" assertion.)
- **Spacing.** Successive *group starts* are about one `obstacleInterval` apart
  (adapt the existing "spaces successive obstacles by about one obstacleInterval"
  test to measure group starts).
- **Flat edges.** Within every group, `top` is constant and `bottom` is constant
  across the group's Slices, to floating tolerance.
- **Opening floor.** The existing "keeps the effective opening at least a
  helicopter plus clearance" test already walks every Slice and covers Obstacle
  Slices — keep it; confirm it holds with wide spans.
- **Edge-step bound.** The existing adjacent-Slice test still holds (held-flat
  pairs move 0). Add: the first clear Slice after a group may resume drift but
  stays within `followFactor * maxEdgeStep`.
- **Determinism / stable prefix / incremental == one-shot.** Existing tests
  cover this; add a Seed + `toIndex` where a group straddles an `extendTunnel`
  boundary and assert the stitched result equals one-shot generation.
- **Grace distance.** The existing "no obstacles through the grace distance" test
  stays as-is.
- **Collision through the sim.** Script a Run that clears the tip of a wide
  top-edge Obstacle but dives into its trailing corner, and assert `wrecked` —
  locking that width is enforced by collision (no code change, but pin the
  behaviour). Prior art: "crashes into the tunnel ceiling edge when thrust is
  held continuously".
- **Config math.** Update the worked-number assertions in "bounds the per-slice
  edge step by the vertical distance the helicopter can cover" for the new
  `sliceWidth`.

## Out of Scope

- Rendering polish: smoothing the coarser edge grid into curves, Obstacle
  shading or art. Render stays scaffold; wider Slices will look chunkier and that
  is accepted for now.
- Non-rectangular, angled, or moving Obstacles.
- An Obstacle intruding from both edges in the same Slice (a gate).
- More than one Obstacle within a band.
- Tuning the actual `sliceWidth`, `obstacleMinSlices`, `obstacleMaxSlices`, and
  `obstacleInterval` values to a target difficulty — that is the playtest phase.
- Changing the Gap Ramp or speed Ramp.
- The Attract-mode "stops generating Tunnel" bug (issue 02 above).

## Further Notes

- ADR-0003 stays valid. Its line "Obstacles never occupy consecutive slices"
  should be read as "distinct Obstacles are separated by at least one clear
  Slice" — worth a one-line amendment to the ADR when this lands, not a new ADR.
- The run-of-equal-per-Slice-Obstacles representation was chosen specifically so
  collision and rendering need no change. A future Obstacle type that needs a
  genuine width field would be a larger refactor across three modules.
- Interaction with `.scratch/tunnel-generation/issues/01-grace-exit-difficulty-spike.md`:
  wide Obstacles just past the grace corridor could sharpen that spike; evaluate
  the easing refinement proposed there together with this change.
- Holding the centre flat under an Obstacle briefly pauses corridor wander; over
  many Obstacles this slightly reduces total vertical travel in a Run.
  Acceptable — note it for playtest.
