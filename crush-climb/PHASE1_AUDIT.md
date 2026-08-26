# Phase 1 audit — V5.1 baseline

## Confirmed architecture debt

1. **Global mutable runtime state** — grid, current piece, falling pieces, queue, hold, runner, timers, stats, AI and VFX share one closure.
2. **Simulation and presentation are coupled** — game rules directly update DOM status text, result overlays, particles, shake and flashes.
3. **Rotation is mislabeled SRS** — orientation states exist, but pre-release rotation uses horizontal `[0,-1,1,-2,2]` correction rather than Guideline JLSTZ/I kick tables.
4. **Impossible changes physics** — current V5.1 gives the Impossible runner higher acceleration, max speed, jump impulse and special air-jump refresh behavior.
5. **Crush logic is embedded in falling-piece handling** — contact classification, displacement and death are not yet an isolated rule service.
6. **AI and live rules are separate approximations** — planning helpers simulate placements independently of the live runtime and can drift.
7. **Tests live inside production HTML** — useful checks exist, but they mutate globals and are not an external regression suite.

## Phase 1 decisions

- Preserve the current HTML unchanged as reference/playable fallback.
- Introduce one authoritative serializable `GameState`.
- Store the RNG seed in state.
- Route actions through `GameCommand`.
- Return semantic `GameEvent` values from the core.
- Keep current V5.1 timing and piece behavior as regression targets.
- Do not claim the legacy kick behavior is SRS.
- Do not wire the new core into production presentation until parity tests cover the migration boundary.

## Next correctness phase

1. canonical Tetris Guideline SRS
2. shared runner collision model using swept AABB
3. isolated compression-based CrushResolver
4. same runner physics for every difficulty
5. ForwardModel consuming the same rule functions as live simulation
