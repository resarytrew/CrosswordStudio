import type { CrosswordCell } from '../types';

export type GridMap = Map<string, CrosswordCell>;

export function buildGridMap(grid: CrosswordCell[]): GridMap {
  const map = new Map<string, CrosswordCell>();
  for (const cell of grid) {
    map.set(cellKey(cell.x, cell.y), cell);
  }
  return map;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function getCell(map: GridMap, x: number, y: number): CrosswordCell | null {
  return map.get(cellKey(x, y)) ?? null;
}

export function isCellPlayable(cell: CrosswordCell | null): boolean {
  return cell !== null && !cell.isBlock && !cell.isHidden;
}