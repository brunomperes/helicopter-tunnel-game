/**
 * Draws a sim state onto a canvas context. Read-only with respect to the sim.
 *
 * Draws the tunnel, helicopter and overlay scrim. Text lives in the HTML UI.
 */

import type { SimState } from "../sim/index.js";
import { spritePalette, theme } from "../theme.js";
import { SMOKE_LIFETIME_SECONDS, type SmokePuff } from "./smoke.js";
import { ART_PIXEL, ORIGIN, sprites } from "./sprites.js";

export interface HudModel {
	readonly best: number;
	/** When true, draw the dev collision box. */
	readonly dev: boolean;
	/** When true, the run is statically paused (ADR-0004): draw the scrim + PAUSED title. */
	readonly paused: boolean;
	/**
	 * Resume countdown digit (`3` / `2` / `1`) to draw over the frozen field, or
	 * `null` when no countdown is running. The scrim is absent during the
	 * countdown so the player can re-orient before the sim goes live.
	 */
	readonly resumeDigit: number | null;
}

export function render(
	ctx: CanvasRenderingContext2D,
	state: SimState,
	hud: HudModel,
	smoke: readonly SmokePuff[] = [],
): void {
	const { width, height } = state.config.world;

	ctx.fillStyle = theme.background;
	ctx.fillRect(0, 0, width, height);

	if (state.phase !== "attract") drawSmoke(ctx, state, smoke);
	drawTunnel(ctx, state);
	if (state.phase !== "attract") drawHelicopter(ctx, state);
	if (hud.dev && state.phase !== "attract") drawCollisionBox(ctx, state);
	if (state.phase === "attract" || state.phase === "wrecked" || hud.paused) {
		drawScrim(ctx, width, height);
	}
}

/** Draw behind the tunnel so exhaust never paints over solid walls. */
function drawSmoke(
	ctx: CanvasRenderingContext2D,
	state: SimState,
	puffs: readonly SmokePuff[],
): void {
	// The sprite's tail extends beyond the collision box.
	const rear = state.config.world.width * state.config.helicopter.xFrac - ORIGIN.x * ART_PIXEL;
	for (const puff of puffs) {
		const age = (state.tick - puff.tick) / state.config.tickHz;
		const progress = age / SMOKE_LIFETIME_SECONDS;
		if (progress < 0 || progress >= 1) continue;
		const stage = Math.min(3, Math.floor(progress * 4));
		const size = 4 + stage * 2;
		// Each puff has its own gentle rise, avoiding a rigid ribbon in motion.
		const rise = 12 + 16 * (0.5 + 0.5 * Math.sin(puff.tick * 1.7));
		// Snap all edges to a two-pixel grid; growth and fading happen in steps.
		const x = Math.floor((rear + puff.distance - state.distance - age * 48 - size) / 2) * 2;
		const y = Math.floor((puff.y - 3 * ART_PIXEL - age * rise - size / 2) / 2) * 2;
		ctx.fillStyle = theme.smoke[stage] ?? theme.smoke[3];
		if (stage === 3) {
			// Break the oldest puff into sparse pixels as it dissipates.
			for (let row = 0; row < size / 2; row++) {
				for (let col = 0; col < size / 2; col++) {
					if ((row + col) % 3 === 0) ctx.fillRect(x + col * 2, y + row * 2, 2, 2);
				}
			}
		} else if (stage === 0) {
			ctx.fillRect(x, y, size, size);
		} else {
			// Clipped square corners give each puff a chunky pixel-cloud silhouette.
			ctx.fillRect(x + 2, y, size - 4, size);
			ctx.fillRect(x, y + 2, size, size - 4);
		}
	}
}

/** Dim the whole world so an overlay title reads on top of it. */
function drawScrim(ctx: CanvasRenderingContext2D, width: number, height: number): void {
	ctx.fillStyle = theme.overlayScrim;
	ctx.fillRect(0, 0, width, height);
}

/**
 * Fills the solid rock above the top edge and below the bottom edge for every
 * slice currently on screen. An obstacle is the same colour as the wall it roots
 * into, so its depth is folded into the wall fill rather than stamped as a second
 * abutting rectangle — a shared boundary at a fractional y would crack into a
 * hairline seam under the scaled, non-smoothed transform. Only the obstacle's
 * gap-facing edge stays a rectangle boundary.
 *
 * Slice `i` covers tunnel distance `[i * sliceWidth, (i + 1) * sliceWidth)`; with
 * the run scrolled `state.distance` px, its left edge sits at screen-x
 * `i * sliceWidth - distance`.
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
		const { obstacle } = slice;
		const topDepth = obstacle?.edge === "top" ? obstacle.depth : 0;
		const bottomDepth = obstacle?.edge === "bottom" ? obstacle.depth : 0;
		ctx.fillRect(x, 0, w, slice.top + topDepth);
		ctx.fillRect(x, slice.bottom - bottomDepth, w, height - slice.bottom + bottomDepth);
	}
}

/**
 * The helicopter's hitbox rect, matching the bounds `crashes()` checks.
 * Rotor tips and the tail extend beyond the box horizontally.
 */
function helicopterHitbox(state: SimState) {
	const { world, helicopter } = state.config;
	const x = world.width * helicopter.xFrac;
	const y = state.helicopter.y;
	return {
		x: x - helicopter.width / 2,
		y: y - helicopter.topOffset,
		w: helicopter.width,
		h: helicopter.topOffset + helicopter.bottomOffset,
	};
}

function drawHelicopter(ctx: CanvasRenderingContext2D, state: SimState): void {
	const { world, helicopter } = state.config;
	const x = world.width * helicopter.xFrac;
	const y = state.helicopter.y;
	const frame = state.phase === "wrecked" ? sprites.wreck : sprites.helicopter;
	blitSprite(ctx, frame, x, y);
}

/**
 * Draws a sprite frame (palette keys / `.` for transparent) anchored at its
 * rounded sim position. Each solid cell fills one ART_PIXEL-sized square.
 */
function blitSprite(
	ctx: CanvasRenderingContext2D,
	frame: readonly string[],
	anchorX: number,
	anchorY: number,
): void {
	const left = Math.round(anchorX - ORIGIN.x * ART_PIXEL);
	const top = Math.round(anchorY - ORIGIN.y * ART_PIXEL);
	for (let row = 0; row < frame.length; row++) {
		const line = frame[row];
		if (!line) continue;
		for (let col = 0; col < line.length; col++) {
			const ch = line[col];
			if (!ch || ch === ".") continue;
			ctx.fillStyle = spritePalette[ch as keyof typeof spritePalette];
			ctx.fillRect(left + col * ART_PIXEL, top + row * ART_PIXEL, ART_PIXEL, ART_PIXEL);
		}
	}
}

/**
 * Dev-mode outline over the helicopter's hitbox rect — the exact bounds
 * `crashes()` checks against — so the box is visible during playtesting.
 * Stroke only, so the sprite underneath stays visible.
 */
function drawCollisionBox(ctx: CanvasRenderingContext2D, state: SimState): void {
	const box = helicopterHitbox(state);
	ctx.lineWidth = 1;
	ctx.lineJoin = "miter";
	ctx.strokeStyle = theme.collisionBox;
	ctx.strokeRect(box.x, box.y, box.w, box.h);
}
