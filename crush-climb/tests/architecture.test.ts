import { describe, expect, it } from 'vitest';
import { createGameState, stepGame } from '../src/core/GameCore';
import type { GameCommand } from '../src/core/types';

describe('GameCore architecture boundaries', () => {
  it('does not mutate the previous GameState while stepping', () => {
    const previous = createGameState(42, 'block', 'easy');
    const before = JSON.stringify(previous);

    stepGame(previous, 1 / 120, [{ type: 'BlockMove', direction: 1 }]);

    expect(JSON.stringify(previous)).toBe(before);
  });

  it('accepts gameplay intent through explicit commands', () => {
    const command: GameCommand = { type: 'BlockRotate', direction: 1 };
    const previous = createGameState(43, 'block', 'easy');
    const result = stepGame(previous, 0, [command]);

    expect(result.state.current?.orientation).toBe(1);
  });

  it('returns semantic events rather than presentation instructions', () => {
    const previous = createGameState(44, 'block', 'easy');
    const result = stepGame(previous, 0, [{ type: 'BlockCommit' }]);
    const committed = result.events.find(event => event.type === 'PieceCommitted');

    expect(committed).toBeDefined();
    expect(result.events.some(event => 'element' in event || 'particle' in event || 'screenShake' in event)).toBe(false);
  });
});
