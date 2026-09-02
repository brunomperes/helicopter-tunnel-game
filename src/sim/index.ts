/**
 * The pure simulation core. No DOM, no `Math.random`, no wall-clock. A run is a
 * deterministic function of `(seed, sequence of thrustHeld booleans)`. See
 * ADR-0002.
 *
 * SCAFFOLD STATUS: phases, transitions and helicopter physics are wired.
 * Tunnel generation, the difficulty ramp and real collision are stubbed with a
 * `TODO` and will be built test-first (see docs/adr/0003 for the invariants).
 */

import type { Config } from "./config.js";
import { hashSeed } from "./rng.js";

export type { Config } from "./config.js";
export { defaultConfig } from "./config.js";

export type Phase = "attract" | "flying" | "wrecked";

export interface Helicopter {
	/** Vertical position of the helicopter's centre, px, y-down. */
	readonly y: number;
	/** Vertical velocity, px/s. */
	readonly vy: number;
}

export interface SimState {
	readonly config: Config;
	readonly seed: string;
	readonly phase: Phase;
	/** mulberry32 generator state. */
	readonly rng: number;
	/** Elapsed simulation ticks in the current run. */
	readonly tick: number;
	/** Distance travelled through the tunnel this run, px (float). */
	readonly distance: number;
	readonly helicopter: Helicopter;
	/** Thrust state on the previous tick, for press-edge detection. */
	readonly prevThrust: boolean;
	/** Ticks remaining before input can leave the `wrecked` phase. */
	readonly restartLock: number;
}

export function createInitialState(seed: string, config: Config): SimState {
	return {
		config,
		seed,
		phase: "attract",
		rng: hashSeed(seed),
		tick: 0,
		distance: 0,
		helicopter: { y: config.world.height / 2, vy: 0 },
		prevThrust: false,
		restartLock: 0,
	};
}

/** Advance the simulation by exactly one fixed tick. Pure. */
export function step(state: SimState, thrustHeld: boolean): SimState {
	const pressed = thrustHeld && !state.prevThrust;
	const base = { ...state, prevThrust: thrustHeld };

	switch (state.phase) {
		case "attract":
			return pressed ? startRun(base) : scrollDemo(base);
		case "flying":
			return advanceRun(base, thrustHeld);
		case "wrecked": {
			const restartLock = Math.max(0, state.restartLock - 1);
			if (pressed && restartLock === 0) return startRun(base);
			return { ...base, restartLock };
		}
	}
}

function startRun(state: SimState): SimState {
	const fresh = createInitialState(state.seed, state.config);
	return { ...fresh, phase: "flying", prevThrust: true };
}

/** Attract-mode idle scroll: keeps the background alive, no helicopter sim. */
function scrollDemo(state: SimState): SimState {
	const dt = 1 / state.config.tickHz;
	return {
		...state,
		tick: state.tick + 1,
		distance: state.distance + state.config.scroll.startSpeed * dt,
	};
}

function advanceRun(state: SimState, thrustHeld: boolean): SimState {
	const { tickHz, physics, world } = state.config;
	const dt = 1 / tickHz;

	const accel = physics.gravity + (thrustHeld ? -physics.thrust : 0);
	const vy = clamp(
		state.helicopter.vy + accel * dt,
		-physics.terminalVelocity,
		physics.terminalVelocity,
	);
	const y = state.helicopter.y + vy * dt;

	const next: SimState = {
		...state,
		tick: state.tick + 1,
		distance: state.distance + scrollSpeed(state) * dt,
		helicopter: { y, vy },
	};

	// TODO: replace this world-bounds check with real collision against the
	// generated tunnel edges and obstacles (docs/adr/0003).
	const half = state.config.helicopter.height / 2;
	if (y - half < 0 || y + half > world.height) {
		return { ...next, phase: "wrecked", restartLock: state.config.restartLockTicks };
	}
	return next;
}

/** Current scroll speed after the difficulty ramp. */
function scrollSpeed(state: SimState): number {
	// TODO: ease from startSpeed to capSpeed across `ramp.distance` once the
	// grace zone is passed. Flat for now.
	return state.config.scroll.startSpeed;
}

function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}
