export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Role = 'runner' | 'block';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';
export type MatchPhase = 'playing' | 'ended';
export type Cell = readonly [number, number];
export type GridCell = PieceType | null;
export type Grid = GridCell[][];

export interface TetrominoPiece {
  type: PieceType;
  orientation: number;
  cells: Cell[];
  x: number;
  y: number;
  falling: boolean;
  lockedChoice: boolean;
}

export interface RunnerState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  grounded: boolean;
  wall: -1 | 0 | 1;
  coyote: number;
  jumpBuffer: number;
  airJump: boolean;
  wallClimb: number;
  wallClimbLock: number;
  slowTimer: number;
  stunTimer: number;
  dead: boolean;
  aiTargetX: number;
  aiDecision: number;
}

export interface TetrisStats {
  score: number;
  lines: number;
  combo: number;
  lastClear: number;
  b2b: boolean;
}

export interface GameState {
  version: 1;
  phase: MatchPhase;
  selectedRole: Role;
  difficulty: Difficulty;
  seed: number;
  tick: number;
  elapsed: number;
  grid: Grid;
  current: TetrominoPiece | null;
  fallingPieces: TetrominoPiece[];
  nextQueue: PieceType[];
  holdType: PieceType | null;
  holdUsed: boolean;
  aimTime: number;
  pieceCount: number;
  runner: RunnerState;
  tetrisStats: TetrisStats;
  winner: Role | null;
  endReason: string | null;
}

export type GameCommand =
  | { type: 'BlockMove'; direction: -1 | 1 }
  | { type: 'BlockRotate'; direction: -1 | 1 }
  | { type: 'BlockHold' }
  | { type: 'BlockCommit' }
  | { type: 'RunnerInput'; horizontal: -1 | 0 | 1; jumpHeld: boolean; jumpPressed?: boolean };

export type GameEvent =
  | { type: 'PieceSpawned'; piece: PieceType }
  | { type: 'PieceCommitted'; piece: PieceType; x: number; orientation: number }
  | { type: 'PieceLanded'; piece: PieceType; x: number; y: number }
  | { type: 'LineCleared'; count: number; rows: number[]; b2b: boolean }
  | { type: 'AttackTriggered'; attack: 'Frost' | 'Shockwave' | 'Whiteout' | 'Avalanche' | 'SuperAvalanche'; lines: number }
  | { type: 'RunnerCrushed' }
  | { type: 'RunnerReachedSummit' }
  | { type: 'MatchEnded'; winner: Role; reason: string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
