/**
 * Placeholder palette, drawn from the reference art (green blocky tunnel on
 * black). Revisited in the deferred art pass.
 */
export const theme = {
	background: "#000000",
	letterbox: "#000000",
	tunnel: "#3ad12e",
	helicopterAccent: "#8c949c",
	hudText: "#ffffff",
	devText: "#ffe14d",
	/** Dev-mode collision box outline, drawn over the helicopter's hitbox. */
	collisionBox: "#ff3ddc",
	overlayText: "#ffffff",
	overlayScrim: "rgba(0, 0, 0, 0.55)",
	/** Resume countdown digit: white core + dark outline so it reads over the
	 * black gap and the green tunnel fill alike (there is no scrim behind it). */
	countdownText: "#ffffff",
	countdownOutline: "#000000",
	hudFont: "16px monospace",
	titleFont: "32px monospace",
	countdownFont: "bold 72px monospace",
} as const;

/**
 * Palette for the helicopter/wreck pixel sprites (`render/sprites.ts`). `M`
 * and `y` share hexes with `theme.helicopterAccent` / `theme.devText` rather
 * than duplicating them.
 */
export const spritePalette = {
	// Living helicopter
	H: "#e0e4e8", // hull highlight - roof and tail boom
	D: "#454d56", // hullDark   - roof, shadow side, panel lines, hull outline
	M: theme.helicopterAccent, // hullMid    - main hull
	G: "#202c32", // glass      - cockpit canopy
	g: "#d0e4e8", // glassGlare - canopy glare
	K: "#636b72", // rotorBlack - mast, tail rotor, skids
	R: "#aab0b5", // rotorBlur  - main-rotor blur bar
	// Wreck
	C: "#17171c", // charDark    - blackened structure
	c: "#33323a", // charMid     - scorched panels
	r: "#d92b1a", // flameRed    - flame base
	o: "#ff8c1a", // flameOrange - flame mid
	y: theme.devText, // flameYellow - flame tips
	w: "#fff6d8", // flameCore    - white-hot core
} as const;

export type SpritePaletteKey = keyof typeof spritePalette;
