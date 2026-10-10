import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInputSource, type InputSource } from "./index.js";

describe("createInputSource", () => {
	let target: EventTarget;
	let input: InputSource;

	beforeEach(() => {
		target = new EventTarget();
		vi.stubGlobal("window", target);
		input = createInputSource();
	});

	afterEach(() => {
		input.dispose();
		vi.unstubAllGlobals();
	});

	function pointer(type: "pointerdown" | "pointerup", pointerId: number, button = 0) {
		target.dispatchEvent(Object.assign(new Event(type), { pointerId, button }));
	}

	it("keeps thrust held until the last held pointer is released", () => {
		expect(input.thrustHeld).toBe(false);
		pointer("pointerdown", 1);
		pointer("pointerdown", 2);
		expect(input.thrustHeld).toBe(true);
		pointer("pointerup", 1);
		expect(input.thrustHeld).toBe(true);
		pointer("pointerup", 2);
		expect(input.thrustHeld).toBe(false);
	});

	it("ignores releases from pointers that are not held", () => {
		pointer("pointerdown", 1);
		pointer("pointerup", 2);
		expect(input.thrustHeld).toBe(true);
		pointer("pointerup", 1);
		expect(input.thrustHeld).toBe(false);
	});

	it("does not count repeated presses of the same pointer twice", () => {
		pointer("pointerdown", 1);
		pointer("pointerdown", 1);
		pointer("pointerup", 1);
		expect(input.thrustHeld).toBe(false);
	});

	it("clears every held pointer on blur", () => {
		pointer("pointerdown", 1);
		pointer("pointerdown", 2);
		target.dispatchEvent(new Event("blur"));
		expect(input.thrustHeld).toBe(false);
		pointer("pointerdown", 3);
		pointer("pointerup", 1);
		pointer("pointerup", 2);
		expect(input.thrustHeld).toBe(true);
		pointer("pointerup", 3);
		expect(input.thrustHeld).toBe(false);
	});

	it("ignores non-primary buttons", () => {
		pointer("pointerdown", 1, 2);
		expect(input.thrustHeld).toBe(false);
		pointer("pointerdown", 2);
		pointer("pointerup", 1, 2);
		expect(input.thrustHeld).toBe(true);
		pointer("pointerup", 2);
		expect(input.thrustHeld).toBe(false);
	});

	it("keeps keyboard thrust held after all pointers are released", () => {
		target.dispatchEvent(Object.assign(new Event("keydown"), { code: "Space" }));
		pointer("pointerdown", 1);
		pointer("pointerdown", 2);
		pointer("pointerup", 1);
		pointer("pointerup", 2);
		expect(input.thrustHeld).toBe(true);
		target.dispatchEvent(Object.assign(new Event("keyup"), { code: "Space" }));
		expect(input.thrustHeld).toBe(false);
	});

	it("removes the pointer listeners on disposal", () => {
		input.dispose();
		pointer("pointerdown", 1);
		expect(input.thrustHeld).toBe(false);
	});
});
