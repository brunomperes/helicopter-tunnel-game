/**
 * Owns the canvas, the fixed-timestep loop and the wiring between sim and shell.
 * The only place that touches wall-clock time. See ADR-0002.
 */

import { createInputSource } from "./input/index.js";
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

	const fitCanvas = () => resizeCanvas(canvas, ctx, config.world.width, config.world.height);
	fitCanvas();
	window.addEventListener("resize", fitCanvas);

	const onVisibility = () => {
		if (document.hidden) last = performance.now();
	};
	document.addEventListener("visibilitychange", onVisibility);

	const frame = (now: number) => {
		if (!running) return;
		const delta = Math.min(now - last, MAX_FRAME_MS);
		last = now;
		accumulator += delta;

		const thrust = document.hidden ? false : input.thrustHeld;
		while (accumulator >= stepMs) {
			const wasFlying = state.phase === "flying";
			state = step(state, thrust);
			if (wasFlying && state.phase === "wrecked") best = saveBest(state.distance);
			accumulator -= stepMs;
		}

		render(ctx, state, { best });
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);

	return () => {
		running = false;
		input.dispose();
		window.removeEventListener("resize", fitCanvas);
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
