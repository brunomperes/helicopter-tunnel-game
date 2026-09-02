/**
 * Draws a sim state onto a canvas context. Read-only with respect to the sim.
 *
 * SCAFFOLD STATUS: draws the helicopter, HUD and phase overlays. Tunnel edges and
 * obstacles are drawn as a placeholder frame until sim generation exists.
 */

import type { SimState } from "../sim/index.js";
import { theme } from "../theme.js";

export interface HudModel {
	readonly best: number;
}

export function render(ctx: CanvasRenderingContext2D, state: SimState, hud: HudModel): void {
	const { width, height } = state.config.world;

	ctx.fillStyle = theme.background;
	ctx.fillRect(0, 0, width, height);

	drawTunnelPlaceholder(ctx, state);
	if (state.phase !== "attract") drawHelicopter(ctx, state);
	drawHud(ctx, state, hud);

	if (state.phase === "attract") drawAttract(ctx, state, hud);
	if (state.phase === "wrecked") drawWrecked(ctx, state, hud);
}

// TODO: replace with real tunnel edges + obstacles from the sim (docs/adr/0003).
function drawTunnelPlaceholder(ctx: CanvasRenderingContext2D, state: SimState): void {
	const { width, height } = state.config.world;
	const margin = 60;
	ctx.fillStyle = theme.tunnel;
	ctx.fillRect(0, 0, width, margin);
	ctx.fillRect(0, height - margin, width, margin);
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
