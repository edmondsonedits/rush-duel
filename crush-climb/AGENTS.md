# Avalanche / Crush Climb — Engineering Charter

This file is the repository-local source of truth for AI-assisted engineering in `crush-climb/`.

## Core hierarchy

Always preserve this dependency direction:

**game rules -> deterministic simulation -> AI -> presentation**

Rendering, VFX, UI, audio and bot-specific behavior may observe or command the simulation, but they must never redefine game rules.

Prefer a small deterministic architecture with explicit state transitions over hidden mutation and accumulating special cases.

## Required architecture

The target boundaries are:

- `GameCore` — deterministic fixed-step orchestration
- `GameState` — one authoritative serializable state
- `TetrominoCore` — grid-exact tetromino rules
- `RunnerController` — kinematic character controller
- `CrushResolver` — isolated compression predicate
- `DuelRules` / `AttackSystem` — asymmetric rule resolution
- `ForwardModel` — renderer-free future simulation using the live rules
- `BotPolicies` — AI strategies that emit the same commands as humans
- Phaser presentation — scenes, renderer, camera, input, animation, tweens and VFX
- Vitest — automated regression tests

The simulation must be runnable without DOM, Canvas, Phaser, audio or presentation state.

Conceptual boundary:

`Input or BotPolicy -> GameCommand -> GameCore.step() -> GameState + GameEvent[]`

## Technology choices

Use TypeScript, Vite, Phaser 3 and Vitest.

Do not introduce Three.js, Matter.js, React, Redux, ECS, neural networks or another framework merely because it exists. Three.js is for a deliberate 3D transition, not this 2D grid/kinematic game. Do not use a general rigid-body engine for authoritative tetromino locking.

Use libraries for solved infrastructure problems. Keep custom code for mechanics unique to Crush Climb.

## Determinism

Use a deterministic fixed timestep. Presentation frame rate must not affect gameplay.

Store all gameplay randomness as seeded state. Replays must be reproducible from:

`initial seed + ordered command stream`

Human and AI actions must enter the simulation through the same command vocabulary.

Do not allow AI code to mutate authoritative state directly.

## Tetromino terminology and correctness

Use correct Tetris terminology:

- 10x20 visible matrix
- seven tetrominoes
- 7-bag randomizer
- Hold and Hold lockout
- canonical orientation states
- Tetris Guideline Super Rotation System
- JLSTZ wall-kick table
- separate I-piece kick table
- O-piece rotation behavior
- spawn orientation
- top-out
- DAS
- ARR

Do not call a simplified rotation system SRS.

The current Phase-1 `LEGACY_ORIENTATIONS` and `rotatePlanningPieceLegacy` exist only to preserve V5.1 behavior while refactoring. Replace them with canonical Guideline SRS in the dedicated correctness phase, with tests.

Unique Crush Climb rule: the block player plans position/orientation before release. Once committed, a tetromino falls automatically and cannot be steered. A new planning piece appears immediately even while previous committed pieces remain in flight. Preserve this asynchronous multi-piece mechanic.

All tetromino placement, collision, locking and row clearing must remain grid-exact and deterministic.

## Runner vocabulary

Implement the runner as a **kinematic character controller** using explicit concepts:

- ground acceleration
- air acceleration
- friction / deceleration
- gravity
- terminal velocity
- jump impulse
- coyote time
- jump buffering
- variable jump height
- apex gravity modifier
- wall detection
- wall climb
- wall jump
- optional air jump only if retained by game design

The target collision approach is **swept AABB / continuous collision detection** against settled blocks and moving tetromino cells.

Do not resolve movement with arbitrary repeated micro-step loops unless a mathematically justified fallback is documented and tested.

Keep movement constants data-driven.

Human and bot runners must use the same physical capabilities. Difficulty must not secretly increase acceleration, jump height, maximum speed, air jumps, collision forgiveness or other physics.

## Crush rule — invariant

Touching a falling tetromino is not death.

Side contact is nonlethal.

A descending piece may push/carry the runner downward when valid free displacement exists.

The runner dies only when both are true:

1. a descending tetromino produces downward contact against the runner's upper collision surface; and
2. the runner cannot be displaced along that downward motion because settled terrain, arena boundary or another non-displaceable obstacle blocks the required escape displacement.

Implement this as an isolated `CrushResolver` compression predicate with regression tests.

Never casually alter this rule while changing movement.

## Duel rules and attacks

Keep asymmetric game rules custom.

Line clears should flow through semantic events and data-driven resolution:

`LineCleared -> AttackResolver -> StatusEffects`

Status effects require explicit duration, magnitude, stacking rule and affected capability.

Do not bury line-attack behavior inside runner movement functions.

## Forward model

Create one deterministic `ForwardModel` that snapshots/clones `GameState` and simulates legal futures without rendering.

The AI must use the same rule functions as the live game. Do not maintain a separate approximate tetromino/rules implementation that can drift.

Use state hashing and a transposition cache when search cost justifies them.

## Block Master AI

Use recognized planning vocabulary and algorithms:

- legal action enumeration
- deterministic forward model
- heuristic evaluation function
- beam search
- planning horizon
- receding-horizon planning
- state hashing
- transposition cache

Enumerate legal orientations, horizontal placements, legal Hold decisions and known queue information.

Evaluation features may include immediate crush opportunity, runner interception, route denial, corridor compression, runner progress loss, line-attack value, future kill potential, holes, aggregate height, bumpiness, top-out risk and future board sustainability.

Weights belong in configuration, not scattered magic numbers.

Impossible may search deeper/wider and execute more accurately. It may not invent pieces, violate Hold/queue rules or receive privileged physics.

## Runner AI

The runner must reason about traversal rather than selecting only an X column.

Construct a dynamic traversal/reachability graph. Nodes may represent standable surfaces, ledges, wall-climb sections, wall-jump launch regions and landing regions. Edges may represent walk, jump, fall, wall climb, wall jump and any retained legal air jump.

Use **A\*** for strategic summit routing.

Use a **time-expanded hazard map** for committed falling tetrominoes, representing predicted danger in `(x, y, t)`.

Combine strategic routing with short-horizon **Utility AI / receding-horizon evasive planning** for immediate actions.

## Difficulty architecture

Use a `DifficultyProfile` or Strategy-based policy rather than broad `if (difficulty === ...)` branches throughout unrelated systems.

Difficulty may vary:

- reaction latency
- planning depth
- beam width
- future horizon
- action-selection noise
- positional/execution error
- queue awareness

Difficulty must not change core physics.

## Presentation

Treat Phaser as a presentation layer.

It may own sprites, animation, cameras, particles, screen shake, tweens, responsive scaling and touch controls. It must not own authoritative gameplay positions or collision rules.

Use interpolation between simulation ticks when helpful.

Visual polish must never implicitly alter collision geometry.

## Semantic events

Prefer events such as:

- `PieceCommitted`
- `PieceLanded`
- `LineCleared`
- `RunnerLanded`
- `RunnerWallJumped`
- `RunnerCrushed`
- `AttackTriggered`
- `RunnerReachedSummit`
- `MatchEnded`

Presentation systems subscribe to these. `GameCore` must not directly manipulate DOM elements, particles, audio or screen shake.

## Testing requirements

Use Vitest.

At minimum cover:

### Tetromino invariants
- every 7-bag contains all seven pieces once
- Hold legality
- canonical SRS rotations and kicks after SRS migration
- top-out
- row clears
- concurrent falling pieces
- deterministic landing

### Runner invariants
- coyote jump
- jump buffer
- variable jump
- wall climb
- wall jump
- one-cell passage clearance
- no tunnelling

### Crush invariants
- side contact safe
- overhead contact with free displacement safe
- moving-block riding safe
- genuine compression kills
- line clears do not place the runner inside solids

### AI invariants
- only legal pieces/actions
- Hold rules obeyed
- Impossible gets no physical advantage
- identical state/seed/action produces identical result

Every practical bug fix should add a regression test.

## Refactor order

Do not perform a total rewrite.

1. extract deterministic `GameCore`
2. formalize `GameState`, commands and events
3. correct Guideline SRS
4. rebuild runner collision with swept AABB
5. isolate `CrushResolver`
6. unify live and forward simulation
7. rebuild bot architecture
8. migrate presentation to Phaser
9. polish visuals/audio

Preserve a playable reference and verify each migration boundary before replacing it.

## Complexity rule

Before adding a subsystem, ask:

1. Is the problem already solved by the browser, Phaser, Vite, Vitest or another mature library?
2. Is the behavior unique enough to Crush Climb to remain custom?
3. Is there a recognized game-development algorithm/pattern for it?
4. Does it fit the `GameState + Command + Event` architecture?
5. Is the abstraction actually simpler than the current implementation?

Do not add architecture for hypothetical requirements.

## Vocabulary-first translation

Translate vague requests into recognized engineering concepts before coding.

- "make movement smoother" -> kinematic controller, acceleration curves, coyote time, jump buffering, apex gravity, swept AABB
- "make Impossible actually impossible" -> deeper beam search, larger planning horizon, deterministic forward model, time-expanded hazard prediction, optimal legal execution
- "make Tetris accurate" -> Tetris Guideline, SRS kick tables, 7-bag, Hold rules, DAS, ARR
- "stop weird block collisions" -> continuous collision detection, swept AABB, contact classification, compression predicate
- "clean up the code" -> simulation/presentation separation, single source of truth, pure state transitions, commands, events, strategies, data-driven config

## Final objective

Do not maximize code.

Maximize **clarity, determinism, game feel and maintainability** while preserving the unique asymmetric gameplay.
