import type { PieceType } from './types';

export const PIECE_TYPES: readonly PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

export function nextRandom(seed: number): { seed: number; value: number } {
  const nextSeed = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { seed: nextSeed, value: nextSeed / 4294967296 };
}

export function shuffledBag(seed: number): { seed: number; bag: PieceType[] } {
  const bag = [...PIECE_TYPES];
  let cursor = seed >>> 0;
  for (let i = bag.length - 1; i > 0; i--) {
    const r = nextRandom(cursor);
    cursor = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return { seed: cursor, bag };
}
