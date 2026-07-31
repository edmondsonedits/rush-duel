# Rush Duel

Rush Duel is a neon, browser-based block battle that combines the polished interface from the newer prototype with the responsive synchronized-round gameplay from the smoother prototype.

The gameplay screen is built from responsive HTML, CSS, and canvas code. The original artwork remains as a subtle atmospheric background, while the boards, HUD, meters, and controls resize independently for phone, tablet, and desktop play.

## Gameplay design

- Seven-piece bag randomization keeps the sequence fair and learnable.
- SRS-style, piece-specific wall kicks make rotations dependable beside walls and stacks.
- Ghost pieces and a three-piece preview support planning without visual clutter.
- Tuned delayed auto-shift, repeat speed, soft drop, and last-pressed-direction handling keep keyboard and touch movement responsive.
- Desktop uses two full-size boards; portrait layouts devote at least 85% of the gameplay canvas height to the player's board while keeping the opponent readable in a compact rail.

The handling and presentation were informed by the open-source [Tetr.js](https://github.com/simonlc/tetr.js) project and the broader mode/UI ideas in [Techmino](https://github.com/26F-Studio/Techmino). Rush Duel retains its own shared-piece and rush-drop battle rules.

## Play modes

- **Solo Play:** Classic single-board Tetris with normal gravity, line-clear scoring, hard drop, and a device-local top-ten leaderboard. Enter a name after topping out to save the run.
- **Solo vs Bot:** Easy has no automatic rush timer, Medium adds one second to the normal timer, Hard plays slowly but chooses very strong placements, and Impossible stays readable while using Rush Drop much more aggressively.
- **Online Versus:** One player creates a six-character room code and the other joins it. The match uses a direct WebRTC data connection through PeerJS signaling, with the host acting as the authoritative game clock.

Online play needs internet access and two modern browsers. No game account is required. If a very restrictive network blocks direct WebRTC traffic, players may need to try a different network.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Move | Left / Right arrows | Move buttons |
| Soft drop | Down arrow | Soft Drop |
| Rotate left | Z or Q | Rotate Left |
| Rotate right | Up, X, or E | Rotate Right |
| Hard drop / Rush drop | Space | Hard Drop in Solo Play; Rush Drop in duels |
| Pause | P or Escape | Pause |

A rush drop locks both current pieces immediately. Every cleared line sends garbage directly to the opponent; simultaneous clears attack both boards instead of cancelling out. There is no line target: the match continues until a board tops out, and the last player with room wins.

## Run locally

Serve the folder with any static web server. For example:

```powershell
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Built-in checks

Open `index.html?selftest=1` to run the browser self-tests. They cover rotation stability, piece-specific wall-kick data, collision boundaries, classic line clearing and scoring, garbage routing, saved-score sanitizing and ordering, bot planning, difficulty timer and pacing guarantees, unique interface IDs, visible code-rendered controls, control mappings, and online-lobby availability.

## Project files

- `index.html` — complete production game and interface
- `Generic_Block_Game_Rush_Duel_Retro_Arcade.html` — original smoother gameplay prototype (local reference)
- `Rush_Duel_Exact_UI_Smooth_Gameplay.html` — original visual prototype (local reference)

The production page loads PeerJS 1.5.5 from a version-pinned CDN for online signaling.
