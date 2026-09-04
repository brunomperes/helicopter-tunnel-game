/**
 * Pixel-art sprites for the helicopter, in its flying and wrecked states.
 *
 * SCAFFOLD STATUS: first-pass art for review. Nothing imports this yet — the
 * integration job wires it into `render/index.ts` (see the deferred art-pass
 * note in `theme.ts`). The HTML review harness renders both sprites; redline
 * the pixels there.
 *
 * Format
 * ------
 * Each sprite is a `string[]` of exactly `SPRITE_H` rows, each exactly
 * `SPRITE_W` characters. One character = one art pixel = `ART_PIXEL` logical
 * pixels (the game renders in a fixed 960x540 logical space). `.` is
 * transparent; every other character is a key into `PALETTE`.
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
 * The 46x20 logical collision box is centred on that same anchor; the rotor
 * span, tail rotor and skids deliberately overhang it (visual only).
 */

export const ART_PIXEL = 2;
export const SPRITE_W = 32;
export const SPRITE_H = 24;

/** Sim anchor in art-pixel coords from the frame's top-left. */
export const ORIGIN = { x: 16, y: 16 } as const;

export const PALETTE = {
	// Living helicopter
	D: "#1a3f7a", // hullDark   - roof, shadow side, panel lines, hull outline
	M: "#2b6fd8", // hullMid    - main hull (matches theme.helicopterAccent)
	G: "#12294a", // glass      - cockpit canopy
	g: "#7fd8ff", // glassGlare - canopy glare
	K: "#0d1420", // rotorBlack - mast, tail rotor, skids
	R: "#93a6c9", // rotorBlur  - main-rotor blur bar
	// Wreck
	C: "#17171c", // charDark    - blackened structure
	c: "#33323a", // charMid     - scorched panels
	r: "#d92b1a", // flameRed    - flame base
	o: "#ff8c1a", // flameOrange - flame mid
	y: "#ffe14d", // flameYellow - flame tips (matches theme.devText)
	w: "#fff6d8", // flameCore    - white-hot core
} as const;

export type PaletteKey = keyof typeof PALETTE;

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
