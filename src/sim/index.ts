/**
 * The pure simulation core. No DOM, no `Math.random`, no wall-clock. A run is a
 * deterministic function of `(seed, sequence of thrustHeld booleans)`. See
 * ADR-0002.
 *
 * The difficulty ramp, tunnel generation and collision live in sibling modules
 * (`ramp`, `tunnel`, `collision`); `step` composes them. See docs/adr/0003.
 */

import { crashes } from "./collision.js";
import type { Config } from "./config.js";
import { rampSpeed } from "./ramp.js";
import { hashSeed } from "./rng.js";
import { extendTunnel, initTunnelGen, type Slice, type TunnelGen } from "./tunnel.js";

export type { Config } from "./config.js";
export { defaultConfig } from "./config.js";
export { rampGap, rampSpeed } from "./ramp.js";
export type { Slice } from "./tunnel.js";
export { generateTunnel, maxEdgeStep, sliceDistance } from "./tunnel.js";

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
	/**
	 * Whether `seed` is pinned (launched with `?seed=`). When pinned the sim keeps
	 * the same seed for every run in the session; when not, a run-start transition
	 * swaps in the fresh seed the shell passes to `step`.
	 */
	readonly pinned: boolean;
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
	/**
	 * Generated tunnel slices, indexed from run start (slice `i` spans tunnel
	 * distance `[i * sliceWidth, (i + 1) * sliceWidth)`). Grows a screen-width
	 * ahead of the helicopter as the run scrolls.
	 */
	readonly tunnel: readonly Slice[];
	/** Generator walk state, for extending `tunnel`. */
	readonly tunnelGen: TunnelGen;
}

/** Slices to keep generated beyond the helicopter's leading edge (one screen). */
function lookaheadSlices(config: Config): number {
	return Math.ceil(config.world.width / config.tunnel.sliceWidth) + 2;
}

/** Extend `tunnel` so it is generated up to `lookaheadSlices` past `distance`. */
function ensureTunnel(state: SimState): SimState {
	const heliLead =
		state.distance +
		state.config.helicopter.xFrac * state.config.world.width +
		state.config.helicopter.width / 2;
	const toIndex =
		Math.floor(heliLead / state.config.tunnel.sliceWidth) + lookaheadSlices(state.config);
	if (toIndex <= state.tunnelGen.nextIndex) return state;

	const { slices, gen } = extendTunnel(state.tunnelGen, state.config, toIndex);
	return { ...state, tunnel: [...state.tunnel, ...slices], tunnelGen: gen };
}

export function createInitialState(seed: string, config: Config, pinned = false): SimState {
	return ensureTunnel({
		config,
		seed,
		pinned,
		phase: "attract",
		rng: hashSeed(seed),
		tick: 0,
		distance: 0,
		helicopter: { y: config.world.height / 2, vy: 0 },
		prevThrust: false,
		restartLock: 0,
		tunnel: [],
		tunnelGen: initTunnelGen(seed, config),
	});
}

/**
 * Advance the simulation by exactly one fixed tick. Pure.
 *
 * `nextSeed` is a candidate fresh seed supplied by the shell. It is consumed only
 * at a run-start transition, and only when the current seed is not pinned; every
 * other tick ignores it. Omitting it keeps the current seed (used by tests).
 */
export function step(state: SimState, thrustHeld: boolean, nextSeed?: string): SimState {
	const pressed = thrustHeld && !state.prevThrust;
	const base = { ...state, prevThrust: thrustHeld };

	switch (state.phase) {
		case "attract":
			return pressed ? startRun(base, nextSeed) : scrollDemo(base);
		case "flying":
			return advanceRun(base, thrustHeld);
		case "wrecked": {
			const restartLock = Math.max(0, state.restartLock - 1);
			if (pressed && restartLock === 0) return startRun(base, nextSeed);
			return { ...base, restartLock };
		}
	}
}

function startRun(state: SimState, nextSeed?: string): SimState {
	const seed = !state.pinned && nextSeed !== undefined ? nextSeed : state.seed;
	const fresh = createInitialState(seed, state.config, state.pinned);
	return { ...fresh, phase: "flying", prevThrust: true };
}

/** Attract-mode idle scroll: keeps the background alive, no helicopter sim. */
function scrollDemo(state: SimState): SimState {
	const dt = 1 / state.config.tickHz;
	return ensureTunnel({
		...state,
		tick: state.tick + 1,
		distance: state.distance + state.config.scroll.startSpeed * dt,
	});
}

function advanceRun(state: SimState, thrustHeld: boolean): SimState {
	const { tickHz, physics } = state.config;
	const dt = 1 / tickHz;

	const accel = physics.gravity + (thrustHeld ? -physics.thrust : 0);
	const vy = clamp(
		state.helicopter.vy + accel * dt,
		-physics.terminalVelocity,
		physics.terminalVelocity,
	);
	const y = state.helicopter.y + vy * dt;

	const next = ensureTunnel({
		...state,
		tick: state.tick + 1,
		distance: state.distance + scrollSpeed(state) * dt,
		helicopter: { y, vy },
	});

	if (crashes(next.config, next.helicopter, next.tunnel, next.distance)) {
		return { ...next, phase: "wrecked", restartLock: next.config.restartLockTicks };
	}
	return next;
}

/** Current scroll speed after the difficulty ramp. */
function scrollSpeed(state: SimState): number {
	return rampSpeed(state.config, state.distance);
}

function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}
