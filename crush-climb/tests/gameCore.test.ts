import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/core/config';
import { createGameState, freshGrid, PIECE_TYPES, stepGame } from '../src/core/GameCore';
import { shuffledBag } from '../src/core/random';
import { cellsForLegacy, pieceWidth } from '../src/tetris/TetrominoCore';

function snapshot(state: ReturnType<typeof createGameState>): string {
  return JSON.stringify(state);
}

describe('Crush Climb V5.1 behavioral baseline', () => {
  it('uses a 10x20 matrix and exactly seven tetromino types', () => {
    const grid = freshGrid();
    expect(grid).toHaveLength(20);
    expect(grid[0]).toHaveLength(10);
    expect(PIECE_TYPES).toHaveLength(7);
    expect(new Set(PIECE_TYPES).size).toBe(7);
  });

  it('produces each tetromino exactly once per 7-bag', () => {
    const result = shuffledBag(0x12345678);
    expect(result.bag).toHaveLength(7);
    expect(new Set(result.bag)).toEqual(new Set(PIECE_TYPES));
  });

  it('preserves the V5.1 timing constants', () => {
    expect(GAME_CONFIG.fixedDt).toBe(1 / 120);
    expect(GAME_CONFIG.dropSpeed).toBe(8.4);
    expect(GAME_CONFIG.playerAimLimit).toBe(1.30);
    expect(GAME_CONFIG.das).toBeGreaterThan(GAME_CONFIG.arr);
    expect(GAME_CONFIG.arr).toBeLessThanOrEqual(0.03);
  });

  it('preserves the smaller runner dimensions', () => {
    const state = createGameState(1234);
    expect(state.runner.w).toBe(0.58);
    expect(state.runner.h).toBe(0.86);
  });

  it('preserves legacy O and I orientation dimensions as a compatibility baseline', () => {
    expect(pieceWidth(cellsForLegacy('O', 0))).toBe(2);
    expect(pieceWidth(cellsForLegacy('I', 0))).toBe(4);
    expect(pieceWidth(cellsForLegacy('I', 1))).toBe(1);
  });

  it('spawns the next planning piece immediately after commit while the prior piece remains in flight', () => {
    const initial = createGameState(77, 'block', 'easy');
    const first = initial.current?.type;
    const result = stepGame(initial, 0, [{ type: 'BlockCommit' }]);

    expect(first).toBeDefined();
    expect(result.state.fallingPieces).toHaveLength(1);
    expect(result.state.fallingPieces[0].type).toBe(first);
    expect(result.state.current).not.toBeNull();
    expect(result.events.some(event => event.type === 'PieceCommitted')).toBe(true);
    expect(result.events.some(event => event.type === 'PieceSpawned')).toBe(true);
  });

  it('enforces one Hold use per planning piece', () => {
    const initial = createGameState(101, 'block', 'easy');
    const once = stepGame(initial, 0, [{ type: 'BlockHold' }]).state;
    const beforeSecondHold = snapshot(once);
    const twice = stepGame(once, 0, [{ type: 'BlockHold' }]).state;

    expect(once.holdUsed).toBe(true);
    expect(snapshot(twice)).toBe(beforeSecondHold);
  });

  it('is deterministic for identical seed and command streams', () => {
    const a0 = createGameState(0xdecafbad, 'block', 'hard');
    const b0 = createGameState(0xdecafbad, 'block', 'hard');

    const commands = [
      [{ type: 'BlockMove', direction: -1 } as const],
      [{ type: 'BlockRotate', direction: 1 } as const],
      [{ type: 'BlockCommit' } as const],
      [] as const,
      [] as const,
    ];

    let a = a0;
    let b = b0;
    for (const frameCommands of commands) {
      a = stepGame(a, GAME_CONFIG.fixedDt, frameCommands).state;
      b = stepGame(b, GAME_CONFIG.fixedDt, frameCommands).state;
    }

    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('stores deterministic RNG state inside the authoritative GameState', () => {
    const state = createGameState(555);
    expect(Number.isInteger(state.seed)).toBe(true);
    expect(state.seed).toBeGreaterThanOrEqual(0);
  });
});
