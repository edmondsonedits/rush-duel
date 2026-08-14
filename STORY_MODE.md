# Pixel Journey — Story Mode V69

Pixel Journey is the story-driven falling-block campaign for Tetris Duel.

## Core loop

- A real tetromino falls down the 10×20 playfield toward a piece-shaped slot.
- Move and rotate the piece so its four cells exactly match the slot.
- A correct placement completes the frame, triggers the clear sweep, moves the cleared pixel row upward, and reduces its opacity in 20% steps as later frames advance.
- A wrong placement shatters and disappears without corrupting the board. The same frame can be retried at the cost of one heart.
- Three lost hearts rewind to the latest four-frame checkpoint.

## Campaign

Ten chapters reuse the game's block-art language: Crown, Rocket, Ghost, Heart, Cat Face, Flame, Smiley, Saturn, Turtles, and Lightning Bolt. Each chapter contains eight placement frames, for an 80-placement campaign that gradually adds harder tetrominoes, rotations, edge placements, reduced target assistance, and faster falling speed.

## Controls

- Left / Right: move
- Rotate-left / Rotate-right: rotate
- Drop: immediately test the current placement
- Touch: buttons, horizontal swipes, tap to rotate, downward swipe to drop
- Keyboard: arrows, Z/Q, X/E/Up, Space/Down, P/Escape

Progress, best score, and chapter unlocks are stored locally on the device. Story Mode uses the production tetromino matrices and rotation profiles from the Rush Duel core and the published Challenge artwork when available.
