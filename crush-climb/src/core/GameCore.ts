import { GAME_CONFIG } from './config';
import { PIECE_TYPES, shuffledBag } from './random';
import type { Difficulty, GameCommand, GameEvent, GameState, Grid, PieceType, Role, StepResult, TetrominoPiece } from './types';
import { applyLegacyLineAttack } from '../duel/AttackSystem';
import {
  cellsAt,
  cloneCells,
  landingY,
  makePlanningPiece,
  movePlanningPiece,
  pieceHeight,
  rotatePlanningPieceLegacy,
} from '../tetris/TetrominoCore';

export function freshGrid(): Grid {
  return Array.from({ length: GAME_CONFIG.rows }, () => Array<PieceType | null>(GAME_CONFIG.cols).fill(null));
}

function initialRunner() {
  return {
    x: GAME_CONFIG.cols / 2 - 0.29,
    y: GAME_CONFIG.runner.startY,
    w: GAME_CONFIG.runner.width,
    h: GAME_CONFIG.runner.height,
    vx: 0,
    vy: 0,
    grounded: false,
    wall: 0 as const,
    coyote: 0,
    jumpBuffer: 0,
    airJump: true,
    wallClimb: GAME_CONFIG.runner.wallClimbCapacity,
    wallClimbLock: 0,
    slowTimer: 0,
    stunTimer: 0,
    dead: false,
    aiTargetX: GAME_CONFIG.cols / 2,
    aiDecision: 0,
  };
}

function ensureQueue(state: GameState, minLength = 10): void {
  while (state.nextQueue.length < minLength) {
    const result = shuffledBag(state.seed);
    state.seed = result.seed;
    state.nextQueue.push(...result.bag);
  }
}

function spawnPiece(state: GameState, events: GameEvent[]): void {
  ensureQueue(state);
  const type = state.nextQueue.shift()!;
  ensureQueue(state);
  state.current = makePlanningPiece(type);
  state.pieceCount++;
  state.aimTime = GAME_CONFIG.playerAimLimit;
  state.holdUsed = false;
  events.push({ type: 'PieceSpawned', piece: type });
}

export function createGameState(seed: number, selectedRole: Role = 'runner', difficulty: Difficulty = 'easy'): GameState {
  const state: GameState = {
    version: 1,
    phase: 'playing',
    selectedRole,
    difficulty,
    seed: seed >>> 0,
    tick: 0,
    elapsed: 0,
    grid: freshGrid(),
    current: null,
    fallingPieces: [],
    nextQueue: [],
    holdType: null,
    holdUsed: false,
    aimTime: GAME_CONFIG.playerAimLimit,
    pieceCount: 0,
    runner: initialRunner(),
    tetrisStats: { score: 0, lines: 0, combo: -1, lastClear: 0, b2b: false },
    winner: null,
    endReason: null,
  };
  ensureQueue(state);
  const events: GameEvent[] = [];
  spawnPiece(state, events);
  return state;
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    grid: state.grid.map(row => row.slice()),
    current: state.current ? { ...state.current, cells: cloneCells(state.current.cells) } : null,
    fallingPieces: state.fallingPieces.map(piece => ({ ...piece, cells: cloneCells(piece.cells) })),
    nextQueue: state.nextQueue.slice(),
    runner: { ...state.runner },
    tetrisStats: { ...state.tetrisStats },
  };
}

function endMatch(state: GameState, events: GameEvent[], winner: Role, reason: string): void {
  if (state.phase !== 'playing') return;
  state.phase = 'ended';
  state.winner = winner;
  state.endReason = reason;
  events.push({ type: 'MatchEnded', winner, reason });
}

function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function settledCollision(state: GameState, x: number, y: number): boolean {
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

function crushRunner(state: GameState, events: GameEvent[]): void {
  if (state.runner.dead) return;
  state.runner.dead = true;
  events.push({ type: 'RunnerCrushed' });
  endMatch(state, events, 'block', 'The runner was squished.');
}

function resolveLegacyFallingContact(state: GameState, events: GameEvent[], piece: TetrominoPiece, previousY: number, nextY: number): boolean {
  const runner = state.runner;
  if (runner.dead) return false;
  const cells = cellsAt(piece, nextY);
  const touching = cells.filter(c => rectsOverlap(c.x, c.y, 1, 1, runner.x, runner.y, runner.w, runner.h));
  if (!touching.length) return false;

  const fallDelta = Math.max(0, nextY - previousY);
  const overhead = touching.some(c => {
    const local = piece.cells.find(([cx, cy]) => piece.x + cx === c.x && Math.abs((nextY + cy) - c.y) < 0.001);
    if (!local) return false;
    return previousY + local[1] + 1 <= runner.y + 0.24 || c.y < runner.y + 0.20;
  });

  if (!overhead) {
    const center = touching.reduce((sum, c) => sum + c.x + 0.5, 0) / touching.length;
    runner.vx += Math.sign((runner.x + runner.w / 2) - center || 1) * 0.45;
    return false;
  }

  const tryY = runner.y + fallDelta + 0.018;
  if (fallDelta > 0 && tryY <= GAME_CONFIG.rows - runner.h && !settledCollision(state, runner.x, tryY)) {
    runner.y = tryY;
    runner.vy = Math.max(runner.vy, fallDelta * 60);
    return false;
  }

  const blockedBelow = settledCollision(state, runner.x, runner.y + 0.075) || runner.y + runner.h >= GAME_CONFIG.rows - 0.02;
  if (overhead && blockedBelow) {
    crushRunner(state, events);
    return true;
  }
  return false;
}

function holdCurrent(state: GameState, events: GameEvent[]): void {
  if (!state.current || state.current.falling || state.holdUsed) return;
  const outgoing = state.current.type;
  if (state.holdType) {
    state.current = makePlanningPiece(state.holdType);
  } else {
    ensureQueue(state);
    state.current = makePlanningPiece(state.nextQueue.shift()!);
    ensureQueue(state);
  }
  state.holdType = outgoing;
  state.holdUsed = true;
  state.aimTime = GAME_CONFIG.playerAimLimit;
  events.push({ type: 'PieceSpawned', piece: state.current.type });
}

function commitCurrent(state: GameState, events: GameEvent[]): void {
  if (!state.current || state.current.falling) return;
  const released: TetrominoPiece = {
    ...state.current,
    cells: cloneCells(state.current.cells),
    falling: true,
    lockedChoice: true,
    y: -pieceHeight(state.current.cells) - 0.2,
  };
  state.fallingPieces.push(released);
  events.push({ type: 'PieceCommitted', piece: released.type, x: released.x, orientation: released.orientation });
  state.current = null;
  // Core Crush Climb rule: planning for the next piece starts immediately.
  spawnPiece(state, events);
}

function clearLines(state: GameState, events: GameEvent[]): void {
  const clearedRows: number[] = [];
  for (let y = GAME_CONFIG.rows - 1; y >= 0; y--) {
    if (state.grid[y].every(Boolean)) {
      clearedRows.push(y);
      state.grid.splice(y, 1);
      state.grid.unshift(Array<PieceType | null>(GAME_CONFIG.cols).fill(null));
      y++;
      if (state.runner.y < y) state.runner.y = Math.min(GAME_CONFIG.rows - state.runner.h, state.runner.y + 1);
    }
  }

  const cleared = clearedRows.length;
  if (!cleared) {
    state.tetrisStats.combo = -1;
    return;
  }

  const previousB2B = state.tetrisStats.b2b;
  const b2b = cleared === 4 && previousB2B;
  state.tetrisStats.lines += cleared;
  state.tetrisStats.lastClear = cleared;
  state.tetrisStats.combo++;
  const base = [0, 100, 300, 500, 800][cleared] ?? 800;
  const b2bBonus = b2b ? 400 : 0;
  state.tetrisStats.score += base + b2bBonus + Math.max(0, state.tetrisStats.combo) * 50;
  state.tetrisStats.b2b = cleared === 4;

  events.push({ type: 'LineCleared', count: cleared, rows: clearedRows, b2b });
  const attackEvent = applyLegacyLineAttack(state, cleared, b2b);
  if (attackEvent) events.push(attackEvent);
}

function lockPiece(state: GameState, events: GameEvent[], piece: TetrominoPiece): boolean {
  const y = Math.round(piece.y);
  const locked = cellsAt(piece, y);
  if (locked.some(c => c.y < 0)) {
    endMatch(state, events, 'runner', 'The stack reached the ceiling.');
    return false;
  }

  const touching = locked.some(c => rectsOverlap(c.x, c.y, 1, 1, state.runner.x, state.runner.y, state.runner.w, state.runner.h));
  if (touching) {
    const blockedBelow = settledCollision(state, state.runner.x, state.runner.y + 0.08) || state.runner.y + state.runner.h >= GAME_CONFIG.rows - 0.02;
    const overhead = locked.some(c => c.y < state.runner.y + 0.1 && Math.abs((c.x + 0.5) - (state.runner.x + state.runner.w / 2)) < 0.75);
    if (overhead && blockedBelow) {
      crushRunner(state, events);
      return false;
    }
  }

  for (const c of locked) if (c.y >= 0) state.grid[c.y][c.x] = piece.type;
  events.push({ type: 'PieceLanded', piece: piece.type, x: piece.x, y });
  clearLines(state, events);
  return state.phase === 'playing';
}

function applyCommand(state: GameState, events: GameEvent[], command: GameCommand): void {
  if (state.phase !== 'playing') return;
  switch (command.type) {
    case 'BlockMove':
      if (state.current && !state.current.falling) state.current = movePlanningPiece(state.current, command.direction);
      break;
    case 'BlockRotate':
      if (state.current && !state.current.falling) state.current = rotatePlanningPieceLegacy(state.current, command.direction);
      break;
    case 'BlockHold':
      holdCurrent(state, events);
      break;
    case 'BlockCommit':
      commitCurrent(state, events);
      break;
    case 'RunnerInput':
      // Phase 1 formalizes this command but leaves movement migration to RunnerController.
      // The legacy runtime remains the playable reference until that migration is verified.
      if (command.jumpPressed) state.runner.jumpBuffer = Math.max(state.runner.jumpBuffer, 0.13);
      break;
  }
}

export function stepGame(previous: GameState, dt: number, commands: readonly GameCommand[] = []): StepResult {
  const state = cloneGameState(previous);
  const events: GameEvent[] = [];
  if (state.phase !== 'playing') return { state, events };

  for (const command of commands) applyCommand(state, events, command);
  if (state.phase !== 'playing') return { state, events };

  state.tick++;
  state.elapsed += dt;
  state.aimTime -= dt;
  if (state.aimTime <= 0) commitCurrent(state, events);

  // Preserve V5.1 ordering: lower pieces settle before pieces above them.
  state.fallingPieces.sort((a, b) => b.y - a.y);
  for (let i = 0; i < state.fallingPieces.length; i++) {
    const piece = state.fallingPieces[i];
    const previousY = piece.y;
    const targetY = landingY(piece, state.grid);
    piece.y = Math.min(targetY, piece.y + GAME_CONFIG.dropSpeed * dt);
    resolveLegacyFallingContact(state, events, piece, previousY, piece.y);
    if (state.phase !== 'playing') break;
    if (piece.y >= targetY - 0.0001) {
      lockPiece(state, events, piece);
      state.fallingPieces.splice(i, 1);
      i--;
      if (state.phase !== 'playing') break;
    }
  }

  return { state, events };
}

export { PIECE_TYPES };
