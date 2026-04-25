export interface CrosswordCell {
  x: number;
  y: number;
  isBlock: boolean;
  isHidden?: boolean;
  value: string;
  number: number | null;
}

export interface WordBounds {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
}

export interface Clue {
  number: number;
  text: string;
  x: number;
  y: number;
  length: number;
}

export interface CrosswordBoard {
  width: number;
  height: number;
  grid: CrosswordCell[];
  clues: {
    across: Clue[];
    down: Clue[];
  };
}

export interface AllWordBounds {
  across: WordBounds | null;
  down: WordBounds | null;
}