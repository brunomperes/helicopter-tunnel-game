import { describe, expect, it } from "vitest";
import type { Phase } from "../sim/index.js";
import { type PauseMode, reducePause } from "./index.js";

const phases: Phase[] = ["attract", "flying", "wrecked"];

describe("reducePause", () => {
	it("pauses on the pause key during a flying run", () => {
		expect(reducePause("running", { type: "pauseKey", phase: "flying" })).toBe("paused");
	});

	it("is a no-op on the pause key outside a flying run", () => {
		for (const phase of ["attract", "wrecked"] as const) {
			expect(reducePause("running", { type: "pauseKey", phase })).toBe("running");
		}
	});

	it("ignores the pause key while already paused (thrust is the resume in slice 1)", () => {
		for (const phase of phases) {
			expect(reducePause("paused", { type: "pauseKey", phase })).toBe("paused");
		}
	});

	it("resumes on thrust while paused", () => {
		expect(reducePause("paused", { type: "thrust" })).toBe("running");
	});

	it("is a no-op on thrust while running", () => {
		expect(reducePause("running", { type: "thrust" })).toBe("running");
	});

	it("only ever returns a valid mode", () => {
		const modes: PauseMode[] = ["running", "paused"];
		for (const mode of modes) {
			for (const phase of phases) {
				expect(modes).toContain(reducePause(mode, { type: "pauseKey", phase }));
				expect(modes).toContain(reducePause(mode, { type: "thrust" }));
			}
		}
	});
});
