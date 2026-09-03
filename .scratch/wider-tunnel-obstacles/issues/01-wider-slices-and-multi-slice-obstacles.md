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

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `Config.tunnel.sliceWidth` is widened from its 12 px placeholder to a
      larger placeholder value; the generation math assumes no specific value.
- [ ] `Config.tunnel` gains `obstacleMinSlices` and `obstacleMaxSlices` (integers
      `>= 1`); each Obstacle's span is drawn uniformly from `[min, max]` off the
      Seed RNG, in the same stream as `edge` and `depth`.
- [ ] `Slice` and `Obstacle` interfaces are unchanged; `collision.ts` and
      `render/index.ts` are unchanged.
- [ ] An Obstacle stamps identical `{ edge, depth }` onto every Slice of its span.
- [ ] While an Obstacle is placed, the Gap centre is held constant at its
      first-Slice value; `top` and `bottom` are level across the span. Centre
      drift resumes on the first clear Slice after the span.
- [ ] `depth` uses `maxDepth * (0.4 + 0.6 * r)` with `maxDepth` computed from the
      smallest raw Gap across the span, so
      `gap - depth >= helicopter.height + clearance` on every Slice of the span.
- [ ] At least one Slice with `obstacle: null` separates any two Obstacle groups
      (replaces "never two consecutive obstacle slices").
- [ ] Band gating is unchanged: at most one Obstacle starts per
      `obstacleInterval` band past `graceDistance`; band 0 stays clear; the grace
      distance stays Obstacle-free.
- [ ] A span that begins near an `extendTunnel` call boundary is fully resumable
      from `TunnelGen` alone; stable-prefix and incremental-equals-one-shot
      guarantees hold, including when a span straddles a boundary.
- [ ] `maxEdgeStep` formula is unchanged; the per-Slice edge-step bound
      (`followFactor * maxEdgeStep`) holds for every adjacent Slice pair at the
      new `sliceWidth`, across many Seeds.
- [ ] Tests updated / added at the existing seam (`generateTunnel` /
      `extendTunnel` / `initTunnelGen`, plus `step` / `createInitialState`):
  - [ ] every Obstacle group's Slices share one `edge` and one `depth`
  - [ ] every group length is in `[obstacleMinSlices, obstacleMaxSlices]`, and
        group lengths vary across a long Tunnel / many Seeds
  - [ ] `>= 1` clear Slice between consecutive groups
  - [ ] successive group *starts* are about one `obstacleInterval` apart
  - [ ] `top` and `bottom` are constant across each group's Slices
  - [ ] effective opening `>= helicopter.height + clearance` on every Slice
        (existing test, confirmed with wide spans)
  - [ ] determinism / stable prefix / incremental == one-shot, with a Seed +
        `toIndex` where a group straddles an `extendTunnel` boundary
  - [ ] worked-number assertions in the edge-step test updated for the new
        `sliceWidth`
  - [ ] one end-to-end sim test: a Run that clears a wide top-edge Obstacle's
        tip but dives into its trailing corner ends `wrecked`
- [ ] `npm test` (or the project's test command) passes.
- [ ] ADR-0003 gets a one-line amendment: "Obstacles never occupy consecutive
      slices" is restated as "distinct Obstacles are separated by at least one
      clear Slice".
