import { useMemo } from 'react';
import type { CrosswordCell } from '../types';
import { buildGridMap, type GridMap } from '../utils/gridMap';

export function useGridMap(grid: CrosswordCell[]): GridMap {
  return useMemo(() => buildGridMap(grid), [grid]);
}