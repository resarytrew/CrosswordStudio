import type { CrosswordBoard, WordBounds, AllWordBounds } from '../types';
import { type GridMap, getCell, isCellPlayable } from './gridMap';

export function getWordBoundsAtPosition(
  gridMap: GridMap,
  board: CrosswordBoard,
  x: number,
  y: number,
  dir: 'across' | 'down'
): WordBounds | null {
  const cell = getCell(gridMap, x, y);
  if (!isCellPlayable(cell)) return null;

  let startX = x;
  let startY = y;
  let endX = x;
  let endY = y;

  if (dir === 'across') {
    while (startX > 0 && isCellPlayable(getCell(gridMap, startX - 1, y))) {
      startX--;
    }
    while (endX < board.width - 1 && isCellPlayable(getCell(gridMap, endX + 1, y))) {
      endX++;
    }
  } else {
    while (startY > 0 && isCellPlayable(getCell(gridMap, x, startY - 1))) {
      startY--;
    }
    while (endY < board.height - 1 && isCellPlayable(getCell(gridMap, x, endY + 1))) {
      endY++;
    }
  }

  const length = dir === 'across' ? endX - startX + 1 : endY - startY + 1;

  if (length <= 1) return null;

  return { startX, startY, endX, endY, length };
}

export function isCellInWordBounds(
  x: number,
  y: number,
  allWordBounds: AllWordBounds | null
): boolean {
  if (!allWordBounds) return false;

  const { across, down } = allWordBounds;

  if (across) {
    if (y === across.startY && x >= across.startX && x <= across.endX) {
      return true;
    }
  }

  if (down) {
    if (x === down.startX && y >= down.startY && y <= down.endY) {
      return true;
    }
  }

  return false;
}