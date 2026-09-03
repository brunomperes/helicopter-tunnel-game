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
import {
	extendTunnel,
	generateTunnel,
	initTunnelGen,
	maxEdgeStep,
	type Slice,
	sliceDistance,
} from "./tunnel.js";

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

/** Maximal runs of consecutive obstacle-bearing slices (one run per obstacle). */
function obstacleGroups(slices: readonly Slice[]) {
	const groups: Array<{ start: number; end: number; length: number; slices: Slice[] }> = [];
	let i = 0;
	while (i < slices.length) {
		if (!slices[i]?.obstacle) {
			i++;
			continue;
		}
		const start = i;
		const runSlices: Slice[] = [];
		while (i < slices.length && slices[i]?.obstacle) {
			const s = slices[i];
			if (s) runSlices.push(s);
			i++;
		}
		groups.push({ start, end: i - 1, length: runSlices.length, slices: runSlices });
	}
	return groups;
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

	it("eases scroll speed to the cap across the stretched speed ramp, then holds it", () => {
		const speedSpan = c.ramp.distance * c.ramp.speedDistanceScale;
		const midpoint = c.ramp.graceDistance + speedSpan / 2;
		const expectedMid = (c.scroll.startSpeed + c.scroll.capSpeed) / 2;
		expect(rampSpeed(c, midpoint)).toBeCloseTo(expectedMid, 6);

		const rampEnd = c.ramp.graceDistance + speedSpan;
		expect(rampSpeed(c, rampEnd)).toBe(c.scroll.capSpeed);
		expect(rampSpeed(c, rampEnd * 10)).toBe(c.scroll.capSpeed);
	});

	it("eases speed in more gradually than the gap", () => {
		const gapEnd = c.ramp.graceDistance + c.ramp.distance;
		// Gap has reached its cap here; speed has not.
		expect(rampGap(c, gapEnd)).toBe(c.tunnel.capGap);
		expect(rampSpeed(c, gapEnd)).toBeLessThan(c.scroll.capSpeed);
	});

	it("narrows the gap from start to cap across ramp.distance", () => {
		expect(rampGap(c, 0)).toBe(c.tunnel.startGap);
		expect(rampGap(c, c.ramp.graceDistance)).toBe(c.tunnel.startGap);

		const midpoint = c.ramp.graceDistance + c.ramp.distance / 2;
		expect(rampGap(c, midpoint)).toBeCloseTo((c.tunnel.startGap + c.tunnel.capGap) / 2, 6);

		const rampEnd = c.ramp.graceDistance + c.ramp.distance;
		expect(rampGap(c, rampEnd)).toBe(c.tunnel.capGap);
		expect(rampGap(c, rampEnd * 10)).toBe(c.tunnel.capGap);
	});

	it("scrolls faster later in a run than at its start", () => {
		const flying: SimState = { ...createInitialState("seed", c), phase: "flying" };
		const earlyDelta = step(flying, false).distance - flying.distance;

		const late: SimState = {
			...flying,
			distance: c.ramp.graceDistance + c.ramp.distance * c.ramp.speedDistanceScale,
		};
		const lateDelta = step(late, false).distance - late.distance;

		expect(lateDelta / earlyDelta).toBeCloseTo(c.scroll.capSpeed / c.scroll.startSpeed, 4);
	});
});

describe("tunnel generation", () => {
	const c = defaultConfig;
	const seeds = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
	const graceSlices = Math.ceil(c.ramp.graceDistance / c.tunnel.sliceWidth);

	/** Effective vertical opening of a slice after any obstacle. */
	const opening = (s: Slice) => s.bottom - s.top - (s.obstacle?.depth ?? 0);
	/** Adjacent `[index, prev, curr]` triples over a slice list. */
	function adjacent(slices: readonly Slice[]): Array<[number, Slice, Slice]> {
		const out: Array<[number, Slice, Slice]> = [];
		for (let i = 1; i < slices.length; i++) {
			const prev = slices[i - 1];
			const curr = slices[i];
			if (prev && curr) out.push([i, prev, curr]);
		}
		return out;
	}
	it("opens with a centred, full-gap corridor and no obstacles through the grace distance", () => {
		for (const s of generateTunnel("alpha", c, graceSlices)) {
			expect(s.obstacle).toBeNull();
			expect(s.bottom - s.top).toBeCloseTo(c.tunnel.startGap, 6);
			expect((s.top + s.bottom) / 2).toBeCloseTo(c.world.height / 2, 6);
		}
	});

	it("narrows the raw gap toward the cap once past the grace distance", () => {
		const slices = generateTunnel(
			"beta",
			c,
			graceSlices + Math.ceil(c.ramp.distance / c.tunnel.sliceWidth) + 200,
		);
		const midRamp = slices[graceSlices + Math.floor(c.ramp.distance / c.tunnel.sliceWidth / 2)];
		const last = slices.at(-1);
		if (!midRamp || !last) throw new Error("too few slices");
		expect(midRamp.bottom - midRamp.top).toBeCloseTo((c.tunnel.startGap + c.tunnel.capGap) / 2, 4);
		expect(last.bottom - last.top).toBeCloseTo(c.tunnel.capGap, 6);
	});

	it("bounds the per-slice edge step by the vertical distance the helicopter can cover", () => {
		// Slice-scroll time T = sliceWidth / speed; reachable distance from rest is
		// 0.5 * min(thrust - gravity, gravity) * T^2, capped by terminalVelocity * T.
		const reach = (speed: number) => {
			const t = c.tunnel.sliceWidth / speed;
			const accel = Math.min(c.physics.thrust - c.physics.gravity, c.physics.gravity);
			return Math.min(0.5 * accel * t * t, c.physics.terminalVelocity * t);
		};
		expect(maxEdgeStep(c, 0)).toBeCloseTo(reach(c.scroll.startSpeed), 6);

		const speedRampEnd = c.ramp.graceDistance + c.ramp.distance * c.ramp.speedDistanceScale;
		const atCap = maxEdgeStep(c, speedRampEnd);
		expect(atCap).toBeCloseTo(reach(c.scroll.capSpeed), 6);
		// Faster scroll later in the run means a tighter bound.
		expect(atCap).toBeLessThan(maxEdgeStep(c, 0));
	});

	it("moves each edge between adjacent slices by less than the craft can cover, for many seeds", () => {
		for (const seed of seeds) {
			for (const [i, prev, curr] of adjacent(generateTunnel(seed, c, 6000))) {
				const reachable = maxEdgeStep(c, sliceDistance(c, i));
				// Clamped to followFactor of what the helicopter can physically cover,
				// leaving the player reaction headroom (ADR-0003 "clamped below").
				const limit = c.tunnel.followFactor * reachable + 1e-9;
				expect(Math.abs(curr.top - prev.top)).toBeLessThanOrEqual(limit);
				expect(Math.abs(curr.bottom - prev.bottom)).toBeLessThanOrEqual(limit);
				expect(limit).toBeLessThan(reachable);
			}
		}
	});

	it("keeps both edges inside the world, for many seeds", () => {
		for (const seed of seeds) {
			for (const s of generateTunnel(seed, c, 6000)) {
				expect(s.top).toBeGreaterThanOrEqual(0);
				expect(s.bottom).toBeLessThanOrEqual(c.world.height);
			}
		}
	});

	it("wanders the corridor vertically after the grace distance", () => {
		const centres = generateTunnel("alpha", c, 6000)
			.slice(graceSlices + 10)
			.map((s) => (s.top + s.bottom) / 2);
		expect(Math.max(...centres) - Math.min(...centres)).toBeGreaterThan(80);
	});

	it("places obstacle blocks only past the grace distance, each parted by a clear slice", () => {
		for (const seed of seeds) {
			const groups = obstacleGroups(generateTunnel(seed, c, 8000));
			expect(groups.length).toBeGreaterThan(10);
			for (const g of groups) {
				expect(sliceDistance(c, g.start)).toBeGreaterThanOrEqual(c.ramp.graceDistance);
			}
			for (let k = 1; k < groups.length; k++) {
				const clearSlices = (groups[k]?.start ?? 0) - (groups[k - 1]?.end ?? 0) - 1;
				expect(clearSlices).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it("makes each obstacle a block of slices sharing one edge and one depth", () => {
		for (const seed of seeds) {
			const slices = generateTunnel(seed, c, 8000);
			// Drop a block still being generated at the very end of the range.
			const groups = obstacleGroups(slices).filter((g) => g.end < slices.length - 1);
			expect(groups.length).toBeGreaterThan(5);
			for (const g of groups) {
				expect(g.length).toBeGreaterThanOrEqual(c.tunnel.obstacleMinSlices);
				expect(g.length).toBeLessThanOrEqual(c.tunnel.obstacleMaxSlices);
				const edges = new Set(g.slices.map((s) => s.obstacle?.edge));
				expect(edges.size).toBe(1);
				const depth0 = g.slices[0]?.obstacle?.depth ?? 0;
				for (const s of g.slices) expect(s.obstacle?.depth ?? 0).toBeCloseTo(depth0, 6);
			}
			// Blocks wider than one slice do occur.
			expect(groups.some((g) => g.length > 1)).toBe(true);
		}
	});

	it("holds the corridor centre fixed across an obstacle block (no wander under a block)", () => {
		for (const seed of seeds) {
			const slices = generateTunnel(seed, c, 8000);
			for (const g of obstacleGroups(slices).filter((x) => x.end < slices.length - 1)) {
				const centre0 = ((g.slices[0]?.top ?? 0) + (g.slices[0]?.bottom ?? 0)) / 2;
				for (const s of g.slices) {
					expect((s.top + s.bottom) / 2).toBeCloseTo(centre0, 6);
				}
				// Edges only move by the ramp's own gap-narrowing over the block —
				// no corridor drift is layered on top.
				const ramp =
					(rampGap(c, sliceDistance(c, g.start)) - rampGap(c, sliceDistance(c, g.end))) / 2;
				const tops = g.slices.map((s) => s.top);
				expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(ramp + 1e-6);
			}
		}
	});

	it("varies obstacle block width within the configured slice range", () => {
		const { obstacleMinSlices, obstacleMaxSlices } = c.tunnel;
		const lengths = new Set<number>();
		for (const seed of seeds) {
			const slices = generateTunnel(seed, c, 8000);
			for (const g of obstacleGroups(slices).filter((x) => x.end < slices.length - 1)) {
				expect(g.length).toBeGreaterThanOrEqual(obstacleMinSlices);
				expect(g.length).toBeLessThanOrEqual(obstacleMaxSlices);
				lengths.add(g.length);
			}
		}
		expect(lengths.size).toBeGreaterThan(1);
	});

	it("keeps the effective opening at least a helicopter plus clearance, for many seeds", () => {
		const floor = c.helicopter.height + c.tunnel.clearance;
		for (const seed of seeds) {
			for (const s of generateTunnel(seed, c, 8000)) {
				expect(opening(s)).toBeGreaterThanOrEqual(floor - 1e-9);
			}
		}
	});

	it("keeps the opening clear through the whole of a mid-ramp obstacle block", () => {
		// Blocks that sit entirely inside the narrowing ramp are where a depth sized
		// off the block's leading (wider) gap would over-cut its trailing slices.
		const floor = c.helicopter.height + c.tunnel.clearance;
		let midRampBlocks = 0;
		for (const seed of seeds) {
			const slices = generateTunnel(seed, c, 8000);
			for (const g of obstacleGroups(slices).filter((x) => x.end < slices.length - 1)) {
				const startD = sliceDistance(c, g.start);
				const endD = sliceDistance(c, g.end);
				if (startD <= c.ramp.graceDistance || endD >= c.ramp.graceDistance + c.ramp.distance) {
					continue;
				}
				midRampBlocks++;
				for (const s of g.slices) expect(opening(s)).toBeGreaterThanOrEqual(floor - 1e-9);
			}
		}
		expect(midRampBlocks).toBeGreaterThan(20);
	});

	it("spaces successive obstacle blocks by about one obstacleInterval", () => {
		const groups = obstacleGroups(generateTunnel("alpha", c, 8000));
		for (let k = 1; k < groups.length; k++) {
			const spacing =
				sliceDistance(c, groups[k]?.start ?? 0) - sliceDistance(c, groups[k - 1]?.start ?? 0);
			expect(spacing).toBeGreaterThanOrEqual(c.tunnel.obstacleInterval - c.tunnel.sliceWidth);
			expect(spacing).toBeLessThanOrEqual(2 * c.tunnel.obstacleInterval);
		}
	});

	it("is fully determined by the seed", () => {
		expect(generateTunnel("alpha", c, 2000)).toEqual(generateTunnel("alpha", c, 2000));
		expect(generateTunnel("alpha", c, 2000)).not.toEqual(generateTunnel("beta", c, 2000));
	});

	it("is a stable prefix: generating more slices does not change the earlier ones", () => {
		const short = generateTunnel("gamma", c, 1500);
		const long = generateTunnel("gamma", c, 4000);
		expect(long.slice(0, 1500)).toEqual(short);
	});

	it("extends incrementally to the same tunnel as one-shot generation", () => {
		const oneShot = generateTunnel("delta", c, 900);
		let gen = initTunnelGen("delta", c);
		const pieces: Slice[] = [];
		for (const to of [100, 250, 251, 600, 900]) {
			const r = extendTunnel(gen, c, to);
			pieces.push(...r.slices);
			gen = r.gen;
		}
		expect(pieces).toEqual(oneShot);
	});

	it("resumes an obstacle block that straddles an extendTunnel boundary", () => {
		const seed = "epsilon";
		const oneShot = generateTunnel(seed, c, 2000);
		const blocks = obstacleGroups(oneShot).filter((g) => g.length >= 3 && g.end < 1999);
		expect(blocks.length).toBeGreaterThan(3);
		for (const b of blocks.slice(0, 6)) {
			// Cut generation one slice into the block, then finish it.
			const cut = b.start + 1;
			const first = extendTunnel(initTunnelGen(seed, c), c, cut);
			const rest = extendTunnel(first.gen, c, 2000);
			expect([...first.slices, ...rest.slices]).toEqual(oneShot);
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

	it("keeps generating tunnel as the attract-mode demo scroll runs past the initial lookahead", () => {
		const c = defaultConfig;
		// ~5 screen-widths of idle scroll; the initial tunnel only covers ~1.2.
		const state = run(
			"seed",
			Array.from({ length: 2400 }, () => false),
		);
		expect(state.phase).toBe("attract");
		expect(state.distance).toBeGreaterThan(4 * c.world.width);

		const firstVisible = Math.floor(state.distance / c.tunnel.sliceWidth);
		const lastVisible = Math.floor((state.distance + c.world.width) / c.tunnel.sliceWidth);
		for (let i = firstVisible; i <= lastVisible; i++) {
			expect(state.tunnel[i]).toBeDefined();
		}
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

	it("crashes into the tunnel floor edge, well above the world floor, when never thrusting", () => {
		const c = defaultConfig;
		const crashed = flyUntilCrash("alpha");
		const half = c.helicopter.height / 2;
		// The grace corridor's floor edge sits at worldHeight/2 + startGap/2 = 430,
		// a full 100px above the 540 world floor the stub used.
		const graceFloor = c.world.height / 2 + c.tunnel.startGap / 2;
		expect(crashed.phase).toBe("wrecked");
		expect(crashed.helicopter.y + half).toBeGreaterThan(graceFloor - c.tunnel.sliceWidth);
		expect(crashed.helicopter.y + half).toBeLessThan(c.world.height - 20);
	});

	it("does not crash inside the centred, obstacle-free grace corridor while roughly hovering", () => {
		// Pulsing thrust every other tick keeps the helicopter within a few px of
		// the centre. The grace corridor (gap 320, centred, no obstacles) is wide
		// enough that this never crashes before the ramp begins.
		const c = defaultConfig;
		let state = step(createInitialState("alpha", c), true);
		for (let i = 0; state.distance < c.ramp.graceDistance - 20 && state.phase === "flying"; i++) {
			state = step(state, i % 2 === 0);
		}
		expect(state.phase).toBe("flying");
		expect(state.distance).toBeGreaterThan(c.ramp.graceDistance - 30);
	});

	it("crashes into the tunnel ceiling edge when thrust is held continuously", () => {
		const c = defaultConfig;
		const crashed = flyUntilCrash("alpha", true);
		const half = c.helicopter.height / 2;
		const graceCeil = c.world.height / 2 - c.tunnel.startGap / 2;
		expect(crashed.phase).toBe("wrecked");
		expect(crashed.helicopter.y - half).toBeGreaterThanOrEqual(0);
		expect(crashed.helicopter.y - half).toBeLessThan(graceCeil + c.tunnel.sliceWidth);
	});

	it("keeps the generated tunnel at least a screen ahead of the helicopter", () => {
		const c = defaultConfig;
		let state = step(createInitialState("alpha", c), true);
		for (let i = 0; i < 500 && state.phase === "flying"; i++) state = step(state, i % 3 === 0);
		const heliLead = state.distance + c.helicopter.xFrac * c.world.width;
		const generatedTo = state.tunnel.length * c.tunnel.sliceWidth;
		expect(generatedTo).toBeGreaterThan(heliLead + c.world.width);
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

	/** A `flying` state parked so the helicopter overlaps tunnel slice `atIndex`. */
	function flyingOverSlice(
		seed: string,
		slices: readonly Slice[],
		gen: Parameters<typeof step>[0]["tunnelGen"],
		atIndex: number,
		helicopter: { y: number; vy: number },
	): SimState {
		const c = defaultConfig;
		const heliX = c.helicopter.xFrac * c.world.width;
		return {
			...createInitialState(seed, c),
			phase: "flying",
			distance: atIndex * c.tunnel.sliceWidth + c.tunnel.sliceWidth / 2 - heliX,
			tunnel: slices,
			tunnelGen: gen,
			helicopter,
			prevThrust: true,
		};
	}

	it("crashes into the body of a wide obstacle block, not only its leading slice", () => {
		const c = defaultConfig;
		const built = extendTunnel(initTunnelGen("zeta", c), c, 3000);
		const blocks = obstacleGroups(built.slices).filter((g) => g.length >= 4 && g.end < 2500);
		expect(blocks.length).toBeGreaterThan(3);
		for (const b of blocks.slice(0, 5)) {
			// An interior slice: the helicopter here overlaps only slices b.start+1..
			// b.start+3, all past the block's leading edge.
			const m = b.start + 2;
			const slice = built.slices[m];
			if (!slice?.obstacle) throw new Error("expected an obstacle slice");
			const depth = slice.obstacle.depth;
			const y = slice.obstacle.edge === "top" ? slice.top + depth - 1 : slice.bottom - depth + 1;
			const state = flyingOverSlice("zeta", built.slices, built.gen, m, { y, vy: 0 });
			expect(step(state, false).phase).toBe("wrecked");
		}
	});

	it("lets the helicopter fly the length of a wide obstacle block through its clear opening", () => {
		const c = defaultConfig;
		let found:
			| { built: ReturnType<typeof extendTunnel>; block: ReturnType<typeof obstacleGroups>[number] }
			| undefined;
		for (const seed of ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"]) {
			const built = extendTunnel(initTunnelGen(seed, c), c, 3000);
			const block = obstacleGroups(built.slices).find(
				(g) => g.length >= 5 && g.start > 60 && g.end < 1800,
			);
			if (block) {
				found = { built, block };
				break;
			}
		}
		if (!found) throw new Error("no suitable obstacle block found");
		const { built, block } = found;
		const lead = built.slices[block.start];
		if (!lead?.obstacle) throw new Error("expected an obstacle slice");
		const depth = lead.obstacle.depth;
		const openingCentre =
			lead.obstacle.edge === "top"
				? (lead.top + depth + lead.bottom) / 2
				: (lead.top + (lead.bottom - depth)) / 2;

		let state = flyingOverSlice("_", built.slices, built.gen, block.start, {
			y: openingCentre,
			vy: 0,
		});
		const heliX = c.helicopter.xFrac * c.world.width;
		// The helicopter's trailing edge has cleared the block's last slice.
		const cleared = (d: number) =>
			d + heliX + c.helicopter.width / 2 > (block.end + 1) * c.tunnel.sliceWidth;
		let i = 0;
		for (; i < 5000 && state.phase === "flying" && !cleared(state.distance); i++) {
			// Crude hold: thrust when below the opening centre (y-down), else coast.
			state = step(state, state.helicopter.y > openingCentre);
		}
		expect(state.phase).toBe("flying");
		expect(cleared(state.distance)).toBe(true);
	});
});
