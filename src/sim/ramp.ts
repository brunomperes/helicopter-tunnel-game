/**
 * The difficulty ramp: scroll speed and tunnel gap as pure functions of distance
 * travelled. Both hold their start value through the grace distance, then ease
 * linearly to their cap across `ramp.distance`, then hold at the cap. See
 * `CONTEXT.md` ("Ramp") and ADR-0003.
 */

import type { Config } from "./config.js";

/** Scroll speed, px/s, after the ramp for a run that has travelled `distance` px. */
export function rampSpeed(config: Config, distance: number): number {
	const { startSpeed, capSpeed } = config.scroll;
	return startSpeed + (capSpeed - startSpeed) * rampProgress(config, distance);
}

/** Tunnel gap, px, after the ramp for a run that has travelled `distance` px. */
export function rampGap(config: Config, distance: number): number {
	const { startGap, capGap } = config.tunnel;
	return startGap + (capGap - startGap) * rampProgress(config, distance);
}

/** Fraction (0..1) of the way from start values to cap values at `distance`. */
function rampProgress(config: Config, distance: number): number {
	const { distance: span, graceDistance } = config.ramp;
	const t = (distance - graceDistance) / span;
	return t < 0 ? 0 : t > 1 ? 1 : t;
}
