/**
 * Pixel-art sprites for the helicopter, in its flying and wrecked states.
 *
 * Format
 * ------
 * Each sprite is a `string[]` of exactly `SPRITE_H` rows, each exactly
 * `SPRITE_W` characters. One character = one art pixel = `ART_PIXEL` logical
 * pixels (the game renders in a fixed 960x540 logical space). `.` is
 * transparent; every other character is a key into `theme.spritePalette`.
 * Blit with `blitSprite` in `render/index.ts`.
 *
 * Both sprites are static — no rotor animation, no flame flicker. The main
 * rotor is drawn as a fixed blur bar; the wreck carries a single flame.
 *
 * Alignment
 * ---------
 * Both sprites share one canvas. `ORIGIN` is the helicopter's sim anchor (the
 * point the sim simulates as `(x, y)`) in art-pixel coordinates from the
 * frame's top-left. To draw:
 *   screenTopLeft = (simX - ORIGIN.x * ART_PIXEL, simY - ORIGIN.y * ART_PIXEL)
 * The collision box (`config.helicopter`: 46 wide, `topOffset` 18 above the
 * anchor, `bottomOffset` 10 below) is fit to this sprite's solid pixels — the
 * main rotor blur bar top and the skid bottom — so contact with either reads
 * as a real hit. It's still narrower than the sprite horizontally, so the
 * tail-rotor tip and rotor-blur tips overhang it slightly (visual only).
 */

export const ART_PIXEL = 2;
export const SPRITE_W = 32;
export const SPRITE_H = 24;

/** Sim anchor in art-pixel coords from the frame's top-left. */
export const ORIGIN = { x: 16, y: 16 } as const;

// prettier-ignore
const HELICOPTER: string[] = [
	"................................",
	"................................",
	"................................",
	"................................",
	"................................",
	"................................",
	"................................",
	"...RRRRRRRRRRRRRRRRRRRRRRRRR....",
	"..KK...........KK...............",
	"RRKK...........KK...............",
	"..KKDDDDDDDDDDDDDDDDDDDDMD......",
	"...KDDDDDMMMMMMMMMMMGGGGGDD.....",
	".......DMMMMMMMMMMMMGGGGGGgD....",
	".......DMMMMMMMMMMMMGGGGGggD....",
	".......DMMMMMMMMMMMMMGGGGMD.....",
	"........DMMMMMMMMMMMMMMMD.......",
	".........DMMMMMMMMMMMMMD........",
	"..........DDDDDDDDDDDDD.........",
	".............K.......K..........",
	".............K.......K..........",
	"...........KKKKKKKKKKKKKK.......",
	"................................",
	"................................",
	"................................",
];

// prettier-ignore
const WRECK: string[] = [
	"................................",
	"................................",
	"................................",
	"................yy..............",
	"...............oyyo.............",
	"..............ooyyoo............",
	".............orryyyoo...........",
	"............orroywyoor..........",
	"...........rrooywywoorr.........",
	"..K.......rrooowywywooor........",
	"..KCCCKKKKrrrooowwwooorrrcC.....",
	"...KCCCCCcccccccccccCCCCCCC.....",
	".......CccccccccccccCCCCCCCC....",
	".......CccccccccccccCCCCCCCC....",
	".......CcccccccccccccCCCCcC.....",
	"........CcccccccccccccccC.......",
	".........CcccccccccccccC........",
	"..........DDDDDDDDDDDDD.........",
	".............K.......K..........",
	".............K.......K..........",
	"...........KKKKKKKKKKKKKK.......",
	"................................",
	"................................",
	"................................",
];

export const sprites = {
	helicopter: HELICOPTER,
	wreck: WRECK,
} as const;
