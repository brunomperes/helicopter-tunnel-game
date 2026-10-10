import { describe, expect, it } from "vitest";
import type { HudModel } from "./render/index.js";
import { createInitialState, defaultConfig, type SimState, step } from "./sim/index.js";
import { createGameUi } from "./ui.js";

function setup() {
	const nodes = new Map<
		string,
		{ hidden: boolean; textContent: string; style: { visibility: string } }
	>();
	const ui = createGameUi({
		querySelector: (selector: string) => {
			const node = { hidden: false, textContent: "", style: { visibility: "" } };
			nodes.set(selector, node);
			return node as unknown as HTMLElement;
		},
	} as Pick<Document, "querySelector">);
	const node = (id: string) => nodes.get(`#${id}`);
	const attract = createInitialState("ui", defaultConfig);
	const flying = step(attract, true);
	const hud: HudModel = { best: 42, dev: false, paused: false, resumeDigit: null };
	return { ui, node, attract, flying, hud };
}

describe("HTML game text", () => {
	it("shows instructions before a run, then live readouts without an overlay", () => {
		const { ui, node, attract, flying, hud } = setup();
		ui.update(attract, hud);
		expect(node("overlay-title")?.textContent).toBe("TAP TO START");
		expect(node("instructions")?.hidden).toBe(false);
		expect(node("distance")?.hidden).toBe(true);
		expect(node("best")?.textContent).toBe("BEST: 42");
		ui.update({ ...flying, distance: 125.9 }, hud);
		expect(node("overlay")?.hidden).toBe(true);
		expect(node("instructions")?.hidden).toBe(true);
		expect(node("distance")?.hidden).toBe(false);
		expect(node("distance")?.textContent).toBe("DISTANCE: 125");
		expect(node("dev-readout")?.hidden).toBe(true);
	});

	it("keeps retry hidden during the crash input lock and announces a new best", () => {
		const { ui, node, flying, hud } = setup();
		const wrecked = { ...flying, phase: "wrecked", distance: 50, restartLock: 10 } as SimState;
		ui.update(wrecked, { ...hud, best: 50 });
		expect(node("overlay")?.hidden).toBe(false);
		expect(node("overlay-title")?.textContent).toBe("NEW BEST");
		expect(node("retry")?.hidden).toBe(false);
		expect(node("retry")?.style.visibility).toBe("hidden");
		ui.update({ ...wrecked, restartLock: 0 }, { ...hud, best: 100 });
		expect(node("overlay-title")?.textContent).toBe("WRECKED");
		expect(node("retry")?.hidden).toBe(false);
		expect(node("retry")?.style.visibility).toBe("visible");
	});

	it("replaces pause with the countdown and clears it on resume", () => {
		const { ui, node, flying, hud } = setup();
		ui.update(flying, { ...hud, paused: true });
		expect(node("overlay-title")?.textContent).toBe("PAUSED");
		expect(node("overlay")?.hidden).toBe(false);
		for (const resumeDigit of [3, 2, 1]) {
			ui.update(flying, { ...hud, resumeDigit });
			expect(node("overlay")?.hidden).toBe(true);
			expect(node("countdown")?.hidden).toBe(false);
			expect(node("countdown")?.textContent).toBe(String(resumeDigit));
		}
		ui.update(flying, hud);
		expect(node("countdown")?.hidden).toBe(true);
		expect(node("countdown")?.textContent).toBe("");
	});
});
