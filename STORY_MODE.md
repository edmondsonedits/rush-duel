# Pixel Journey — Story Mode V80

Pixel Journey is the story-driven falling-block campaign for Tetris Duel.

## Core loop

- A real tetromino falls down the 10×20 playfield toward a piece-shaped slot.
- Move and rotate the piece so its four cells exactly match the slot.
- A correct placement completes the frame, triggers the clear sweep, moves the cleared pixel row upward, and reduces its opacity in 20% steps as later frames advance.
- A wrong placement shatters and disappears without corrupting the board. The same frame can be retried at the cost of one heart.
- Three incorrect placements restart the current lesson. Time, board height, and conveyor movement never remove hearts.

## Campaign

Ten lessons reuse the game's block-art language: Clouds, Crown, Rocket, Ghost, Heart, Cat Face, Flame, Saturn, Turtles, and Lightning Bolt. The course grows from single placements into multi-piece lookahead, well-building, and a final Tetris payoff.

Easy keeps the lesson stationary. Medium places the next lesson underneath the current board and moves the continuous story upward exactly one row every second. At the safe decision line, the conveyor holds until the active piece is placed.

## Controls

- Left / Right: move
- Rotate-left / Rotate-right: rotate
- Drop: immediately test the current placement
- Touch: buttons; hold Left or Right for fast auto-repeat
- Keyboard: arrows, Z/Q, X/E/Up, Space/Down, P/Escape

Progress, best score, and chapter unlocks are stored locally on the device. Story Mode uses the production tetromino matrices and rotation profiles from the Rush Duel core and the published Challenge artwork when available.