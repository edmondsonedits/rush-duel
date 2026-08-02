# Rush Duel

Rush Duel is a neon browser-based falling-block battle for mobile and desktop. It includes classic solo play, four bot difficulties, and synchronized online duels.

## Production build

The live game now uses a single maintainable production entry instead of the former V10 → V11 → V12 runtime patch chain:

- `index.html` — accessible application shell and menus
- `assets/game-v13.css` — responsive presentation and mobile layout
- `assets/core-v13.js` — stable core export surface
- `assets/core-rules-v13.js` — pieces, board rules, rotations, and bot evaluation
- `assets/core-game-v13.js` — match lifecycle, timers, rush rules, garbage, and snapshots
- `assets/bot-worker-v13.js` — off-main-thread Hard and Impossible planning
- `assets/network-v13.js` — versioned host-authoritative online protocol and guest prediction
- `assets/app-v13.js` — ordered application loader
- `assets/app-v13-part1.js` — app state, menus, bots, scores, and online callbacks
- `assets/app-v13-part2.js` — canvas renderer, HUD, particles, and sound
- `assets/app-v13-part3.js` — controls, gestures, frame loop, wiring, and browser checks

The previous prototype and numbered launcher files remain in the repository only as historical references. They are no longer required to load the live game.

## Game modes

### Solo Play

Classic single-board play with seven-bag randomization, ghost pieces, SRS-style wall kicks, lock delay, increasing levels, scoring, combos, and device-local high scores.

### Solo vs Bot

Both boards receive the same piece. Rush Drop locks both active pieces, cleared lines send garbage, and the match continues until a board tops out.

- **Easy:** no round clock or manual bot rushes
- **Medium:** forgiving clock and occasional mistakes
- **Hard:** two-piece beam search with strategic rush timing
- **Impossible:** three-piece beam search with no intentional placement errors

Hard and Impossible planning runs in a Web Worker so search does not block animation or touch input.

### Online Versus

The host is authoritative for gravity, locks, garbage, scoring, and the round clock. Guest controls are predicted locally, assigned sequence numbers, acknowledged by host snapshots, and replayed only while unacknowledged. This avoids the previous move-back-move correction effect.

Online messages use protocol version 13. Match start is repeated until acknowledged, snapshots are ordered, and reconnection attempts preserve the current room when possible.

## Duel rules

- Both players receive the same piece sequence.
- A manual Rush Drop has a ten-second cooldown.
- A piece resting untouched for one second forces both active pieces to lock.
- Every cleared line sends garbage to the opponent.
- Simultaneous clears attack both boards rather than cancelling.
- The last board standing wins.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Left / Right | Arrow buttons or horizontal swipe |
| Soft drop | Down | Down button or downward swipe |
| Rotate left | Z or Q | Left rotate button |
| Rotate right | Up, X, or E | Right rotate button or tap board |
| Hard/Rush drop | Space | Drop button or upward swipe |
| Pause | P or Escape | Pause button in offline modes |

## Validation

Run the dependency-free validation suite with:

```bash
node tests/validate.mjs
```

It checks core rules, rotations, collision, corrected hole metrics, snapshots, legal bot planning, online input reconciliation, HTML/JavaScript wiring, file structure, and an expert-bot planning budget. GitHub Actions runs the same suite on pushes and pull requests.
