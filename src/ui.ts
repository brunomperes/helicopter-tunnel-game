import type { HudModel } from "./render/index.js";
import { rampSpeed, type SimState } from "./sim/index.js";

export interface GameUi {
	readonly area: HTMLElement;
	update(state: SimState, hud: HudModel): void;
}

/** HTML text keeps its CSS size independent of the canvas transform. */
export function createGameUi(root: Pick<Document, "querySelector">): GameUi {
	const element = (id: string) => {
		const node = root.querySelector<HTMLElement>(`#${id}`);
		if (!node) throw new Error(`#${id} not found`);
		return node;
	};
	const area = element("play-area");
	const overlay = element("overlay");
	const title = element("overlay-title");
	const instructions = element("instructions");
	const retry = element("retry");
	const countdown = element("countdown");
	const distance = element("distance");
	const best = element("best");
	const dev = element("dev-readout");
	const setText = (node: HTMLElement, text: string) => {
		if (node.textContent !== text) node.textContent = text;
	};
	const setHidden = (node: HTMLElement, hidden: boolean) => {
		if (node.hidden !== hidden) node.hidden = hidden;
	};
	return {
		area,
		update(state, hud) {
			const attract = state.phase === "attract";
			const wrecked = state.phase === "wrecked";
			setHidden(overlay, !attract && !wrecked && !hud.paused);
			setText(
				title,
				hud.paused
					? "PAUSED"
					: attract
						? "TAP TO START"
						: state.distance >= hud.best && state.distance > 0
							? "NEW BEST"
							: "WRECKED",
			);
			setHidden(instructions, !attract || hud.paused);
			setHidden(retry, !wrecked || hud.paused);
			// Keep the prompt's space during the lock so the centred title stays still.
			const retryVisibility = state.restartLock !== 0 ? "hidden" : "visible";
			if (retry.style.visibility !== retryVisibility) retry.style.visibility = retryVisibility;
			setHidden(countdown, hud.resumeDigit === null);
			setText(countdown, hud.resumeDigit === null ? "" : String(hud.resumeDigit));
			setHidden(distance, attract);
			setText(distance, `DISTANCE: ${Math.floor(state.distance)}`);
			setText(best, `BEST: ${hud.best}`);
			setHidden(dev, !hud.dev);
			if (hud.dev)
				setText(
					dev,
					`SPEED: ${rampSpeed(state.config, state.distance).toFixed(1)} px/s · DIST: ${Math.floor(state.distance)}`,
				);
		},
	};
}
