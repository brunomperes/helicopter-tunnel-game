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

/**
 * The generator's walk state. Held so a tunnel can be extended one slice at a
 * time as a run scrolls, without regenerating the prefix. Pure data.
 */
export interface TunnelGen {
	/** mulberry32 state for the next draw. */
	readonly rng: number;
	/** Current gap centre, px. */
	readonly centre: number;
	/** Centre the corridor is easing toward, px. */
	readonly target: number;
	/** Raw gap of the last generated slice, px. */
	readonly prevGap: number;
	/** Obstacle band index of the last generated slice. */
	readonly prevBand: number;
	/** Slices of the current obstacle block still to stamp (0 when none is open). */
	readonly obstacleRemaining: number;
	/** Edge the open obstacle block intrudes from. */
	readonly obstacleEdge: Obstacle["edge"];
	/** Depth of the open obstacle block, px. */
	readonly obstacleDepth: number;
	/** Clear slices still required before another obstacle block may start. */
	readonly clearDebt: number;
	/** Index of the next slice to generate. */
	readonly nextIndex: number;
}

/** A fresh generator positioned before slice 0. Pure. */
export function initTunnelGen(seed: string, config: Config): TunnelGen {
	return {
		rng: hashSeed(seed),
		centre: config.world.height / 2,
		target: config.world.height / 2,
		prevGap: rampGap(config, 0),
		prevBand: -1,
		obstacleRemaining: 0,
		obstacleEdge: "top",
		obstacleDepth: 0,
		clearDebt: 0,
		nextIndex: 0,
	};
}

/**
 * Generate the slices from `gen.nextIndex` up to (not including) `toIndex`,
 * returning them alongside the advanced generator. A no-op if already past
 * `toIndex`. Pure.
 */
export function extendTunnel(
	gen: TunnelGen,
	config: Config,
	toIndex: number,
): { slices: Slice[]; gen: TunnelGen } {
	const worldHeight = config.world.height;
	const graceDistance = config.ramp.graceDistance;
	const { sliceWidth, clearance, obstacleInterval, obstacleMinSlices, obstacleMaxSlices } =
		config.tunnel;
	const heliHeight = config.helicopter.height;

	let {
		rng,
		centre,
		target,
		prevGap,
		prevBand,
		obstacleRemaining,
		obstacleEdge,
		obstacleDepth,
		clearDebt,
	} = gen;
	const slices: Slice[] = [];

	for (let i = gen.nextIndex; i < toIndex; i++) {
		const distance = sliceDistance(config, i);
		const gap = rampGap(config, distance);
		const lo = gap / 2;
		const hi = worldHeight - gap / 2;

		// The corridor centre is held fixed for the whole span of an open block, so
		// the block carries no corridor wander and reads as a level-edged rectangle
		// (the ramp still narrows the gap by its usual sub-pixel-per-slice amount).
		const inBlock = obstacleRemaining > 0;
		if (inBlock) {
			// centre held.
		} else if (distance < graceDistance) {
			centre = worldHeight / 2;
		} else {
			// Room left in the edge-step budget (a fraction of what the craft can
			// cover, leaving reaction headroom) after the ramp's own gap change.
			const reachable = config.tunnel.followFactor * maxEdgeStep(config, distance);
			const budget = Math.max(0, reachable - Math.abs(gap - prevGap) / 2);
			if (Math.abs(target - centre) <= budget) {
				const [r, next] = nextRandom(rng);
				rng = next;
				target = lo + r * (hi - lo);
			}
			centre = clampTo(centre + clampTo(target - centre, -budget, budget), lo, hi);
		}

		// Obstacles past the grace distance: one block per `obstacleInterval`-wide
		// band, spanning several slices from a single edge at one depth. Band 0 is
		// left clear so the run has an obstacle-free stretch to settle into after
		// the grace corridor. Distinct blocks are always parted by a clear slice.
		let obstacle: Obstacle | null = null;
		if (obstacleRemaining > 0) {
			obstacle = { edge: obstacleEdge, depth: obstacleDepth };
			obstacleRemaining -= 1;
			if (obstacleRemaining === 0) clearDebt = 1;
		} else if (clearDebt > 0) {
			clearDebt -= 1;
		} else {
			const band = Math.floor((distance - graceDistance) / obstacleInterval);
			if (band >= 1 && band !== prevBand) {
				prevBand = band;
				const [spanR, afterSpan] = nextRandom(rng);
				rng = afterSpan;
				const span =
					obstacleMinSlices + Math.floor(spanR * (obstacleMaxSlices - obstacleMinSlices + 1));
				// One depth for the whole block: size it against the narrowest raw gap
				// the span reaches (its trailing edge, where the ramp has narrowed
				// most) so the opening clears the helicopter on every slice.
				const spanEndGap = rampGap(config, distance + (span - 1) * sliceWidth);
				const maxDepth = spanEndGap - (heliHeight + clearance);
				if (maxDepth > 0) {
					const [side, afterSide] = nextRandom(rng);
					const [size, afterSize] = nextRandom(afterSide);
					rng = afterSize;
					obstacleEdge = side < 0.5 ? "top" : "bottom";
					obstacleDepth = maxDepth * (0.4 + 0.6 * size);
					obstacle = { edge: obstacleEdge, depth: obstacleDepth };
					obstacleRemaining = span - 1;
					if (obstacleRemaining === 0) clearDebt = 1;
				}
			}
		}

		slices.push({ top: centre - gap / 2, bottom: centre + gap / 2, obstacle });
		prevGap = gap;
	}

	return {
		slices,
		gen: {
			rng,
			centre,
			target,
			prevGap,
			prevBand,
			obstacleRemaining,
			obstacleEdge,
			obstacleDepth,
			clearDebt,
			nextIndex: Math.max(gen.nextIndex, toIndex),
		},
	};
}

/** The first `sliceCount` slices of the tunnel for `seed`. Pure. */
export function generateTunnel(seed: string, config: Config, sliceCount: number): Slice[] {
	return extendTunnel(initTunnelGen(seed, config), config, sliceCount).slices;
}

function clampTo(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}
