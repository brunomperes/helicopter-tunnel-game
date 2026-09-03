/**
 * Deterministic tunnel generation. Given a seed the generator produces a fixed
 * sequence of `Slice`s, each a `config.tunnel.sliceWidth`-wide vertical segment
 * indexed by distance. Generation enforces the ADR-0003 solvability invariants,
 * so every tunnel it can produce is completable by a perfect player.
 */

import type { Config } from "./config.js";
import { rampGap, rampSpeed } from "./ramp.js";

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
	const centre = config.world.height / 2;
	const slices: Slice[] = [];
	for (let i = 0; i < sliceCount; i++) {
		const gap = rampGap(config, sliceDistance(config, i));
		slices.push({ top: centre - gap / 2, bottom: centre + gap / 2, obstacle: null });
	}
	return slices;
}
