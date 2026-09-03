/**
 * Collision between the helicopter and the tunnel. The helicopter holds a fixed
 * horizontal screen position; `distance` is how far the run has scrolled, so the
 * tunnel x-coordinate under the helicopter is `distance + helicopter.xFrac *
 * world.width`. A crash is contact with either tunnel edge or an obstacle face.
 */

import type { Config } from "./config.js";
import type { Helicopter } from "./index.js";
import type { Slice } from "./tunnel.js";

/** Half-open range of tunnel slice indices the helicopter's body overlaps. */
export function heliSliceRange(config: Config, distance: number): { first: number; last: number } {
	const heliX = config.helicopter.xFrac * config.world.width;
	const halfWidth = config.helicopter.width / 2;
	const { sliceWidth } = config.tunnel;
	return {
		first: Math.floor((distance + heliX - halfWidth) / sliceWidth),
		last: Math.floor((distance + heliX + halfWidth) / sliceWidth),
	};
}

/**
 * Whether the helicopter at `distance` is in contact with any tunnel geometry.
 * Slices not yet generated are treated as open (the caller generates ahead of
 * the helicopter).
 */
export function crashes(
	config: Config,
	helicopter: Helicopter,
	tunnel: readonly Slice[],
	distance: number,
): boolean {
	const half = config.helicopter.height / 2;
	const top = helicopter.y - half;
	const bottom = helicopter.y + half;
	const { first, last } = heliSliceRange(config, distance);

	for (let i = first; i <= last; i++) {
		const slice = tunnel[i];
		if (!slice) continue;
		if (top < slice.top || bottom > slice.bottom) return true;
		if (slice.obstacle) {
			const { edge, depth } = slice.obstacle;
			if (edge === "top" && top < slice.top + depth) return true;
			if (edge === "bottom" && bottom > slice.bottom - depth) return true;
		}
	}
	return false;
}
