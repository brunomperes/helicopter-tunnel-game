# Hand-rolled Canvas 2D, no game engine

The game is a single one-button mode with flat-shape rendering and a small fixed
scope (see `CONTEXT.md`). We considered a game engine or framework (Phaser, Pixi,
Kaboom) and rejected it: the engine's scene graph, asset pipeline, and physics
would all go unused, it adds a large dependency and its own concepts to learn, and
it works against the deterministic pure-core design in ADR-0002. We render directly
to a `CanvasRenderingContext2D` and own the loop ourselves. Runtime dependencies
for the core game stay at zero; Vite, TypeScript, and Vitest are dev-only.

The cost: anything an engine gives for free (text layout, tweening, spritesheets,
audio mixing) we write or pull in piecemeal if and when juice work needs it.
