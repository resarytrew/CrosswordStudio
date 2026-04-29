import { useCallback, type KeyboardEvent } from 'react';
import type { CrosswordBoard } from '../types';
import { type GridMap, getCell, isCellPlayable } from '../utils/gridMap';

interface UseKeyboardNavigationParams {
  board: CrosswordBoard;
  gridMap: GridMap;
  selectedCell: { x: number; y: number } | null;
  direction: 'across' | 'down';
  onCellClick: (x: number, y: number) => void;
  onCellChange?: (x: number, y: number, value: string) => void;
  editable: boolean;
}

export function useKeyboardNavigation(params: UseKeyboardNavigationParams) {
  const { board, gridMap, selectedCell, direction, onCellClick, onCellChange, editable } = params;

  const findNextPlayableCell = useCallback(
    (startX: number, startY: number, dx: number, dy: number): { x: number; y: number } | null => {
      let x = startX + dx;
      let y = startY + dy;

      while (x >= 0 && x < board.width && y >= 0 && y < board.height) {
        const cell = getCell(gridMap, x, y);
        if (isCellPlayable(cell)) {
          return { x, y };
        }
        x += dx;
        y += dy;
      }

      return null;
    },
    [board.width, board.height, gridMap]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!selectedCell) return;

      const { x, y } = selectedCell;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const next = findNextPlayableCell(x, y, 0, -1);
          if (next) onCellClick(next.x, next.y);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const next = findNextPlayableCell(x, y, 0, 1);
          if (next) onCellClick(next.x, next.y);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const next = findNextPlayableCell(x, y, -1, 0);
          if (next) onCellClick(next.x, next.y);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const next = findNextPlayableCell(x, y, 1, 0);
          if (next) onCellClick(next.x, next.y);
          break;
        }
        case 'Backspace': {
          e.preventDefault();
          if (!editable || !onCellChange) break;
          onCellChange(x, y, '');
          const dx = direction === 'across' ? -1 : 0;
          const dy = direction === 'down' ? -1 : 0;
          const prev = findNextPlayableCell(x, y, dx, dy);
          if (prev) onCellClick(prev.x, prev.y);
          break;
        }
        case 'Delete': {
          e.preventDefault();
          if (!editable || !onCellChange) break;
          onCellChange(x, y, '');
          break;
        }
        default: {
          if (!editable || !onCellChange) break;

          const letter = e.key.toUpperCase();
          if (/^[A-ZА-ЯЁ]$/.test(letter)) {
            e.preventDefault();
            onCellChange(x, y, letter);

            const dx = direction === 'across' ? 1 : 0;
            const dy = direction === 'down' ? 1 : 0;
            const next = findNextPlayableCell(x, y, dx, dy);
            if (next) onCellClick(next.x, next.y);
          }
          break;
        }
      }
    },
    [selectedCell, direction, editable, onCellChange, onCellClick, findNextPlayableCell]
  );

  return { handleKeyDown };
}
