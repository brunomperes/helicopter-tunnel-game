/**
 * Shell-only pause state. Orthogonal to the sim's `Phase`: "paused" just means
 * the shell chose not to call `step` this tick, so sim determinism (ADR-0002)
 * is untouched. See ADR-0004.
 */

import type { Phase } from "../sim/index.js";

export type PauseMode = "running" | "paused";

export type PauseEvent =
	/** The player pressed the pause key (Esc / P). Carries the current run phase. */
	| { readonly type: "pauseKey"; readonly phase: Phase }
	/** The player pressed thrust (Space / ArrowUp). */
	| { readonly type: "thrust" };

/** Fold a pause event into the current mode. Pure. */
export function reducePause(mode: PauseMode, event: PauseEvent): PauseMode {
	switch (event.type) {
		case "pauseKey":
			// Pause only makes sense mid-run; a no-op in attract / wrecked.
			return mode === "running" && event.phase === "flying" ? "paused" : mode;
		case "thrust":
			// Thrust is the sole resume in slice 1 (no countdown — that is slice 2).
			return mode === "paused" ? "running" : mode;
	}
}
