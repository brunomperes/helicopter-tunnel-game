/**
 * Deterministic tunnel generation. Given a seed the generator produces a fixed
 * sequence of `Slice`s, each a `config.tunnel.sliceWidth`-wide vertical segment
 * indexed by distance. Generation enforces the ADR-0003 solvability invariants,
 * so every tunnel it can produce is completable by a perfect player.
 */

import type { Config } from "./config.js";
import { rampGap, rampSpeed } from "./ramp.js";
import { hashSeed, nextRandom } from "./rng.js";

export interface Obstacle {
	/** Which edge the block intrudes from. */
	readonly edge: "top" | "bottom";
	/** How far it reaches into the gap, px. */
	readonly depth: number;
}

export interface Slice {
	/** y of the top tunnel edge (open space begins here), y-down. */
	readonly top: number;
	/** y of the bottom tunnel edge (open space ends here), y-down. */
	readonly bottom: number;
	/** The obstacle in this slice, or `null`. */
	readonly obstacle: Obstacle | null;
}

/**
 * Upper bound on how far a tunnel edge may move between one slice and the next,
 * px: the vertical distance the helicopter can cover while a single slice scrolls
 * past it, starting from rest. Derived from scroll speed at `distance`, thrust,
 * gravity and terminal velocity (ADR-0003). Shrinks as the run speeds up.
 */
export function maxEdgeStep(config: Config, distance: number): number {
	const { gravity, thrust, terminalVelocity } = config.physics;
	const scrollTime = config.tunnel.sliceWidth / rampSpeed(config, distance);
	const accel = Math.min(thrust - gravity, gravity);
	return Math.min(0.5 * accel * scrollTime * scrollTime, terminalVelocity * scrollTime);
}

/** Distance from the start of the run to the left edge of slice `index`, px. */
export function sliceDistance(config: Config, index: number): number {
	return index * config.tunnel.sliceWidth;
}

/** The first `sliceCount` slices of the tunnel for `seed`. Pure. */
export function generateTunnel(seed: string, config: Config, sliceCount: number): Slice[] {
	const worldHeight = config.world.height;
	const graceDistance = config.ramp.graceDistance;

	const { clearance, obstacleInterval } = config.tunnel;
	const heliHeight = config.helicopter.height;

	let rng = hashSeed(seed);
	let centre = worldHeight / 2;
	let target = centre;
	let prevGap = rampGap(config, 0);
	let prevBand = -1;
	let prevHadObstacle = false;

	const slices: Slice[] = [];
	for (let i = 0; i < sliceCount; i++) {
		const distance = sliceDistance(config, i);
		const gap = rampGap(config, distance);
		const lo = gap / 2;
		const hi = worldHeight - gap / 2;

		if (distance < graceDistance) {
			centre = worldHeight / 2;
		} else {
			// Room left in the edge-step budget after the ramp's own gap change.
			const budget = Math.max(0, maxEdgeStep(config, distance) - Math.abs(gap - prevGap) / 2);
			if (Math.abs(target - centre) <= budget) {
				const [r, next] = nextRandom(rng);
				rng = next;
				target = lo + r * (hi - lo);
			}
			centre = clampTo(centre + clampTo(target - centre, -budget, budget), lo, hi);
		}

		// One obstacle at the start of each `obstacleInterval`-wide band past the
		// grace distance; never on a slice adjacent to the previous obstacle.
		let obstacle: Obstacle | null = null;
		const band = Math.floor((distance - graceDistance) / obstacleInterval);
		if (distance >= graceDistance && band !== prevBand && !prevHadObstacle) {
			const maxDepth = gap - (heliHeight + clearance);
			if (maxDepth > 0) {
				const [side, afterSide] = nextRandom(rng);
				const [size, afterSize] = nextRandom(afterSide);
				rng = afterSize;
				obstacle = {
					edge: side < 0.5 ? "top" : "bottom",
					depth: maxDepth * (0.4 + 0.6 * size),
				};
			}
			prevBand = band;
		}

		slices.push({ top: centre - gap / 2, bottom: centre + gap / 2, obstacle });
		prevHadObstacle = obstacle !== null;
		prevGap = gap;
	}
	return slices;
}

function clampTo(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}
