/**
 * Draws a sim state onto a canvas context. Read-only with respect to the sim.
 *
 * SCAFFOLD STATUS: draws the tunnel (edges + obstacles), helicopter, HUD and
 * phase overlays. Colours are the placeholder palette; the art pass is deferred.
 */

import type { SimState, Slice } from "../sim/index.js";
import { theme } from "../theme.js";

export interface HudModel {
	readonly best: number;
}

export function render(ctx: CanvasRenderingContext2D, state: SimState, hud: HudModel): void {
	const { width, height } = state.config.world;

	ctx.fillStyle = theme.background;
	ctx.fillRect(0, 0, width, height);

	drawTunnel(ctx, state);
	if (state.phase !== "attract") drawHelicopter(ctx, state);
	drawHud(ctx, state, hud);

	if (state.phase === "attract") drawAttract(ctx, state, hud);
	if (state.phase === "wrecked") drawWrecked(ctx, state, hud);
}

/**
 * Fills the solid rock above the top edge and below the bottom edge for every
 * slice currently on screen, then stamps each slice's obstacle. Slice `i` covers
 * tunnel distance `[i * sliceWidth, (i + 1) * sliceWidth)`; with the run scrolled
 * `state.distance` px, its left edge sits at screen-x `i * sliceWidth - distance`.
 */
function drawTunnel(ctx: CanvasRenderingContext2D, state: SimState): void {
	const { width, height } = state.config.world;
	const { sliceWidth } = state.config.tunnel;
	const first = Math.max(0, Math.floor(state.distance / sliceWidth));
	const last = Math.ceil((state.distance + width) / sliceWidth);

	ctx.fillStyle = theme.tunnel;
	for (let i = first; i <= last; i++) {
		const slice = state.tunnel[i];
		if (!slice) continue;
		const x = i * sliceWidth - state.distance;
		// +1 keeps neighbouring slices seamless under the non-smoothed transform.
		const w = sliceWidth + 1;
		ctx.fillRect(x, 0, w, slice.top);
		ctx.fillRect(x, slice.bottom, w, height - slice.bottom);
		drawObstacle(ctx, slice, x, w);
	}
}

function drawObstacle(ctx: CanvasRenderingContext2D, slice: Slice, x: number, w: number): void {
	const { obstacle } = slice;
	if (!obstacle) return;
	if (obstacle.edge === "top") {
		ctx.fillRect(x, slice.top, w, obstacle.depth);
	} else {
		ctx.fillRect(x, slice.bottom - obstacle.depth, w, obstacle.depth);
	}
}

function drawHelicopter(ctx: CanvasRenderingContext2D, state: SimState): void {
	const { world, helicopter } = state.config;
	const x = world.width * helicopter.xFrac;
	const y = state.helicopter.y;
	ctx.fillStyle = theme.helicopter;
	ctx.fillRect(
		x - helicopter.width / 2,
		y - helicopter.height / 2,
		helicopter.width,
		helicopter.height,
	);
	ctx.fillStyle = theme.helicopterAccent;
	ctx.fillRect(x - helicopter.width / 2, y - helicopter.height / 2, helicopter.width, 4);
}

function drawHud(ctx: CanvasRenderingContext2D, state: SimState, hud: HudModel): void {
	ctx.fillStyle = theme.hudText;
	ctx.font = theme.hudFont;
	ctx.textBaseline = "alphabetic";
	ctx.textAlign = "left";
	ctx.fillText(`DISTANCE: ${Math.floor(state.distance)}`, 16, state.config.world.height - 16);
	ctx.textAlign = "right";
	ctx.fillText(`BEST: ${hud.best}`, state.config.world.width - 16, state.config.world.height - 16);
}

function drawAttract(ctx: CanvasRenderingContext2D, state: SimState, hud: HudModel): void {
	const { width, height } = state.config.world;
	centeredText(ctx, "TAP TO START", width / 2, height / 2 - 8, theme.titleFont);
	centeredText(
		ctx,
		"HOLD TO GO UP · RELEASE TO GO DOWN",
		width / 2,
		height / 2 + 28,
		theme.hudFont,
	);
	if (hud.best > 0) {
		centeredText(ctx, `BEST: ${hud.best}`, width / 2, height / 2 + 52, theme.hudFont);
	}
}

function drawWrecked(ctx: CanvasRenderingContext2D, state: SimState, hud: HudModel): void {
	const { width, height } = state.config.world;
	ctx.fillStyle = theme.overlayScrim;
	ctx.fillRect(0, 0, width, height);
	const distance = Math.floor(state.distance);
	const isBest = distance >= hud.best && distance > 0;
	centeredText(ctx, isBest ? "NEW BEST" : "WRECKED", width / 2, height / 2 - 24, theme.titleFont);
	centeredText(ctx, `DISTANCE: ${distance}`, width / 2, height / 2 + 8, theme.hudFont);
	if (!isBest) centeredText(ctx, `BEST: ${hud.best}`, width / 2, height / 2 + 30, theme.hudFont);
	if (state.restartLock === 0) {
		centeredText(ctx, "TAP TO RETRY", width / 2, height / 2 + 58, theme.hudFont);
	}
}

function centeredText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	font: string,
): void {
	ctx.fillStyle = theme.overlayText;
	ctx.font = font;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, x, y);
}
