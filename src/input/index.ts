/**
 * Collapses every physical input (mouse, Space / ArrowUp, touch) into one
 * `thrustHeld` boolean. The only browser-bound part of the input path.
 */

const THRUST_KEYS = new Set(["Space", "ArrowUp"]);

export interface InputSource {
	/** True while any thrust input is currently held. */
	readonly thrustHeld: boolean;
	dispose(): void;
}

export function createInputSource(target: HTMLElement): InputSource {
	let pointer = false;
	let touch = false;
	const keys = new Set<string>();

	const onKeyDown = (e: KeyboardEvent) => {
		if (THRUST_KEYS.has(e.code)) {
			keys.add(e.code);
			e.preventDefault();
		}
	};
	const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
	const onPointerDown = () => {
		pointer = true;
	};
	const onPointerUp = () => {
		pointer = false;
	};
	const onTouchStart = (e: TouchEvent) => {
		touch = true;
		e.preventDefault();
	};
	const onTouchEnd = (e: TouchEvent) => {
		touch = e.touches.length > 0;
	};
	const onBlur = () => {
		pointer = false;
		touch = false;
		keys.clear();
	};

	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	target.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("pointerup", onPointerUp);
	target.addEventListener("touchstart", onTouchStart, { passive: false });
	window.addEventListener("touchend", onTouchEnd);
	window.addEventListener("blur", onBlur);

	return {
		get thrustHeld() {
			return pointer || touch || keys.size > 0;
		},
		dispose() {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			target.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointerup", onPointerUp);
			target.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("blur", onBlur);
		},
	};
}
