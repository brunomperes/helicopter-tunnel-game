/**
 * Owns the canvas, the fixed-timestep loop and the wiring between sim and shell.
 * The only place that touches wall-clock time. See ADR-0002.
 */

import { createInputSource, THRUST_KEYS } from "./input/index.js";
import { countdownDigit, type PauseEvent, type PauseState, reducePause } from "./pause/index.js";
import { render } from "./render/index.js";
import { createInitialState, defaultConfig, step } from "./sim/index.js";
import { loadBest, saveBest } from "./storage/index.js";

const MAX_FRAME_MS = 250;

export function startApp(canvas: HTMLCanvasElement): () => void {
	const config = defaultConfig;
	const seed = readSeed();
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d canvas context unavailable");

	const input = createInputSource(canvas);
	const stepMs = 1000 / config.tickHz;

	let state = createInitialState(seed, config);
	let best = loadBest();
	let accumulator = 0;
	let last = performance.now();
	let running = true;
	let pause: PauseState = { mode: "running" };

	const fitCanvas = () => resizeCanvas(canvas, ctx, config.world.width, config.world.height);
	fitCanvas();
	window.addEventListener("resize", fitCanvas);

	const onVisibility = () => {
		if (document.hidden) last = performance.now();
	};
	document.addEventListener("visibilitychange", onVisibility);

	// Pause is a shell concern only — see ADR-0004. It never reaches the sim:
	// a frozen tick is simply one where `step` is not called. `pause` moves
	// through running -> paused -> resuming (a 1500 ms countdown) -> running.
	const advancePause = (event: PauseEvent) => {
		const next = reducePause(pause, event);
		if (next === pause) return;
		const modeChanged = next.mode !== pause.mode;
		pause = next;
		// On any change of mode (freeze, re-pause, or go-live), hold the
		// accumulator and reset the frame clock so time spent frozen does not
		// fast-forward the sim, mirroring the tab-hidden path. A countdown
		// `tick` that only lowers `msLeft` keeps the same mode, so the clock is
		// left running and the countdown keeps measuring real wall-clock time.
		if (modeChanged) last = performance.now();
	};

	const onPauseKey = (e: KeyboardEvent) => {
		if (e.code === "KeyP" || e.code === "Escape") {
			// preventDefault on KeyP only — leave Escape for browser fullscreen-exit.
			if (e.code === "KeyP") e.preventDefault();
			advancePause({ type: "pauseKey", phase: state.phase });
		} else if (THRUST_KEYS.has(e.code) && !e.repeat) {
			// A genuine press resumes; ignore key-repeat so holding thrust while
			// pausing doesn't immediately unpause.
			advancePause({ type: "thrust" });
		}
	};
	window.addEventListener("keydown", onPauseKey);

	const frame = (now: number) => {
		if (!running) return;
		const delta = Math.min(now - last, MAX_FRAME_MS);
		last = now;

		if (pause.mode === "resuming") {
			// Sim stays frozen for the whole countdown; advance it by real
			// elapsed ms. When this ends the countdown `advancePause` resets the
			// frame clock, so the sim goes live next frame without a burst of
			// catch-up ticks — and never within this same frame.
			advancePause({ type: "tick", elapsedMs: delta });
		} else if (pause.mode === "running") {
			accumulator += delta;
			const thrust = document.hidden ? false : input.thrustHeld;
			while (accumulator >= stepMs) {
				const wasFlying = state.phase === "flying";
				state = step(state, thrust);
				if (wasFlying && state.phase === "wrecked") best = saveBest(state.distance);
				accumulator -= stepMs;
			}
		}

		render(ctx, state, {
			best,
			dev: import.meta.env.DEV,
			paused: pause.mode === "paused",
			resumeDigit: pause.mode === "resuming" ? countdownDigit(pause.msLeft) : null,
		});
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);

	return () => {
		running = false;
		input.dispose();
		window.removeEventListener("resize", fitCanvas);
		window.removeEventListener("keydown", onPauseKey);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}

function readSeed(): string {
	const param = new URLSearchParams(window.location.search).get("seed");
	return param && param.length > 0 ? param : Math.random().toString(36).slice(2, 10);
}

/** Integer-ish scale + letterbox the canvas to the viewport, rendering at dpr. */
function resizeCanvas(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	logicalW: number,
	logicalH: number,
): void {
	const dpr = window.devicePixelRatio || 1;
	const scale = Math.min(window.innerWidth / logicalW, window.innerHeight / logicalH);
	canvas.style.width = `${logicalW * scale}px`;
	canvas.style.height = `${logicalH * scale}px`;
	canvas.width = Math.round(logicalW * scale * dpr);
	canvas.height = Math.round(logicalH * scale * dpr);
	// Map logical coordinates onto device pixels.
	ctx.setTransform(canvas.width / logicalW, 0, 0, canvas.height / logicalH, 0, 0);
	ctx.imageSmoothingEnabled = false;
}
