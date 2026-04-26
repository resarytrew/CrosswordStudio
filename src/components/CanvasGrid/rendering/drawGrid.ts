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
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, COLORS.backgroundTop);
  baseGradient.addColorStop(1, COLORS.backgroundBottom);
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.45, Math.min(width, height) * 0.2, width * 0.5, height * 0.45, Math.max(width, height) * 0.85);
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(1, 'rgba(75, 56, 35, 0.08)');
  ctx.fillStyle = vignette;
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
  const { board, gridMap, editable, answers } = drawCtx;

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

      const displayValue = editable ? cell.value : (answers[cellKey(x, y)] || '');
      drawPaperCell(ctx, px, py, cellSize, Boolean(displayValue));
    }
  }
}

function drawPaperCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number,
  filled: boolean
): void {
  const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
  gradient.addColorStop(0, filled ? COLORS.filledCellTop : COLORS.backgroundTop);
  gradient.addColorStop(1, filled ? COLORS.filledCellBottom : COLORS.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, cellSize, cellSize);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
}

function drawBlockCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number
): void {
  const blockGradient = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
  blockGradient.addColorStop(0, COLORS.blockEdge);
  blockGradient.addColorStop(1, COLORS.blockFill);
  ctx.fillStyle = blockGradient;
  ctx.fillRect(px, py, cellSize, cellSize);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  totalWidth: number,
  totalHeight: number
): void {
  ctx.strokeStyle = COLORS.gridLineSoft;
  ctx.lineWidth = Math.max(1, LAYOUT.lineWidth - 0.5);
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
        if (isSelected) {
          const selectedGradient = ctx.createRadialGradient(px + cellSize * 0.5, py + cellSize * 0.45, cellSize * 0.1, px + cellSize * 0.5, py + cellSize * 0.45, cellSize * 0.7);
          selectedGradient.addColorStop(0, COLORS.selectedCellSoft);
          selectedGradient.addColorStop(1, COLORS.selectedCell);
          ctx.fillStyle = selectedGradient;
          ctx.fillRect(px, py, cellSize, cellSize);
        } else {
          const wordGradient = ctx.createLinearGradient(px, py, px, py + cellSize);
          wordGradient.addColorStop(0, COLORS.highlightedWordSoft);
          wordGradient.addColorStop(1, COLORS.highlightedWord);
          ctx.fillStyle = wordGradient;
          ctx.fillRect(px, py, cellSize, cellSize);
        }

        if (isSelected) {
          ctx.strokeStyle = COLORS.gridLine;
          ctx.lineWidth = Math.max(1.4, cellSize * 0.06);
          ctx.strokeRect(px + 1.2, py + 1.2, cellSize - 2.4, cellSize - 2.4);

          ctx.shadowColor = COLORS.selectedGlow;
          ctx.shadowBlur = cellSize * 0.26;
          ctx.strokeStyle = 'rgba(255, 244, 224, 0.65)';
          ctx.lineWidth = Math.max(1, cellSize * 0.03);
          ctx.strokeRect(px + 2.2, py + 2.2, cellSize - 4.4, cellSize - 4.4);
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
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
  ctx.shadowColor = 'rgba(25, 14, 7, 0.2)';
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 0.6;
  ctx.fillStyle = color;
  ctx.font = `bold ${LAYOUT.letterFontSize}px ${LAYOUT.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter.toUpperCase(), px + cellSize / 2, py + cellSize / 2 + 1);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
