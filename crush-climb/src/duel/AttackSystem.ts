import { GAME_CONFIG } from '../core/config';
import type { GameEvent, GameState, RunnerState } from '../core/types';

type AttackName = 'Frost' | 'Shockwave' | 'Whiteout' | 'Avalanche' | 'SuperAvalanche';

function isSettledCollision(state: GameState, x: number, y: number): boolean {
  const eps = 0.02;
  const left = Math.floor(x + eps);
  const right = Math.floor(x + state.runner.w - eps);
  const top = Math.floor(y + eps);
  const bottom = Math.floor(y + state.runner.h - eps);
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (col < 0 || col >= GAME_CONFIG.cols || row >= GAME_CONFIG.rows) return true;
      if (row >= 0 && state.grid[row][col]) return true;
    }
  }
  return false;
}

export function applyLegacyLineAttack(state: GameState, lines: number, b2b: boolean): GameEvent | null {
  const runner: RunnerState = state.runner;
  let attack: AttackName | null = null;

  if (lines === 1) {
    runner.slowTimer = Math.max(runner.slowTimer, 1.0);
    attack = 'Frost';
  } else if (lines === 2) {
    runner.slowTimer = Math.max(runner.slowTimer, 1.5);
    runner.vy = Math.max(runner.vy, 3.2);
    attack = 'Shockwave';
  } else if (lines === 3) {
    runner.slowTimer = Math.max(runner.slowTimer, 2.0);
    runner.wallClimbLock = Math.max(runner.wallClimbLock, 1.25);
    runner.vy = Math.max(runner.vy, 5.2);
    attack = 'Whiteout';
  } else if (lines >= 4) {
    runner.slowTimer = Math.max(runner.slowTimer, 3.0);
    runner.wallClimbLock = Math.max(runner.wallClimbLock, b2b ? 3.1 : 2.35);
    runner.stunTimer = Math.max(runner.stunTimer, b2b ? 0.58 : 0.42);
    runner.airJump = false;
    runner.vy = Math.max(runner.vy, 7.0);
    for (let i = 0; i < 12; i++) {
      const nextY = runner.y + 0.10;
      if (isSettledCollision(state, runner.x, nextY) || nextY > GAME_CONFIG.rows - runner.h) break;
      runner.y = nextY;
    }
    attack = b2b ? 'SuperAvalanche' : 'Avalanche';
  }

  return attack ? { type: 'AttackTriggered', attack, lines } : null;
}
