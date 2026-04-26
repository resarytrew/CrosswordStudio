import type { BoardState } from '../types';

export function parseBoardState(raw: unknown): BoardState | null {
  try {
    return normalizeBoardState(raw);
  } catch (e) {
    console.warn('Failed to parse board state:', e);
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

function normalizeBoardState(raw: unknown): BoardState | null {
  let source: unknown = raw;
  if (typeof source === 'string') {
    source = JSON.parse(source);
  }

  if (!source || typeof source !== 'object') return null;
  const b = source as Record<string, unknown>;
  const rawGrid = Array.isArray(b.grid) ? b.grid : [];
  if (rawGrid.length === 0) return null;

  const toInt = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.floor(v);
  };

  let width = toInt(b.width) ?? 0;
  let height = toInt(b.height) ?? 0;

  type NormalizedCell = BoardState['grid'][number];
  const cellMap = new Map<string, NormalizedCell>();
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < rawGrid.length; i++) {
    const item = rawGrid[i];
    if (!item || typeof item !== 'object') continue;
    const cell = item as Record<string, unknown>;

    const fallbackWidth = width > 0 ? width : rawGrid.length;
    const x = toInt(cell.x) ?? (i % fallbackWidth);
    const y = toInt(cell.y) ?? Math.floor(i / fallbackWidth);
    if (x < 0 || y < 0) continue;

    const normalized: NormalizedCell = {
      x,
      y,
      isBlock: Boolean(cell.isBlock),
      isHidden: Boolean(cell.isHidden),
      value: typeof cell.value === 'string' ? cell.value : '',
      number: toInt(cell.number),
    };

    cellMap.set(`${x},${y}`, normalized);
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (cellMap.size === 0) return null;

  width = Math.max(width, maxX + 1);
  height = Math.max(height, maxY + 1);
  if (width <= 0 || height <= 0) return null;

  const grid: BoardState['grid'] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const existing = cellMap.get(key);
      if (existing) {
        grid.push(existing);
      } else {
        grid.push({ x, y, isBlock: true, isHidden: false, value: '', number: null });
      }
    }
  }

  const normalizeClues = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((clue): clue is Record<string, unknown> => Boolean(clue) && typeof clue === 'object')
      .map((clue) => ({
        number: toInt(clue.number) ?? 0,
        text: typeof clue.text === 'string' ? clue.text : '',
        x: toInt(clue.x) ?? 0,
        y: toInt(clue.y) ?? 0,
        length: Math.max(0, toInt(clue.length) ?? 0),
      }))
      .filter((clue) => clue.number > 0 && clue.length > 0);
  };

  const rawClues = b.clues && typeof b.clues === 'object' ? (b.clues as Record<string, unknown>) : {};

  return {
    width,
    height,
    grid,
    clues: {
      across: normalizeClues(rawClues.across),
      down: normalizeClues(rawClues.down),
    },
  };
}
