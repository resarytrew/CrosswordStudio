import { useRef, useEffect, useCallback, type RefObject } from 'react';
import type { CrosswordBoard, AllWordBounds } from '../types';
import type { GridMap } from '../utils/gridMap';
import { drawFullGrid, type DrawContext } from '../rendering/drawGrid';

interface UseCanvasRendererParams {
  board: CrosswordBoard;
  gridMap: GridMap;
  selectedCell: { x: number; y: number } | null;
  allWordBounds: AllWordBounds | null;
  editable: boolean;
  answers: Record<string, string>;
  isCompleted: boolean;
  checkErrors: boolean;
}

interface UseCanvasRendererReturn {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  getCellFromPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

export function useCanvasRenderer(params: UseCanvasRendererParams): UseCanvasRendererReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellSizeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const { board, gridMap, selectedCell, allWordBounds, editable, answers, isCompleted, checkErrors } = params;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    const cellSize = Math.min(rect.width / board.width, rect.height / board.height);
    cellSizeRef.current = cellSize;

    const totalWidth = cellSize * board.width;
    const totalHeight = cellSize * board.height;

    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const drawCtx: DrawContext = {
      board,
      gridMap,
      selectedCell,
      allWordBounds,
      editable,
      answers,
      isCompleted,
      checkErrors,
    };

    drawFullGrid(ctx, cellSize, totalWidth, totalHeight, drawCtx);
  }, [board, gridMap, selectedCell, allWordBounds, editable, answers, isCompleted, checkErrors]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      render();
      rafRef.current = 0;
    });
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      scheduleRender();
    });
    observer.observe(container);

    scheduleRender();

    return () => {
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scheduleRender]);

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const cellSize = cellSizeRef.current;
      if (cellSize === 0) return null;

      const canvasX = clientX - rect.left;
      const canvasY = clientY - rect.top;

      const scaleX = parseFloat(canvas.style.width) / rect.width;
      const scaleY = parseFloat(canvas.style.height) / rect.height;

      const adjustedX = canvasX * scaleX;
      const adjustedY = canvasY * scaleY;

      const gridX = Math.floor(adjustedX / cellSize);
      const gridY = Math.floor(adjustedY / cellSize);

      if (gridX < 0 || gridX >= board.width || gridY < 0 || gridY >= board.height) {
        return null;
      }

      return { x: gridX, y: gridY };
    },
    [board.width, board.height]
  );

  return { canvasRef, containerRef, getCellFromPoint };
}
