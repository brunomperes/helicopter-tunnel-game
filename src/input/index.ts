/**
 * Collapses every physical input (mouse, Space / ArrowUp, touch) into one
 * `thrustHeld` boolean. The only browser-bound part of the input path.
 */

export const THRUST_KEYS = new Set(["Space", "ArrowUp"]);

export interface InputSource {
	/** True while any thrust input is currently held. */
	readonly thrustHeld: boolean;
	dispose(): void;
}

/** Notify the shell immediately on a fresh thrust press, including brief taps. */
export function createInputSource(onThrustPress: () => void = () => {}): InputSource {
	const pointers = new Set<number>();
	let touch = false;
	const keys = new Set<string>();

	const onKeyDown = (e: KeyboardEvent) => {
		if (THRUST_KEYS.has(e.code)) {
			const fresh = !e.repeat && !keys.has(e.code);
			keys.add(e.code);
			e.preventDefault();
			if (fresh) onThrustPress();
		}
	};
	const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
	const onPointerDown = (e: PointerEvent) => {
		// Ignore non-primary buttons (e.g. right-click) so opening a context menu
		// can't leave a pointer held — the matching pointerup isn't
		// guaranteed to fire once the browser's native menu takes over.
		if (e.button !== 0) return;
		const fresh = !pointers.has(e.pointerId);
		pointers.add(e.pointerId);
		if (fresh) onThrustPress();
	};
	const onPointerUp = (e: PointerEvent) => {
		pointers.delete(e.pointerId);
	};
	const onTouchStart = (e: TouchEvent) => {
		const fresh = !touch;
		touch = true;
		e.preventDefault();
		if (fresh) onThrustPress();
	};
	const onTouchEnd = (e: TouchEvent) => {
		touch = e.touches.length > 0;
	};
	const onBlur = () => {
		pointers.clear();
		touch = false;
		keys.clear();
	};

	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("touchstart", onTouchStart, { passive: false });
	window.addEventListener("touchend", onTouchEnd);
	window.addEventListener("blur", onBlur);

	return {
		get thrustHeld() {
			return pointers.size > 0 || touch || keys.size > 0;
		},
		dispose() {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("blur", onBlur);
		},
	};
}
