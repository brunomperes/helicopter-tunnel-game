import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp } from "./app.js";
import { render } from "./render/index.js";

vi.mock("./render/index.js", () => ({ render: vi.fn() }));

describe("pause input wiring", () => {
	let target: EventTarget;
	let frame: FrameRequestCallback;
	let now: number;
	let dispose: () => void;

	function key(type: string, code: string, repeat = false) {
		target.dispatchEvent(Object.assign(new Event(type), { code, repeat }));
	}
	function tick(ms = 20) {
		now += ms;
		frame(now);
	}
	function hud() {
		return vi.mocked(render).mock.lastCall?.[2];
	}

	beforeEach(() => {
		now = 0;
		target = new EventTarget();
		vi.stubGlobal(
			"window",
			Object.assign(target, {
				location: { search: "?seed=pause-test" },
				innerWidth: 800,
				innerHeight: 600,
				devicePixelRatio: 1,
			}),
		);
		vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
		vi.stubGlobal("performance", { now: () => now });
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frame = callback;
		});
		const canvas = { style: {}, getContext: () => ({ setTransform: vi.fn() }) };
		dispose = startApp(canvas as unknown as HTMLCanvasElement);
		key("keydown", "Space");
		tick();
		key("keyup", "Space");
		key("keydown", "KeyP");
		tick();
		expect(hud()?.paused).toBe(true);
	});

	afterEach(() => {
		dispose();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it.each(["pointerdown", "touchstart", "keydown"])(
		"resumes with %s, even for a tap between frames",
		(type) => {
			target.dispatchEvent(
				Object.assign(new Event(type), { button: 0, pointerId: 1, code: "Space", repeat: false }),
			);
			target.dispatchEvent(
				Object.assign(
					new Event(
						{ pointerdown: "pointerup", touchstart: "touchend", keydown: "keyup" }[type] ?? "",
					),
					{ pointerId: 1, touches: [], code: "Space" },
				),
			);
			tick();
			expect(hud()).toMatchObject({ paused: false, resumeDigit: 3 });
			for (let i = 0; i < 6; i++) tick(250);
			expect(hud()).toMatchObject({ paused: false, resumeDigit: null });
		},
	);

	it("does not resume on keyboard repeat or a non-primary pointer button", () => {
		key("keydown", "Space", true);
		target.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 2, pointerId: 1 }));
		tick();
		expect(hud()?.paused).toBe(true);
	});

	it("requires a fresh press after re-pausing while thrust is held", () => {
		target.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 1 }));
		key("keydown", "KeyP");
		tick();
		expect(hud()?.paused).toBe(true);
		target.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 1 }));
		target.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 1 }));
		tick();
		expect(hud()?.resumeDigit).toBe(3);
	});
});
