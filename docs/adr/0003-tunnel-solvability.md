# Tunnel generation guarantees solvability

The tunnel generator enforces two invariants at generation time: the effective gap
(after obstacles) is always at least the helicopter height plus a clearance margin,
and the per-slice change in each edge's position is clamped below the vertical
distance the helicopter can physically cover as that slice scrolls past (derived
from scroll speed, thrust accel, gravity, and terminal velocity). An obstacle is a
block spanning one or more consecutive slices from a single edge at one depth, and
distinct obstacles are always parted by at least one clear slice. The corridor
centre is held fixed for the length of a block so its edges read level. The result:
every tunnel the generator can produce is completable by a perfect player, so every
crash is player error, never an RNG death.

We considered leaving generation unconstrained — random edge offsets and obstacle
placement, as in SFCave and similar — which is simpler and gives wilder variety.
We rejected it because legible failure ("I could have made that") is what drives
the retry loop for this game, and cheap deaths work against that. The cost: the
generator is more complex and coupled to the physics constants, extreme tunnel
shapes are clipped, and difficulty can only be tuned through the `Ramp`, not
through generation nastiness.
