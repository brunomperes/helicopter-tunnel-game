/**
 * Every gameplay constant lives here and is injected into the sim (see Q15 in the
 * design and ADR-0002). Values are placeholders to be tuned during the TDD /
 * playtest phase. Units: pixels and seconds, y-down (matching the canvas).
 */

export interface Config {
	/** Fixed simulation rate. Render is decoupled from this. */
	readonly tickHz: number;

	readonly world: {
		/** Logical canvas size; scaled + letterboxed to the viewport. */
		readonly width: number;
		readonly height: number;
	};

	readonly physics: {
		/** Downward acceleration, px/s². */
		readonly gravity: number;
		/** Upward acceleration while thrust is held, px/s². Must exceed gravity. */
		readonly thrust: number;
		/** Vertical speed clamp, px/s (applied symmetrically). */
		readonly terminalVelocity: number;
	};

	readonly helicopter: {
		readonly width: number;
		readonly height: number;
		/** Fixed horizontal position as a fraction of world width. */
		readonly xFrac: number;
	};

	readonly scroll: {
		/** Scroll speed at the start of a run, px/s. */
		readonly startSpeed: number;
		/** Scroll speed at the end of the ramp, px/s. */
		readonly capSpeed: number;
	};

	readonly tunnel: {
		/** Width of a generated slice, px. */
		readonly sliceWidth: number;
		/** Gap (vertical opening) at the start of a run, px. */
		readonly startGap: number;
		/** Gap at the end of the ramp, px. */
		readonly capGap: number;
		/** Spacing between obstacles, px. */
		readonly obstacleInterval: number;
		/** Fewest slices an obstacle block spans. */
		readonly obstacleMinSlices: number;
		/** Most slices an obstacle block spans. */
		readonly obstacleMaxSlices: number;
		/** Slack kept between the effective opening and the helicopter height, px. */
		readonly clearance: number;
		/**
		 * Fraction of the helicopter's per-slice reachable vertical distance that an
		 * edge is allowed to move (< 1 leaves the player reaction headroom). ADR-0003.
		 */
		readonly followFactor: number;
	};

	readonly ramp: {
		/** Distance over which speed and gap ease from start to cap, px. */
		readonly distance: number;
		/** Opening stretch with max centred gap and no obstacles, px. */
		readonly graceDistance: number;
	};

	/** Ticks after a crash before input can start a new run. */
	readonly restartLockTicks: number;
}

export const defaultConfig: Config = {
	tickHz: 120,
	world: { width: 960, height: 540 },
	physics: {
		gravity: 900,
		thrust: 1800,
		terminalVelocity: 520,
	},
	helicopter: {
		width: 46,
		height: 20,
		xFrac: 0.28,
	},
	scroll: {
		startSpeed: 180,
		capSpeed: 360,
	},
	tunnel: {
		sliceWidth: 24,
		startGap: 320,
		capGap: 180,
		obstacleInterval: 340,
		obstacleMinSlices: 3,
		obstacleMaxSlices: 7,
		clearance: 64,
		followFactor: 0.6,
	},
	ramp: {
		distance: 4800,
		graceDistance: 1200,
	},
	restartLockTicks: 60,
};
