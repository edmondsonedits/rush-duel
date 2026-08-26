# Crush Climb Duel — architecture migration

This directory is the staged TypeScript migration of **Crush Climb Duel V5.1 — Smaller Runner**.

## Behavioral baseline

Phase 1 deliberately preserves the current playable game's important rules and timings while extracting deterministic state and command handling:

- 10×20 grid
- seeded 7-bag queue
- Hold lockout
- 1.30 s automatic planning timer
- 8.4 cells/s committed-piece fall speed
- multiple committed pieces in flight at once
- next planning piece appears immediately after commit
- runner size 0.58×0.86 cells
- line-clear attack values from V5.1
- 120 Hz fixed-step target

The legacy orientation tables and horizontal-only pre-release kick behavior are preserved *only as a compatibility baseline*. They are intentionally named `LEGACY_ORIENTATIONS` / `rotatePlanningPieceLegacy`, not SRS. Canonical Tetris Guideline SRS is a Phase-2 correctness change after regression coverage exists.

## Phase 1 architecture

`Input/Bot Policy -> GameCommand -> stepGame() -> GameState + GameEvent[]`

The core has no DOM, Canvas, Phaser, audio, particles, screen shake, or UI references.

### Files

- `src/core/types.ts` — authoritative state, commands and events
- `src/core/config.ts` — data-driven gameplay constants
- `src/core/random.ts` — deterministic LCG + 7-bag
- `src/core/GameCore.ts` — pure clone/step simulation boundary
- `src/tetris/TetrominoCore.ts` — grid-exact piece operations
- `src/tetris/legacyOrientations.ts` — V5.1 compatibility orientations
- `src/duel/AttackSystem.ts` — line attack resolution separated from rendering
- `tests/` — Vitest regression and architecture invariants

## Deliberately not migrated yet

The production HTML remains the playable reference while these are migrated and verified in later phases:

- full RunnerController movement loop
- swept-AABB collision replacement
- isolated CrushResolver
- canonical Guideline SRS kick tables
- ForwardModel shared by live game and AI
- BlockPlanner / RunnerPlanner
- Phaser presentation

This avoids a total rewrite and gives each later change a regression boundary.
