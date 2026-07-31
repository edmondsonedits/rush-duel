# Rush Duel

Rush Duel is a neon, browser-based block battle that combines the polished interface from the newer prototype with the responsive synchronized-round gameplay from the smoother prototype.

## Play modes

- **Solo vs Bot:** Easy, Medium, Hard, and Impossible opponents. Easy never triggers a rush drop; higher difficulties react and rush more aggressively.
- **Online Versus:** One player creates a six-character room code and the other joins it. The match uses a direct WebRTC data connection through PeerJS signaling, with the host acting as the authoritative game clock.

Online play needs internet access and two modern browsers. No game account is required. If a very restrictive network blocks direct WebRTC traffic, players may need to try a different network.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Move | Left / Right arrows | Move buttons |
| Soft drop | Down arrow | Soft Drop |
| Rotate left | Z or Q | Rotate Left |
| Rotate right | Up, X, or E | Rotate Right |
| Rush drop | Space | Rush Drop |
| Pause | P or Escape | Pause |

A rush drop locks both current pieces immediately. Clearing two or more lines sends garbage to the opponent. The first player to 20 lines, or the last player with room on the board, wins.

## Run locally

Serve the folder with any static web server. For example:

```powershell
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Built-in checks

Open `index.html?selftest=1` to run the browser self-tests. They cover piece rotation, collision boundaries, line clearing and scoring, garbage rows, bot planning, unique interface IDs, unique touch-control mappings, and online-lobby availability.

## Project files

- `index.html` — complete production game and interface
- `Generic_Block_Game_Rush_Duel_Retro_Arcade.html` — original smoother gameplay prototype (local reference)
- `Rush_Duel_Exact_UI_Smooth_Gameplay.html` — original visual prototype (local reference)

The production page loads PeerJS 1.5.5 from a version-pinned CDN for online signaling.
