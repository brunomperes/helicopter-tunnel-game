/**
 * Seeded PRNG for the sim. The generator state is a plain 32-bit number so it can
 * live inside `SimState` and `step` stays a pure function. See ADR-0002.
 */

/** Hash an arbitrary seed string into a 32-bit integer (cyrb53, truncated). */
export function hashSeed(seed: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < seed.length; i++) {
		const ch = seed.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (h2 >>> 0) ^ (h1 >>> 0);
}

/**
 * Advance a mulberry32 generator once.
 * @returns `[value, nextState]` where `value` is in `[0, 1)`.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
	const a = (state + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	return [value, a];
}

/** Advance the generator and return a value in `[min, max)`. */
export function nextRange(
	state: number,
	min: number,
	max: number,
): [value: number, nextState: number] {
	const [v, next] = nextRandom(state);
	return [min + v * (max - min), next];
}
