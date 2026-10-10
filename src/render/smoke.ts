import type { SimState } from "../sim/index.js";

export interface SmokePuff {
	readonly tick: number;
	readonly distance: number;
	readonly y: number;
}

export const SMOKE_LIFETIME_SECONDS = 0.6;

/** Shell-owned visual history, sampled once per sim tick; never changes gameplay. */
export function advanceSmokeTrail(
	puffs: readonly SmokePuff[],
	state: SimState,
): readonly SmokePuff[] {
	if (state.phase === "attract" || state.tick === 0) return [];
	if (state.phase === "wrecked") return puffs;

	const lifetimeTicks = SMOKE_LIFETIME_SECONDS * state.config.tickHz;
	const next = puffs.filter((puff) => state.tick - puff.tick < lifetimeTicks);
	const interval = Math.max(1, Math.round(state.config.tickHz / 15));
	if (state.tick % interval === 0) {
		next.push({ tick: state.tick, distance: state.distance, y: state.helicopter.y });
	}
	return next;
}
