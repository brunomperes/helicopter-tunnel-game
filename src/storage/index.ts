/**
 * Persists only the best distance, as one integer under one key. Falls back to an
 * in-memory value for the session if `localStorage` is unavailable (private mode,
 * disabled cookies) — never throws.
 */

const KEY = "htg.best";

let memoryBest = 0;

function readStore(): Storage | null {
	try {
		const s = window.localStorage;
		const probe = "__htg_probe__";
		s.setItem(probe, "1");
		s.removeItem(probe);
		return s;
	} catch {
		return null;
	}
}

export function loadBest(): number {
	const store = readStore();
	if (!store) return memoryBest;
	const raw = store.getItem(KEY);
	const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Store `distance` if it beats the stored best. Returns the resulting best. */
export function saveBest(distance: number): number {
	const best = Math.max(loadBest(), Math.floor(distance));
	memoryBest = best;
	readStore()?.setItem(KEY, String(best));
	return best;
}
