import type { CrosswordCell, CrosswordBoard, AllWordBounds } from '../types';
import { COLORS, LAYOUT } from '../constants';
import { type GridMap, getCell, cellKey } from '../utils/gridMap';
import { isCellInWordBounds } from '../utils/wordBounds';

export interface DrawContext {
  board: CrosswordBoard;
  gridMap: GridMap;
  selectedCell: { x: number; y: number } | null;
  allWordBounds: AllWordBounds | null;
  editable: boolean;
  answers: Record<string, string>;
  isCompleted: boolean;
  checkErrors: boolean;
}

export function drawFullGrid(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  totalWidth: number,
  totalHeight: number,
  drawCtx: DrawContext
): void {
  drawBackground(ctx, totalWidth, totalHeight);
  drawHiddenCells(ctx, cellSize, drawCtx);
  drawCells(ctx, cellSize, drawCtx);
  drawGridLines(ctx, cellSize, drawCtx.board.width, drawCtx.board.height, totalWidth, totalHeight);
  drawCellOverlays(ctx, cellSize, drawCtx);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
}

function drawHiddenCells(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  drawCtx: DrawContext
): void {
  const { board, gridMap } = drawCtx;

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(gridMap, x, y);
      if (!cell || !cell.isHidden) continue;

      const px = x * cellSize;
      const py = y * cellSize;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(px, py, cellSize, cellSize);

      const rightCell = getCell(gridMap, x + 1, y);
      if (rightCell && rightCell.isHidden) {
        ctx.fillRect(px + cellSize - LAYOUT.lineWidth, py, LAYOUT.lineWidth, cellSize);
      }

      const bottomCell = getCell(gridMap, x, y + 1);
      if (bottomCell && bottomCell.isHidden) {
        ctx.fillRect(px, py + cellSize - LAYOUT.lineWidth, cellSize, LAYOUT.lineWidth);
      }
    }
  }
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  drawCtx: DrawContext
): void {
  const { board, gridMap } = drawCtx;

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(gridMap, x, y);
      if (!cell) continue;
      if (cell.isHidden) continue;

      const px = x * cellSize;
      const py = y * cellSize;

      if (cell.isBlock) {
        drawBlockCell(ctx, px, py, cellSize);
        continue;
      }

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(px, py, cellSize, cellSize);
    }
  }
}

function drawBlockCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number
): void {
  ctx.fillStyle = COLORS.blockFill;
  ctx.fillRect(px, py, cellSize, cellSize);
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  totalWidth: number,
  totalHeight: number
): void {
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = LAYOUT.lineWidth;
  ctx.lineCap = 'square';

  for (let x = 0; x <= cols; x++) {
    const px = x * cellSize;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, totalHeight);
    ctx.stroke();
  }

  for (let y = 0; y <= rows; y++) {
    const py = y * cellSize;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(totalWidth, py);
    ctx.stroke();
  }
}

function drawCellOverlays(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  drawCtx: DrawContext
): void {
  const { board, gridMap, selectedCell, allWordBounds, editable, answers, isCompleted, checkErrors } = drawCtx;

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(gridMap, x, y);
      if (!cell || cell.isBlock || cell.isHidden) continue;

      const px = x * cellSize;
      const py = y * cellSize;

      const isSelected = selectedCell?.x === x && selectedCell?.y === y;
      const inWord = isCellInWordBounds(x, y, allWordBounds);

      if (isSelected || inWord) {
        ctx.fillStyle = isSelected ? COLORS.selectedCell : COLORS.highlightedWord;
        ctx.fillRect(px, py, cellSize, cellSize);
        if (isSelected) {
          ctx.strokeStyle = COLORS.gridLine;
          ctx.lineWidth = Math.max(1.5, cellSize * 0.06);
          ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
        }
      }

      if (cell.number !== null) {
        drawCellNumber(ctx, px, py, cell.number);
      }

      const displayValue = editable ? cell.value : (answers[cellKey(x, y)] || '');

      if (displayValue) {
        const letterColor = getLetterColor(cell, displayValue, isCompleted, checkErrors);
        drawCellLetter(ctx, px, py, cellSize, displayValue, letterColor);
      }
    }
  }
}

function getLetterColor(
  cell: CrosswordCell,
  displayValue: string,
  isCompleted: boolean,
  checkErrors: boolean
): string {
  if (isCompleted && cell.value === displayValue) {
    return COLORS.completedLetter;
  }
  if (checkErrors && cell.value && displayValue && cell.value !== displayValue) {
    return COLORS.errorLetter;
  }
  return COLORS.letter;
}

function drawCellNumber(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  num: number
): void {
  ctx.fillStyle = COLORS.number;
  ctx.font = `bold ${LAYOUT.numberFontSize}px ${LAYOUT.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(num.toString(), px + LAYOUT.numberOffsetX, py + LAYOUT.numberOffsetY);
}

function drawCellLetter(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number,
  letter: string,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${LAYOUT.letterFontSize}px ${LAYOUT.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter.toUpperCase(), px + cellSize / 2, py + cellSize / 2 + 1);
}
