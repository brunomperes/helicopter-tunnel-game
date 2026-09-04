/**
 * Placeholder palette, drawn from the reference art (green blocky tunnel on
 * black, blue helicopter). Revisited in the deferred art pass.
 */
export const theme = {
	background: "#000000",
	letterbox: "#000000",
	tunnel: "#3ad12e",
	helicopter: "#bcd8ff",
	helicopterAccent: "#2b6fd8",
	hudText: "#ffffff",
	devText: "#ffe14d",
	overlayText: "#3ad12e",
	overlayScrim: "rgba(0, 0, 0, 0.55)",
	/** Resume countdown digit: white core + dark outline so it reads over the
	 * black gap and the green tunnel fill alike (there is no scrim behind it). */
	countdownText: "#ffffff",
	countdownOutline: "#000000",
	hudFont: "16px monospace",
	titleFont: "32px monospace",
	countdownFont: "bold 72px monospace",
} as const;
