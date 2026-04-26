import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import type { CrosswordBoard, AllWordBounds } from './types';
import { useGridMap } from './hooks/useGridMap';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { getCell, isCellPlayable } from './utils/gridMap';

export interface CanvasGridProps {
  board: CrosswordBoard;
  selectedCell: { x: number; y: number } | null;
  direction: 'across' | 'down';
  allWordBounds: AllWordBounds | null;
  onCellClick: (x: number, y: number) => void;
  onCellChange?: (x: number, y: number, value: string) => void;
  editable?: boolean;
  answers?: Record<string, string>;
  isCompleted?: boolean;
  checkErrors?: boolean;
}

export function CanvasGrid({
  board,
  selectedCell,
  direction,
  allWordBounds,
  onCellClick,
  onCellChange,
  editable = false,
  answers = {},
  isCompleted = false,
  checkErrors = false,
}: CanvasGridProps) {
  const gridMap = useGridMap(board.grid);

  const { canvasRef, containerRef, getCellFromPoint } = useCanvasRenderer({
    board,
    gridMap,
    selectedCell,
    allWordBounds,
    editable,
    answers,
    isCompleted,
    checkErrors,
  });

  const { handleKeyDown } = useKeyboardNavigation({
    board,
    gridMap,
    selectedCell,
    direction,
    onCellClick,
    onCellChange,
    editable,
  });

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const point = getCellFromPoint(e.clientX, e.clientY);
      if (!point) return;

      const cell = getCell(gridMap, point.x, point.y);
      if (!isCellPlayable(cell) && !(editable && cell)) return;

      onCellClick(point.x, point.y);
    },
    [getCellFromPoint, gridMap, onCellClick, editable]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      const point = getCellFromPoint(touch.clientX, touch.clientY);
      if (!point) return;

      const cell = getCell(gridMap, point.x, point.y);
      if (!isCellPlayable(cell) && !(editable && cell)) return;

      onCellClick(point.x, point.y);
    },
    [getCellFromPoint, gridMap, onCellClick, editable]
  );

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileTap={{ scale: 0.997 }}
      className="relative w-full aspect-square"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Crossword puzzle grid"
        aria-roledescription="crossword grid"
        tabIndex={0}
        className="w-full h-full cursor-pointer rounded-sm shadow-[0_12px_30px_rgba(30,42,53,0.18)] outline-none focus-visible:ring-2 focus-visible:ring-cafe-gold focus-visible:ring-offset-2"
        style={{ touchAction: 'none' }}
      />

      {selectedCell && (
        <div className="sr-only" role="status" aria-live="polite">
          {`Selected cell: row ${selectedCell.y + 1}, column ${selectedCell.x + 1}. Direction: ${direction}.`}
        </div>
      )}
    </motion.div>
  );
}

export default CanvasGrid;
