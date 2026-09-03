import { describe, expect, it } from "vitest";
import {
	createInitialState,
	defaultConfig,
	rampGap,
	rampSpeed,
	type SimState,
	step,
} from "./index.js";
import { hashSeed, nextRandom } from "./rng.js";
import { generateTunnel, maxEdgeStep } from "./tunnel.js";

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

describe("difficulty ramp", () => {
	const c = defaultConfig;

	it("holds the start scroll speed through the grace distance", () => {
		expect(rampSpeed(c, 0)).toBe(c.scroll.startSpeed);
		expect(rampSpeed(c, c.ramp.graceDistance)).toBe(c.scroll.startSpeed);
	});

	it("eases scroll speed to the cap across the ramp, then holds it", () => {
		const midpoint = c.ramp.graceDistance + c.ramp.distance / 2;
		const expectedMid = (c.scroll.startSpeed + c.scroll.capSpeed) / 2;
		expect(rampSpeed(c, midpoint)).toBeCloseTo(expectedMid, 6);

		const rampEnd = c.ramp.graceDistance + c.ramp.distance;
		expect(rampSpeed(c, rampEnd)).toBe(c.scroll.capSpeed);
		expect(rampSpeed(c, rampEnd * 10)).toBe(c.scroll.capSpeed);
	});

	it("narrows the gap from start to cap on the same schedule as speed", () => {
		expect(rampGap(c, 0)).toBe(c.tunnel.startGap);
		expect(rampGap(c, c.ramp.graceDistance)).toBe(c.tunnel.startGap);

		const midpoint = c.ramp.graceDistance + c.ramp.distance / 2;
		expect(rampGap(c, midpoint)).toBeCloseTo(
			(c.tunnel.startGap + c.tunnel.capGap) / 2,
			6,
		);

		const rampEnd = c.ramp.graceDistance + c.ramp.distance;
		expect(rampGap(c, rampEnd)).toBe(c.tunnel.capGap);
		expect(rampGap(c, rampEnd * 10)).toBe(c.tunnel.capGap);
	});

	it("scrolls faster later in a run than at its start", () => {
		const flying: SimState = { ...createInitialState("seed", c), phase: "flying" };
		const earlyDelta = step(flying, false).distance - flying.distance;

		const late: SimState = { ...flying, distance: c.ramp.graceDistance + c.ramp.distance };
		const lateDelta = step(late, false).distance - late.distance;

		expect(lateDelta / earlyDelta).toBeCloseTo(c.scroll.capSpeed / c.scroll.startSpeed, 4);
	});
});

describe("tunnel generation", () => {
	const c = defaultConfig;
	const seeds = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
	const graceSlices = Math.ceil(c.ramp.graceDistance / c.tunnel.sliceWidth);

	/** Effective vertical opening of a slice after any obstacle. */
	const opening = (s: { top: number; bottom: number; obstacle: { depth: number } | null }) =>
		s.bottom - s.top - (s.obstacle?.depth ?? 0);

	it("opens with a centred, full-gap corridor and no obstacles through the grace distance", () => {
		const slices = generateTunnel("alpha", c, graceSlices);
		for (const s of slices) {
			expect(s.obstacle).toBeNull();
			expect(s.bottom - s.top).toBeCloseTo(c.tunnel.startGap, 6);
			expect((s.top + s.bottom) / 2).toBeCloseTo(c.world.height / 2, 6);
		}
	});

	it("narrows the raw gap toward the cap once past the grace distance", () => {
		const rampEndSlice = Math.ceil(
			(c.ramp.graceDistance + c.ramp.distance) / c.tunnel.sliceWidth,
		);
		const slices = generateTunnel("beta", c, rampEndSlice + 200);
		const midRamp = graceSlices + Math.floor(c.ramp.distance / c.tunnel.sliceWidth / 2);
		expect(slices[midRamp].bottom - slices[midRamp].top).toBeCloseTo(
			(c.tunnel.startGap + c.tunnel.capGap) / 2,
			4,
		);
		const last = slices.at(-1);
		if (!last) throw new Error("no slices");
		expect(last.bottom - last.top).toBeCloseTo(c.tunnel.capGap, 6);
	});

	it("bounds the per-slice edge step by the vertical distance the helicopter can cover", () => {
		// Worked from the default config. Slice-scroll time T = sliceWidth / speed.
		// Reachable distance from rest = 0.5 * min(thrust - gravity, gravity) * T^2,
		// capped by terminalVelocity * T. At speed 180: T = 12/180 = 1/15 s,
		// 0.5 * 900 * (1/15)^2 = 2.0 px (well under the 34.7 px terminal cap).
		expect(maxEdgeStep(c, 0)).toBeCloseTo(2.0, 6);
		// At the cap speed 360: T = 12/360 = 1/30 s, 0.5 * 900 * (1/30)^2 = 0.5 px.
		expect(maxEdgeStep(c, c.ramp.graceDistance + c.ramp.distance)).toBeCloseTo(0.5, 6);
		// Faster scroll later in the run means a tighter bound.
		expect(maxEdgeStep(c, c.ramp.graceDistance + c.ramp.distance)).toBeLessThan(
			maxEdgeStep(c, 0),
		);
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
