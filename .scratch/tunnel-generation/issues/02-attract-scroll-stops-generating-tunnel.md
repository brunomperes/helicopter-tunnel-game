# Attract-mode scroll runs off the end of the generated tunnel (screen goes black)

Status: ready-for-agent

## Repro

1. Launch the game and leave it on the attract screen (do not tap).
2. Watch the background scroll.
3. After roughly one screen-width of scroll the tunnel rock stops appearing:
   the play area is just the flat background colour with the "TAP TO START"
   overlay. It never recovers.

## Root cause

`scrollDemo` (`src/sim/index.ts`, the `attract` branch of `step`) advances
`state.distance` every tick but never extends the tunnel:

```ts
function scrollDemo(state: SimState): SimState {
	const dt = 1 / state.config.tickHz;
	return {
		...state,
		tick: state.tick + 1,
		distance: state.distance + state.config.scroll.startSpeed * dt,
	};
}
```

`createInitialState` only generates `lookaheadSlices` past distance 0, and
`advanceRun` (the `flying` branch) is the only place that wraps its result in
`ensureTunnel`. So in attract mode the tunnel is fixed at its initial ~1.2
screens; once the demo scroll passes that, `drawTunnel` finds
`state.tunnel[i] === undefined` for every visible slice and draws nothing ->
black screen.

## Fix

Wrap `scrollDemo`'s return value in `ensureTunnel`, the same way `advanceRun`
does:

```ts
return ensureTunnel({
	...state,
	tick: state.tick + 1,
	distance: state.distance + state.config.scroll.startSpeed * dt,
});
```

## Test

Add a sim test alongside the existing "idles the demo scroll" case
(`src/sim/sim.test.ts:255`): step attract mode for enough ticks to scroll
several screen-widths, then assert every slice under
`[distance, distance + world.width]` is defined (or that the generated tunnel
length keeps up with `distance`).

## Comments
