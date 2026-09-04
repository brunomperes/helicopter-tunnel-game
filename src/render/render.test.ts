import { describe, expect, it } from "vitest";
import { createInitialState, defaultConfig, type SimState, step } from "../sim/index.js";
import { generateTunnel } from "../sim/tunnel.js";
import { type HudModel, render } from "./index.js";

type Rect = [x: number, y: number, w: number, h: number];

/** Context stand-in that records every `fillRect` call. */
function rectRecordingCtx() {
	const rects: Rect[] = [];
	const ctx = {
		fillStyle: "",
		font: "",
		textBaseline: "",
		textAlign: "",
		fillRect(x: number, y: number, w: number, h: number) {
			rects.push([x, y, w, h]);
		},
		fillText() {},
	};
	return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const hasRect = (rects: Rect[], [x, y, w, h]: Rect) =>
	rects.some((r) => near(r[0], x) && near(r[1], y) && near(r[2], w) && near(r[3], h));

/**
 * Minimal 2D-context stand-in that records the text strings passed to
 * `fillText`. Only the members `render` actually touches are implemented.
 */
function recordingCtx() {
	const texts: string[] = [];
	const ctx = {
		fillStyle: "",
		font: "",
		textBaseline: "",
		textAlign: "",
		lineJoin: "",
		lineWidth: 0,
		strokeStyle: "",
		fillRect() {},
		fillText(text: string) {
			texts.push(text);
		},
		strokeText(text: string) {
			texts.push(text);
		},
	};
	return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

const hud: HudModel = { best: 42, dev: false, paused: false, resumeDigit: null };

/** Step an attract-phase state forward a few idle ticks (demo scroll). */
function attractState(): SimState {
	let state = createInitialState("seed", defaultConfig);
	for (let i = 0; i < 10; i++) state = step(state, false);
	return state;
}

/** Press to start, then fly a few ticks so the run has non-zero distance. */
function flyingState(): SimState {
	let state = step(createInitialState("seed", defaultConfig), true);
	for (let i = 0; i < 10; i++) state = step(state, false);
	return state;
}

describe("render HUD gating", () => {
	it("does not draw the DISTANCE readout on the attract screen", () => {
		const state = attractState();
		expect(state.phase).toBe("attract");
		expect(state.distance).toBeGreaterThan(0);

		const { ctx, texts } = recordingCtx();
		render(ctx, state, hud);

		// The bottom HUD (DISTANCE / BEST readout) is the thing being gated.
		// `drawAttract` still shows `BEST` centre-screen, so DISTANCE is the
		// unambiguous marker that the bottom HUD ran.
		expect(texts.some((t) => t.includes("DISTANCE"))).toBe(false);
	});

	it("draws the DISTANCE readout while flying", () => {
		const state = flyingState();
		expect(state.phase).toBe("flying");

		const { ctx, texts } = recordingCtx();
		render(ctx, state, hud);

		expect(texts.some((t) => t.startsWith("DISTANCE:"))).toBe(true);
		expect(texts.some((t) => t.startsWith("BEST:"))).toBe(true);
	});
});

/**
 * Build a flying state whose on-screen tunnel is a known slice list, positioned
 * so slice `focusIndex` sits a little way in from the left edge.
 */
function stateWithTunnel(
	slices: readonly SimState["tunnel"][number][],
	focusIndex: number,
): {
	state: SimState;
	x: number;
	w: number;
} {
	const { sliceWidth } = defaultConfig.tunnel;
	const distance = focusIndex * sliceWidth - 100;
	const base = step(createInitialState("seed", defaultConfig), true);
	const state = { ...base, phase: "flying", distance, tunnel: slices } as SimState;
	return { state, x: focusIndex * sliceWidth - distance, w: sliceWidth + 1 };
}

describe("render tunnel obstacles", () => {
	const { height } = defaultConfig.world;
	const slices = generateTunnel("seed", defaultConfig, 400);

	/** First slice matching `pred`, with its index; throws if the seed has none. */
	function pick(pred: (s: (typeof slices)[number]) => boolean): {
		slice: (typeof slices)[number];
		index: number;
	} {
		const index = slices.findIndex(pred);
		const slice = slices[index];
		if (!slice) throw new Error("no matching slice for this seed");
		return { slice, index };
	}

	it("paints a top obstacle and its wall as one rectangle (no abutting seam)", () => {
		const { slice, index } = pick((s) => s.obstacle?.edge === "top");
		const depth = slice.obstacle?.depth ?? 0;
		const { state, x, w } = stateWithTunnel(slices, index);

		const { ctx, rects } = rectRecordingCtx();
		render(ctx, state, hud);

		// Wall + obstacle fused into a single fill from the canvas top.
		expect(hasRect(rects, [x, 0, w, slice.top + depth])).toBe(true);
		// No separate obstacle rectangle butting against the wall edge.
		expect(hasRect(rects, [x, slice.top, w, depth])).toBe(false);
	});

	it("paints a bottom obstacle and its wall as one rectangle (no abutting seam)", () => {
		const { slice, index } = pick((s) => s.obstacle?.edge === "bottom");
		const depth = slice.obstacle?.depth ?? 0;
		const { state, x, w } = stateWithTunnel(slices, index);

		const { ctx, rects } = rectRecordingCtx();
		render(ctx, state, hud);

		const bottomFill: Rect = [x, slice.bottom - depth, w, height - slice.bottom + depth];
		expect(hasRect(rects, bottomFill)).toBe(true);
		expect(hasRect(rects, [x, slice.bottom - depth, w, depth])).toBe(false);
	});

	it("leaves obstacle-free slices as plain top/bottom wall fills", () => {
		const { slice, index } = pick((s) => !s.obstacle);
		const { state, x, w } = stateWithTunnel(slices, index);

		const { ctx, rects } = rectRecordingCtx();
		render(ctx, state, hud);

		expect(hasRect(rects, [x, 0, w, slice.top])).toBe(true);
		expect(hasRect(rects, [x, slice.bottom, w, height - slice.bottom])).toBe(true);
	});

	it("keeps the +1px horizontal overlap between neighbouring slices", () => {
		const { index } = pick((s) => !s.obstacle);
		const { state } = stateWithTunnel(slices, index);
		const { ctx, rects } = rectRecordingCtx();
		render(ctx, state, hud);

		const overlap = defaultConfig.tunnel.sliceWidth + 1;
		expect(rects.filter((r) => r[2] === overlap).length).toBeGreaterThan(0);
	});
});

describe("render pause overlay", () => {
	it("draws the PAUSED overlay only when the hud flag is set", () => {
		const state = flyingState();

		const off = recordingCtx();
		render(off.ctx, state, hud);
		expect(off.texts).not.toContain("PAUSED");

		const on = recordingCtx();
		render(on.ctx, state, { ...hud, paused: true });
		expect(on.texts).toContain("PAUSED");
	});

	it("draws the resume countdown digit — and not PAUSED — during a countdown", () => {
		const state = flyingState();

		const { ctx, texts } = recordingCtx();
		render(ctx, state, { ...hud, paused: false, resumeDigit: 2 });

		expect(texts).toContain("2");
		expect(texts).not.toContain("PAUSED");
	});

	it("draws no countdown digit when resumeDigit is null", () => {
		const state = flyingState();

		const { ctx, texts } = recordingCtx();
		render(ctx, state, hud);

		expect(texts).not.toContain("1");
		expect(texts).not.toContain("2");
		expect(texts).not.toContain("3");
	});
});
