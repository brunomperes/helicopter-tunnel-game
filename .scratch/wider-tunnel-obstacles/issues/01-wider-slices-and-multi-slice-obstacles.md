# 01: Wider slices and multi-slice obstacles

**What to build:** The Tunnel generates on a coarser grid, and an Obstacle is a
chunky rectangular block of varying width instead of a one-Slice spike. The Slice
width is widened. Each Obstacle spans a random whole number of Slices drawn from
the Seed, reads as a true rectangle (edges held level across it), and is always
separated from the next Obstacle by at least one clear Slice. Every ADR-0003
solvability guarantee still holds for every Slice. `collision.ts` and
`render/index.ts` are not touched — a multi-Slice Obstacle is a run of
consecutive `Slice`s each carrying an `Obstacle` with identical `edge` and
`depth`, which both modules already handle per Slice.

Full detail, rationale, and user stories: `.scratch/wider-tunnel-obstacles/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

## Resolution

Implemented and merged to `main` in commits `0c086ec` → `f195d22` →
`e225a3e` → `af5d9cd` → `f8d6990` → `950d3bf` (TDD cycles 1–8, plus the
`obstacleMinSlices` 3→1 follow-up). Changes were contained to `src/sim/config.ts`,
`src/sim/tunnel.ts`, `src/sim/sim.test.ts`, and `docs/adr/0003-tunnel-solvability.md`;
`collision.ts` and `render/index.ts` were not touched. `npm test` passes (36 tests).

## Acceptance criteria

- [x] `Config.tunnel.sliceWidth` is widened from its 12 px placeholder to a
      larger placeholder value; the generation math assumes no specific value.
      (`sliceWidth: 24`; `tunnel.ts` derives all timing/step math from it.)
- [x] `Config.tunnel` gains `obstacleMinSlices` and `obstacleMaxSlices` (integers
      `>= 1`); each Obstacle's span is drawn uniformly from `[min, max]` off the
      Seed RNG, in the same stream as `edge` and `depth`. (`1`/`7`; span drawn
      before `side`/`size` in the same `nextRandom` chain.)
- [x] `Slice` and `Obstacle` interfaces are unchanged; `collision.ts` and
      `render/index.ts` are unchanged.
- [x] An Obstacle stamps identical `{ edge, depth }` onto every Slice of its span.
- [x] While an Obstacle is placed, the Gap centre is held constant at its
      first-Slice value; `top` and `bottom` are level across the span. Centre
      drift resumes on the first clear Slice after the span.
- [x] `depth` uses `maxDepth * (0.4 + 0.6 * r)` with `maxDepth` computed from the
      smallest raw Gap across the span (`spanEndGap`), so
      `gap - depth >= helicopter.height + clearance` on every Slice of the span.
- [x] At least one Slice with `obstacle: null` separates any two Obstacle groups
      (`clearDebt` set to 1 when a block ends).
- [x] Band gating is unchanged: at most one Obstacle starts per
      `obstacleInterval` band past `graceDistance`; band 0 stays clear; the grace
      distance stays Obstacle-free.
- [x] A span that begins near an `extendTunnel` call boundary is fully resumable
      from `TunnelGen` alone (`obstacleRemaining` / `obstacleEdge` /
      `obstacleDepth` / `clearDebt` carried in the walk state); stable-prefix and
      incremental-equals-one-shot guarantees hold, including when a span straddles
      a boundary.
- [x] `maxEdgeStep` formula is unchanged; the per-Slice edge-step bound
      (`followFactor * maxEdgeStep`) holds for every adjacent Slice pair at the
      new `sliceWidth`, across many Seeds.
- [x] Tests updated / added at the existing seam (`generateTunnel` /
      `extendTunnel` / `initTunnelGen`, plus `step` / `createInitialState`):
  - [x] every Obstacle group's Slices share one `edge` and one `depth`
        ("makes each obstacle a block of slices sharing one edge and one depth")
  - [x] every group length is in `[obstacleMinSlices, obstacleMaxSlices]`, and
        group lengths vary across a long Tunnel / many Seeds
        ("varies obstacle block width within the configured slice range")
  - [x] `>= 1` clear Slice between consecutive groups
        ("places obstacle blocks only past the grace distance, each parted by a
        clear slice")
  - [x] successive group *starts* are about one `obstacleInterval` apart
        ("spaces successive obstacle blocks by about one obstacleInterval")
  - [x] `top` and `bottom` are constant across each group's Slices
        ("holds the corridor centre fixed across an obstacle block")
  - [x] effective opening `>= helicopter.height + clearance` on every Slice
        ("keeps the effective opening at least a helicopter plus clearance" +
        "keeps the opening clear through the whole of a mid-ramp obstacle block")
  - [x] determinism / stable prefix / incremental == one-shot, with a Seed +
        `toIndex` where a group straddles an `extendTunnel` boundary
        ("resumes an obstacle block that straddles an extendTunnel boundary")
  - [x] edge-step test expressed against the config `sliceWidth` (not a stale
        worked number): `t = c.tunnel.sliceWidth / speed`.
  - [x] one end-to-end sim test: a Run that dives into a wide Obstacle's body
        past its leading slice ends `wrecked` ("crashes into the body of a wide
        obstacle block, not only its leading slice").
- [x] `npm test` (or the project's test command) passes. (36 tests.)
- [x] ADR-0003 amended: an obstacle "block spanning one or more consecutive
      slices from a single edge at one depth, and distinct obstacles are always
      parted by at least one clear slice".
