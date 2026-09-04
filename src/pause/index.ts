/**
 * Shell-only pause state. Orthogonal to the sim's `Phase`: a frozen tick just
 * means the shell chose not to call `step`, so sim determinism (ADR-0002) is
 * untouched. See ADR-0004.
 *
 * Three modes: `running` (the loop steps the sim), `paused` (frozen, scrim +
 * "PAUSED"), and `resuming` (frozen, a wall-clock countdown ticking down before
 * the sim goes live again). Thrust on `paused` starts the countdown; the pause
 * key on `resuming` drops back to `paused` and discards the countdown.
 *
 * Two things freeze a run: the explicit pause key, and the tab being hidden
 * mid-flight (auto-pause). Auto-pause is a one-way trip into `paused` — returning
 * to the tab never auto-resumes; leaving `paused` is always an explicit thrust.
 */

import type { Phase } from "../sim/index.js";

/** Wall-clock duration of the resume countdown, ms. */
export const RESUME_COUNTDOWN_MS = 1500;
/** Milliseconds each countdown digit is shown (`3` -> `2` -> `1`). */
export const COUNTDOWN_DIGIT_MS = 500;

export type PauseState =
	| { readonly mode: "running" }
	| { readonly mode: "paused" }
	/** Counting down to live; `msLeft` starts at `RESUME_COUNTDOWN_MS`. */
	| { readonly mode: "resuming"; readonly msLeft: number };

export const RUNNING: PauseState = { mode: "running" };
export const PAUSED: PauseState = { mode: "paused" };
const resuming = (msLeft: number): PauseState => ({ mode: "resuming", msLeft });

export type PauseEvent =
	/** The player pressed the pause key (Esc / P). Carries the current run phase. */
	| { readonly type: "pauseKey"; readonly phase: Phase }
	/** The tab became hidden (auto-pause). Carries the current run phase. */
	| { readonly type: "tabHidden"; readonly phase: Phase }
	/** The player pressed thrust (Space / ArrowUp). */
	| { readonly type: "thrust" }
	/** A frame elapsed: advance the resume countdown by `elapsedMs` wall-clock ms. */
	| { readonly type: "tick"; readonly elapsedMs: number };

/** Fold a pause event into the current state. Pure. */
export function reducePause(state: PauseState, event: PauseEvent): PauseState {
	switch (event.type) {
		case "pauseKey":
		case "tabHidden":
			// The pause key and the tab going hidden both mean "freeze now". From a
			// live run, freeze only mid-flight (a no-op in attract / wrecked). From
			// `resuming`, drop back to `paused` and discard the countdown so the next
			// thrust starts fresh. Nothing here moves `paused` -> `running`: leaving
			// the pause screen is always an explicit thrust, so a hidden tab that
			// becomes visible again just stays paused.
			if (state.mode === "running") {
				return event.phase === "flying" ? PAUSED : state;
			}
			return state.mode === "resuming" ? PAUSED : state;
		case "thrust":
			// Thrust is the sole resume trigger: it starts the countdown from
			// `paused`. Mid-countdown it does nothing — the press is not consumed,
			// it just carries through to the first live tick.
			return state.mode === "paused" ? resuming(RESUME_COUNTDOWN_MS) : state;
		case "tick": {
			if (state.mode !== "resuming") return state;
			const msLeft = state.msLeft - event.elapsedMs;
			return msLeft <= 0 ? RUNNING : resuming(msLeft);
		}
	}
}

/**
 * The countdown digit to show for `msLeft`: `ceil(msLeft / 500)`. Callers only
 * reach this while `resuming`, where `msLeft` is always in `(0, 1500]`.
 */
export function countdownDigit(msLeft: number): number {
	return Math.ceil(msLeft / COUNTDOWN_DIGIT_MS);
}
