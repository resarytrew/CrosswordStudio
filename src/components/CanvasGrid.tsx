import React, { useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface CanvasGridProps {
  board: {
    width: number;
    height: number;
    grid: Array<{
      x: number;
      y: number;
      isBlock: boolean;
      isHidden?: boolean;
      value: string;
      number: number | null;
    }>;
    clues: {
      across: Array<{ number: number; text: string; x: number; y: number; length: number }>;
      down: Array<{ number: number; text: string; x: number; y: number; length: number }>;
    };
  };
  selectedCell: { x: number; y: number } | null;
  direction: 'across' | 'down';
  allWordBounds: {
    across: { startX: number; startY: number; endX: number; endY: number; length: number } | null;
    down: { startX: number; startY: number; endX: number; endY: number; length: number } | null;
  } | null;
  onCellClick: (x: number, y: number) => void;
  onCellChange?: (x: number, y: number, value: string) => void;
  editable?: boolean;
  answers?: Record<string, string>;
  isCompleted?: boolean;
}

const COLORS = {
  background: '#ffffff',
  gridLine: '#2C1810',
  cellBg: '#ffffff',
  blockBg: '#2C1810',
  letter: '#2C1810',
  number: '#666666',
  highlight: '#FBBF24',
  highlightWord: '#FEF3C7',
  selected: '#FCD34D',
  hover: '#F5F5F4',
  empty: '#FAFAF9',
  clueHighlight: '#FEF08A',
};

const FONTS = {
  letter: 'bold 24px Inter, sans-serif',
  number: 'bold 10px Inter, sans-serif',
};

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
}: CanvasGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellSizeRef = useRef(0);

  const getWordBoundsAtPosition = useCallback((x: number, y: number, dir: 'across' | 'down') => {
    const cell = board.grid.find(c => c.x === x && c.y === y);
    if (!cell || cell.isBlock || cell.isHidden) return null;

    let startX = x, startY = y;
    let endX = x, endY = y;

    if (dir === 'across') {
      while (startX > 0) {
        const c = board.grid.find(c => c.x === startX - 1 && c.y === y);
        if (c && !c.isBlock && !c.isHidden) startX--;
        else break;
      }
      while (endX < board.width - 1) {
        const c = board.grid.find(c => c.x === endX + 1 && c.y === y);
        if (c && !c.isBlock && !c.isHidden) endX++;
        else break;
      }
    } else {
      while (startY > 0) {
        const c = board.grid.find(c => c.x === x && c.y === startY - 1);
        if (c && !c.isBlock && !c.isHidden) startY--;
        else break;
      }
      while (endY < board.height - 1) {
        const c = board.grid.find(c => c.x === x && c.y === endY + 1);
        if (c && !c.isBlock && !c.isHidden) endY++;
        else break;
      }
    }

    return { startX, startY, endX, endY, length: dir === 'across' ? endX - startX + 1 : endY - startY + 1 };
  }, [board]);

  const isCellInWord = useCallback((x: number, y: number) => {
    if (!allWordBounds) return false;
    const { across, down } = allWordBounds;
    
    if (across && x >= across.startX && x <= across.endX && y >= across.startY && y <= across.endY) {
      return true;
    }
    if (down && x >= down.startX && x <= down.endX && y >= down.startY && y <= down.endY) {
      return true;
    }
    return false;
  }, [allWordBounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    cellSizeRef.current = size / board.width;
    
    canvas.width = size;
    canvas.height = size;
    
    const cellSize = cellSizeRef.current;
    const lineWidth = 2;
    const padding = lineWidth / 2;

    ctx.fillStyle = COLORS.cellBg;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = lineWidth;
    for (let x = 0; x <= board.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, size);
      ctx.stroke();
    }
    for (let y = 0; y <= board.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(size, y * cellSize);
      ctx.stroke();
    }

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid.find(c => c.x === x && c.y === y);
        if (!cell) continue;

        const cellX = x * cellSize;
        const cellY = y * cellSize;

        let bgColor = COLORS.cellBg;
        let strokeColor = COLORS.gridLine;
        let lineW = lineWidth;
        
        const isSelected = selectedCell?.x === x && selectedCell?.y === y;
        const inWord = isCellInWord(x, y);

        if (cell.isBlock && !cell.isHidden) {
          bgColor = COLORS.cellBg;
          strokeColor = 'transparent';
        } else if (cell.isHidden) {
          bgColor = COLORS.cellBg;
          strokeColor = 'transparent';
        } else if (isSelected) {
          bgColor = COLORS.selected;
        } else if (inWord) {
          bgColor = COLORS.highlightWord;
        } else {
          bgColor = COLORS.cellBg;
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(cellX + padding, cellY + padding, cellSize - lineWidth, cellSize - lineWidth);

        if (strokeColor !== 'transparent') {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineW;
          ctx.strokeRect(cellX + padding, cellY + padding, cellSize - lineWidth, cellSize - lineWidth);
        }

        if (cell.number && !cell.isBlock && !cell.isHidden) {
          ctx.fillStyle = COLORS.number;
          ctx.font = FONTS.number;
          const textX = cellX + 4;
          const textY = cellY + 12;
          ctx.fillText(cell.number.toString(), textX, textY);
        }

        const displayValue = editable ? cell.value : (answers[`${x},${y}`] || '');
        if (displayValue && !cell.isBlock && !cell.isHidden) {
          ctx.fillStyle = isCompleted && cell.value === displayValue ? COLORS.highlight : COLORS.letter;
          ctx.font = FONTS.letter;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayValue, cellX + cellSize / 2, cellY + cellSize / 2 + 2);
        }
      }
    }
  }, [board, selectedCell, allWordBounds, isCellInWord, editable, answers, isCompleted]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cellSize = cellSizeRef.current;
    if (cellSize === 0) return;

    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    if (gridX >= 0 && gridX < board.width && gridY >= 0 && gridY < board.height) {
      onCellClick(gridX, gridY);
    }
  }, [board.width, board.height, onCellClick]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-full aspect-square"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-full cursor-pointer rounded-sm shadow-lg"
        style={{ touchAction: 'none' }}
      />
    </motion.div>
  );
}