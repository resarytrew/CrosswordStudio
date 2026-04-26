import type { BoardState } from '../types';

export function parseBoardState(raw: unknown): BoardState | null {
  try {
    if (!isValidBoardState(raw)) {
      console.error('Invalid board state structure');
      return null;
    }
    return raw as BoardState;
  } catch (e) {
    console.error('Failed to parse board state:', e);
    return null;
  }
}

export function isValidBoardState(obj: unknown): obj is BoardState {
  if (!obj || typeof obj !== 'object') return false;
  const b = obj as Record<string, unknown>;
  return (
    typeof b.width === 'number' &&
    typeof b.height === 'number' &&
    typeof b.grid === 'object' &&
    Array.isArray(b.grid) &&
    b.grid.length === (b.width as number) * (b.height as number) &&
    typeof b.clues === 'object' &&
    b.clues !== null &&
    Array.isArray((b.clues as Record<string, unknown>).across) &&
    Array.isArray((b.clues as Record<string, unknown>).down)
  );
}