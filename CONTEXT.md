# Helicopter Tunnel Game

A browser game in the classic one-button "helicopter" lineage: a helicopter holds a
fixed horizontal screen position while a tunnel scrolls past; the player applies
upward thrust to avoid crashing into the tunnel. One run at a time, collision ends
it, distance travelled is the score.

## Language

**Helicopter**:
The player-controlled craft. Holds a fixed horizontal position on screen; only its
vertical position is under player control.
_Avoid_: Chopper, player, ship, craft

**Tunnel**:
The scrolling passage the helicopter flies through, bounded by a top and bottom
edge that undulate, with obstacles that intrude from either edge.
_Avoid_: Cave, cavern, corridor, level

**Run**:
A single play-through, from start to the crash that ends it. There is only ever one
run in progress.
_Avoid_: Game, round, attempt, life

**Thrust**:
The single player action: an upward force on the helicopter, applied while the input
is held and absent otherwise.
_Avoid_: Jump, flap, boost, lift

**Distance**:
How far the current run has progressed through the tunnel. This is the score.
_Avoid_: Score, points, length

**Crash**:
Contact between the helicopter and any tunnel geometry (an edge or an obstacle).
Ends the run.
_Avoid_: Death, collision, hit, game over

**Gap**:
The vertical open space between the top and bottom tunnel edge at a given point.
The difficulty ramp narrows the gap over time.
_Avoid_: Width, opening, corridor

**Slice**:
A fixed-width vertical segment of the tunnel; the unit in which the tunnel is
generated and discarded as it scrolls.
_Avoid_: Segment, column, chunk, strip

**Obstacle**:
A rectangular block that intrudes into the gap from the top or bottom edge.
_Avoid_: Block, wall, pillar, hazard

**Seed**:
The value that fully determines a run's tunnel. Random per run unless pinned via a
`?seed=` URL parameter.
_Avoid_: Key

**Ramp**:
The difficulty progression, expressed as a function of distance: scroll speed rises
and the gap narrows from their starting values to their caps, then hold constant.
Speed eases in more gradually than the gap (it ramps over a stretched distance) so a
run does not accelerate sharply.
_Avoid_: Difficulty curve, progression, scaling

## Run states

**Attract**:
The pre-run state: title, "press to start", best distance on show. No helicopter
simulation running.
_Avoid_: Menu, title screen, idle

**Flying**:
A run in progress: the helicopter is simulated and the tunnel scrolls.
_Avoid_: Playing, active, in-game

**Wrecked**:
The post-crash state: this run's distance shown against the best, "press to retry"
after a brief input lock.
_Avoid_: Game over, dead, results

### Pause

Pause is orthogonal to Attract / Flying / Wrecked — it is not a Run state. It is a
shell concern: while frozen, the shell simply stops calling the sim's `step`, so
the run and its determinism are untouched (ADR-0004). Pause exists only during a
run in progress; the pause key (`Esc` / `P`) is a no-op in Attract and Wrecked.

The shell holds one of three pause modes: `running` (the loop steps the sim),
`paused` (frozen, scrim + "PAUSED"), and `resuming` (frozen, a 1500 ms wall-clock
countdown — `3 → 2 → 1`, one digit per 500 ms — with only the digit drawn over
the frozen field, no scrim). Thrust on `paused` starts the countdown; at its end
the sim goes live with whatever thrust the player is then holding (the resuming
press is not specially consumed). `Esc` / `P` during the countdown returns to
`paused` and discards it, so the next thrust starts a fresh `3 → 2 → 1`. The
countdown is measured in real elapsed time, not sim ticks.
