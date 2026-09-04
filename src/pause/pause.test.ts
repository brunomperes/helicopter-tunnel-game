import { describe, expect, it } from "vitest";
import type { Phase } from "../sim/index.js";
import {
	countdownDigit,
	PAUSED,
	type PauseState,
	RESUME_COUNTDOWN_MS,
	RUNNING,
	reducePause,
} from "./index.js";

const phases: Phase[] = ["attract", "flying", "wrecked"];

/** Drive a resuming countdown forward by `elapsedMs` (one tick event). */
function tick(state: PauseState, elapsedMs: number): PauseState {
	return reducePause(state, { type: "tick", elapsedMs });
}

describe("reducePause: pause / resume transitions", () => {
	it("pauses on the pause key during a flying run", () => {
		expect(reducePause(RUNNING, { type: "pauseKey", phase: "flying" })).toEqual(PAUSED);
	});

	it("is a no-op on the pause key outside a flying run", () => {
		for (const phase of ["attract", "wrecked"] as const) {
			expect(reducePause(RUNNING, { type: "pauseKey", phase })).toEqual(RUNNING);
		}
	});

	it("ignores the pause key while already paused", () => {
		for (const phase of phases) {
			expect(reducePause(PAUSED, { type: "pauseKey", phase })).toEqual(PAUSED);
		}
	});

	it("starts a fresh countdown on thrust while paused", () => {
		expect(reducePause(PAUSED, { type: "thrust" })).toEqual({
			mode: "resuming",
			msLeft: RESUME_COUNTDOWN_MS,
		});
	});

	it("is a no-op on thrust while running", () => {
		expect(reducePause(RUNNING, { type: "thrust" })).toEqual(RUNNING);
	});

	it("ignores a tick outside the countdown", () => {
		expect(tick(RUNNING, 500)).toEqual(RUNNING);
		expect(tick(PAUSED, 500)).toEqual(PAUSED);
	});
});

describe("reducePause: resume countdown", () => {
	const start = reducePause(PAUSED, { type: "thrust" });

	it("counts 1500 ms down, one digit per 500 ms, then goes live", () => {
		let s = start;
		expect(s).toEqual({ mode: "resuming", msLeft: 1500 });

		s = tick(s, 500);
		expect(s).toEqual({ mode: "resuming", msLeft: 1000 });

		s = tick(s, 500);
		expect(s).toEqual({ mode: "resuming", msLeft: 500 });

		s = tick(s, 500);
		expect(s).toEqual(RUNNING);
	});

	it("accumulates partial-frame ticks", () => {
		let s = start;
		s = tick(s, 300);
		s = tick(s, 300);
		expect(s).toEqual({ mode: "resuming", msLeft: 900 });
	});

	it("goes live once the countdown reaches zero or overshoots", () => {
		expect(tick(start, 1500)).toEqual(RUNNING);
		expect(tick(start, 4000)).toEqual(RUNNING);
	});

	it("does not consume or replay the resuming thrust press", () => {
		// A thrust that arrives mid-countdown changes nothing — it just carries
		// through to the first live tick as held/not-held.
		expect(reducePause(start, { type: "thrust" })).toEqual(start);
		const mid = tick(start, 500);
		expect(reducePause(mid, { type: "thrust" })).toEqual(mid);
	});
});

describe("reducePause: re-pause resets the countdown", () => {
	it("returns to PAUSED on the pause key mid-countdown", () => {
		const start = reducePause(PAUSED, { type: "thrust" });
		const mid = tick(start, 1000);
		expect(mid).toEqual({ mode: "resuming", msLeft: 500 });

		for (const phase of phases) {
			expect(reducePause(mid, { type: "pauseKey", phase })).toEqual(PAUSED);
		}
	});

	it("the next thrust starts a fresh 3 -> 2 -> 1", () => {
		const start = reducePause(PAUSED, { type: "thrust" });
		const rePaused = reducePause(tick(start, 1000), { type: "pauseKey", phase: "flying" });
		expect(reducePause(rePaused, { type: "thrust" })).toEqual({
			mode: "resuming",
			msLeft: RESUME_COUNTDOWN_MS,
		});
	});
});

describe("countdownDigit: ceil(msLeft / 500)", () => {
	it("shows 3, then 2, then 1 across the countdown", () => {
		expect(countdownDigit(1500)).toBe(3);
		expect(countdownDigit(1001)).toBe(3);
		expect(countdownDigit(1000)).toBe(2);
		expect(countdownDigit(501)).toBe(2);
		expect(countdownDigit(500)).toBe(1);
		expect(countdownDigit(1)).toBe(1);
	});
});
