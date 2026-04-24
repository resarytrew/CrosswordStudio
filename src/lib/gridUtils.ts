import { BoardState, Clue, GridCell } from '../types';

export function createEmptyGrid(width: number, height: number): BoardState {
  const grid: GridCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.push({ x, y, isBlock: false, value: '', number: null });
    }
  }
  return { width, height, grid, clues: { across: [], down: [] } };
}

export function updateGridNumbers(board: BoardState): BoardState {
  let num = 1;
  const newGrid = board.grid.map(c => ({...c, number: null}));
  const acrossClues: Clue[] = [];
  const downClues: Clue[] = [];

  const getCell = (x: number, y: number) => newGrid.find(c => c.x === x && c.y === y);

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = getCell(x, y);
      if (!cell || cell.isBlock || cell.isHidden) continue;

      const isAcrossStart = x === 0 || getCell(x - 1, y)?.isBlock || getCell(x - 1, y)?.isHidden;
      const isDownStart = y === 0 || getCell(x, y - 1)?.isBlock || getCell(x, y - 1)?.isHidden;

      let needsNumber = false;

      // Check if it's actually a starting point of at least length 2
      let acrossLength = 0;
      if (isAcrossStart) {
        let cx = x;
        while (cx < board.width && !getCell(cx, y)?.isBlock && !getCell(cx, y)?.isHidden) {
          acrossLength++;
          cx++;
        }
        if (acrossLength > 1) needsNumber = true;
      }

      let downLength = 0;
      if (isDownStart) {
        let cy = y;
        while (cy < board.height && !getCell(x, cy)?.isBlock && !getCell(x, cy)?.isHidden) {
          downLength++;
          cy++;
        }
        if (downLength > 1) needsNumber = true;
      }

      if (needsNumber) {
        cell.number = num;
        
        if (isAcrossStart && acrossLength > 1) {
          const existingClue = board.clues.across.find(c => c.x === x && c.y === y);
          acrossClues.push({
            number: num,
            text: existingClue?.text || '',
            x,
            y,
            length: acrossLength
          });
        }
        
        if (isDownStart && downLength > 1) {
          const existingClue = board.clues.down.find(c => c.x === x && c.y === y);
          downClues.push({
            number: num,
            text: existingClue?.text || '',
            x,
            y,
            length: downLength
          });
        }

        num++;
      }
    }
  }

  return {
    ...board,
    grid: newGrid,
    clues: { across: acrossClues, down: downClues }
  };
}
