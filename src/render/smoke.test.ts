import { describe, expect, it } from "vitest";
import { createInitialState, defaultConfig, step } from "../sim/index.js";
import { advanceSmokeTrail, type SmokePuff } from "./smoke.js";

describe("smoke trail lifecycle", () => {
	it("records the flight path and discards expired puffs", () => {
		let state = step(createInitialState("smoke", defaultConfig), true);
		let smoke: readonly SmokePuff[] = [];
		for (let tick = 0; tick < 240; tick++) {
			const targetY = defaultConfig.world.height / 2 + 20 * Math.sin(state.tick / 30);
			state = step(state, state.helicopter.vy + 3 * (state.helicopter.y - targetY) > 0);
			smoke = advanceSmokeTrail(smoke, state);
		}
		expect(state.phase).toBe("flying");
		expect(smoke.length).toBeGreaterThan(0);
		expect(smoke.length).toBeLessThanOrEqual(9);
		expect(smoke[0]?.tick).toBeGreaterThan(168);
		expect(new Set(smoke.map((puff) => puff.y)).size).toBeGreaterThan(1);
		expect(smoke.at(-1)).toEqual({
			tick: state.tick,
			distance: state.distance,
			y: state.helicopter.y,
		});
	});

	it("preserves the trail after a crash and clears it on retry or attract", () => {
		let state = step(createInitialState("smoke", defaultConfig), true);
		let smoke: readonly SmokePuff[] = [];
		while (state.phase === "flying") {
			state = step(state, false);
			smoke = advanceSmokeTrail(smoke, state);
		}
		expect(smoke.length).toBeGreaterThan(0);
		expect(advanceSmokeTrail(smoke, step(state, false))).toBe(smoke);
		while (state.restartLock > 0) state = step(state, false);
		const retry = step(state, true);
		expect(retry.phase).toBe("flying");
		expect(advanceSmokeTrail(smoke, retry)).toEqual([]);
		expect(advanceSmokeTrail(smoke, createInitialState("smoke", defaultConfig))).toEqual([]);
	});
});
