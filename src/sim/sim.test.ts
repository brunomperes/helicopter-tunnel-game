import { describe, expect, it } from "vitest";
import { createInitialState, defaultConfig, type SimState, step } from "./index.js";
import { hashSeed, nextRandom } from "./rng.js";

/** Run the sim from a fresh state through a scripted sequence of thrust inputs. */
function run(seed: string, thrusts: boolean[]): SimState {
	let state = createInitialState(seed, defaultConfig);
	for (const held of thrusts) state = step(state, held);
	return state;
}

/** Start a run and step (holding `thrust`) until it leaves the `flying` phase. */
function flyUntilCrash(seed: string, thrust = false): SimState {
	let state = step(createInitialState(seed, defaultConfig), true);
	for (let guard = 0; state.phase === "flying" && guard < 100_000; guard++) {
		state = step(state, thrust);
	}
	return state;
}

describe("rng", () => {
	it("hashSeed is deterministic and differs by seed", () => {
		expect(hashSeed("alpha")).toBe(hashSeed("alpha"));
		expect(hashSeed("alpha")).not.toBe(hashSeed("beta"));
	});

	it("nextRandom yields values in [0, 1) and a reproducible stream", () => {
		let s = hashSeed("stream");
		const first: number[] = [];
		for (let i = 0; i < 5; i++) {
			const [v, next] = nextRandom(s);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
			first.push(v);
			s = next;
		}
		let s2 = hashSeed("stream");
		for (const expected of first) {
			const [v, next] = nextRandom(s2);
			expect(v).toBe(expected);
			s2 = next;
		}
	});
});

describe("sim lifecycle", () => {
	it("starts in attract and idles the demo scroll without a helicopter sim", () => {
		const state = run("seed", [false, false, false]);
		expect(state.phase).toBe("attract");
		expect(state.distance).toBeGreaterThan(0);
		expect(state.helicopter.vy).toBe(0);
	});

	it("a thrust press in attract starts a run", () => {
		const state = run("seed", [false, true]);
		expect(state.phase).toBe("flying");
		expect(state.tick).toBe(0);
		expect(state.distance).toBe(0);
	});

	it("is deterministic for a given seed and input sequence", () => {
		const inputs = Array.from({ length: 400 }, (_, i) => i % 7 < 3);
		expect(run("race", inputs)).toEqual(run("race", inputs));
	});

	it("falls and eventually crashes when never thrusting", () => {
		const state = flyUntilCrash("seed");
		expect(state.phase).toBe("wrecked");
		expect(state.distance).toBeGreaterThan(0);
		expect(state.restartLock).toBe(defaultConfig.restartLockTicks);
	});

	it("holds altitude better while thrusting than while falling", () => {
		const falling = run("seed", [false, true, ...Array(60).fill(false)]);
		const thrusting = run("seed", [false, true, ...Array(60).fill(true)]);
		expect(thrusting.helicopter.y).toBeLessThan(falling.helicopter.y);
	});

	it("locks restart briefly after a crash, then allows it", () => {
		const crashed = flyUntilCrash("seed");
		expect(crashed.phase).toBe("wrecked");

		// A tap inside the lock window is ignored.
		const tappedEarly = step(step(crashed, false), true);
		expect(tappedEarly.phase).toBe("wrecked");

		// Wait out the lock, then a tap starts a fresh run.
		let state = crashed;
		for (let i = 0; i < defaultConfig.restartLockTicks; i++) state = step(state, false);
		state = step(state, true);
		expect(state.phase).toBe("flying");
		expect(state.tick).toBe(0);
	});
});
