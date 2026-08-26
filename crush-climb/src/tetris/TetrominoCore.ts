import { GAME_CONFIG } from '../core/config';
import type { Cell, Grid, PieceType, TetrominoPiece } from '../core/types';
import { LEGACY_ORIENTATIONS } from './legacyOrientations';

export function cloneCells(cells: readonly Cell[]): Cell[] {
  return cells.map(([x, y]) => [x, y] as const);
}

export function normalizeCells(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY] as const);
}

export function cellsForLegacy(type: PieceType, orientation = 0): Cell[] {
  const index = ((orientation % 4) + 4) % 4;
  return normalizeCells(cloneCells(LEGACY_ORIENTATIONS[type][index]));
}

export function pieceWidth(cells: readonly Cell[]): number {
  return Math.max(...cells.map(([x]) => x)) + 1;
}

export function pieceHeight(cells: readonly Cell[]): number {
  return Math.max(...cells.map(([, y]) => y)) + 1;
}

export function cellsAt(piece: TetrominoPiece, yOverride: number | null = null): { x: number; y: number }[] {
  const y = yOverride === null ? piece.y : yOverride;
  return piece.cells.map(([cx, cy]) => ({ x: piece.x + cx, y: y + cy }));
}

export function collidesOnGrid(piece: TetrominoPiece, grid: Grid, yOverride = piece.y): boolean {
  for (const cell of cellsAt(piece, yOverride)) {
    if (cell.x < 0 || cell.x >= GAME_CONFIG.cols || cell.y >= GAME_CONFIG.rows) return true;
    if (cell.y >= 0 && grid[cell.y][cell.x]) return true;
  }
  return false;
}

export function landingY(piece: TetrominoPiece, grid: Grid): number {
  let y = -pieceHeight(piece.cells);
  while (!collidesOnGrid(piece, grid, y + 1)) y++;
  return y;
}

export function normalizePieceX(piece: TetrominoPiece): TetrominoPiece {
  const width = pieceWidth(piece.cells);
  return { ...piece, x: Math.max(0, Math.min(GAME_CONFIG.cols - width, piece.x)) };
}

export function makePlanningPiece(type: PieceType): TetrominoPiece {
  const cells = cellsForLegacy(type, 0);
  const width = pieceWidth(cells);
  return {
    type,
    orientation: 0,
    cells,
    x: Math.floor((GAME_CONFIG.cols - width) / 2),
    y: -pieceHeight(cells),
    falling: false,
    lockedChoice: false,
  };
}

export function movePlanningPiece(piece: TetrominoPiece, direction: -1 | 1): TetrominoPiece {
  return normalizePieceX({ ...piece, x: piece.x + direction });
}

export function rotatePlanningPieceLegacy(piece: TetrominoPiece, direction: -1 | 1): TetrominoPiece {
  if (piece.falling) return piece;
  const oldOrientation = piece.orientation;
  const oldX = piece.x;
  const orientation = ((oldOrientation + direction) % 4 + 4) % 4;
  const cells = cellsForLegacy(piece.type, orientation);
  const kicks = [0, -1, 1, -2, 2];

  for (const dx of kicks) {
    const candidate = normalizePieceX({ ...piece, orientation, cells, x: oldX + dx });
    if (candidate.x >= 0 && candidate.x + pieceWidth(candidate.cells) <= GAME_CONFIG.cols) return candidate;
  }

  return normalizePieceX({ ...piece, orientation: oldOrientation, cells: cellsForLegacy(piece.type, oldOrientation), x: oldX });
}
