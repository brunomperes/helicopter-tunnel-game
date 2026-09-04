import { describe, expect, it } from "vitest";
import { createInitialState, defaultConfig, type SimState, step } from "../sim/index.js";
import { type HudModel, render } from "./index.js";

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
